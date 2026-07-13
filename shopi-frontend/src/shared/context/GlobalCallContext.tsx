/**
 * FICHIER : src/shared/context/GlobalCallContext.tsx
 *
 * RÔLE : Contexte React global pour les appels audio/vidéo WebRTC.
 *
 * PROBLÈME RÉSOLU :
 *   Avant ce contexte, useAudioCall + CallOverlay étaient dans MessagerieCore
 *   qui se démonte quand l'utilisateur quitte /messagerie → l'appel tombait.
 *
 * SOLUTION :
 *   GlobalCallProvider wrape toute l'application (à l'intérieur de BrowserRouter).
 *   - Maintient la connexion Socket.IO active en permanence
 *   - Gère l'état d'appel globalement (survit aux changements de route)
 *   - Rend CallOverlay au-dessus de toute page (z-index élevé)
 *   - Envoie des notifications toast pour les messages reçus hors messagerie
 *   - Persiste les événements d'appel via REST (même hors page messagerie)
 *
 * USAGE dans MessagerieCore :
 *   const call = useGlobalCall();
 *   useEffect(() => {
 *     call.registerCallEventHandler(applyCallEventLocally);
 *     return () => call.registerCallEventHandler(null);
 *   }, []);
 */

import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { useLocation } from 'react-router-dom';

import { useAudioCall }         from '../messagerie/hooks/useAudioCall';
import type { CallStatus, CallInfo, CallEventPayload } from '../messagerie/hooks/useAudioCall';
import { initGlobalSocket, getActiveSocket } from '../messagerie/hooks/useSocket';
import type { WsNewMessage }    from '../messagerie/hooks/useSocket';
import { apiFetch }             from '../services/apiFetch';
import { getRoleFromToken }     from '../services/authUtils';
import { useToast }             from './ToastContext';
import CallOverlay              from '../messagerie/components/CallOverlay';

/* Rôles autorisés à utiliser la messagerie Shopi */
const MESSAGING_ROLES = new Set(['client', 'company', 'delivery', 'correspondent', 'partner']);

// ── Interface du contexte ──────────────────────────────────────

export interface GlobalCallContextValue {
  callStatus:        CallStatus;
  callInfo:          CallInfo | null;
  duration:          number;
  isMuted:           boolean;
  isVideoOff:        boolean;
  isSpeakerOn:       boolean;
  localMediaStream:  MediaStream | null;
  remoteMediaStream: MediaStream | null;

  startCall:     (info: Omit<CallInfo, 'direction'>) => Promise<void>;
  acceptCall:    () => Promise<void>;
  rejectCall:    () => void;
  hangUp:        () => void;
  toggleMute:    () => void;
  toggleVideo:   () => void;
  toggleSpeaker: () => void;
  flipCamera:    () => Promise<void>;

  /** Nombre total de messages non lus — mis à jour en temps réel via socket */
  msgUnread: number;

  /** Synchronise le compteur depuis MessagerieCore (totalUnread temps réel) */
  syncMsgUnread: (count: number) => void;

  /**
   * Permet à MessagerieCore de brancher une fonction qui met à jour
   * localement la liste des messages après un appel (update optimiste).
   * Appeler avec null au démontage pour nettoyer.
   */
  registerCallEventHandler: (
    handler: ((event: CallEventPayload) => void) | null
  ) => void;
}

const GlobalCallContext = createContext<GlobalCallContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────

export function GlobalCallProvider({ children }: { children: React.ReactNode }) {
  const { pop: showToast } = useToast();
  const location           = useLocation();

  /* Ref vers le handler optionnel de MessagerieCore (mise à jour locale) */
  const callEventHandlerRef = useRef<((e: CallEventPayload) => void) | null>(null);

  // ── Compteur global de messages non lus ─────────────────────

  const [msgUnread, setMsgUnread] = useState(0);

  /* Charge le total initial depuis l'API au montage — uniquement pour les rôles autorisés */
  useEffect(() => {
    const token = localStorage.getItem('shopi_access_token');
    if (!token) return;
    if (!MESSAGING_ROLES.has(getRoleFromToken() ?? '')) return;
    Promise.all([
      apiFetch<{ unreadCount: number }[]>('/messagerie/conversations').catch(() => []),
      apiFetch<{ unreadCount: number }[]>('/delivery-groups').catch(() => []),
    ]).then(([convs, groups]) => {
      const convTotal  = Array.isArray(convs)  ? convs.reduce((s, c)  => s + (c.unreadCount ?? 0), 0) : 0;
      const groupTotal = Array.isArray(groups) ? groups.reduce((s, g) => s + (g.unreadCount ?? 0), 0) : 0;
      setMsgUnread(convTotal + groupTotal);
    });
  }, []);

  /* Remet à 0 quand l'utilisateur ouvre la messagerie */
  useEffect(() => {
    if (location.pathname.startsWith('/messagerie')) setMsgUnread(0);
  }, [location.pathname]);

  /* Ref stable pour pathname — évite de re-créer le listener à chaque navigation */
  const pathnameRef = useRef(location.pathname);
  useEffect(() => { pathnameRef.current = location.pathname; });

  // ── Persistance REST de l'événement d'appel ─────────────────

  const persistCallEvent = useCallback(async (event: CallEventPayload) => {
    try {
      await apiFetch(`/messagerie/conversations/${event.conversationId}/messages`, {
        method: 'POST',
        body: {
          contentType: 'call',
          content: JSON.stringify({
            status:    event.status,
            direction: event.direction,
            duration:  event.duration,
            callType:  event.callType,
          }),
        },
      });
    } catch {
      /* L'historique d'appel sera visible au prochain chargement de la conversation */
    }
  }, []);

  // ── Hook d'appel (état global) ───────────────────────────────

  const {
    callStatus, callInfo, duration, isMuted, isVideoOff, isSpeakerOn,
    localMediaStream, remoteMediaStream,
    startCall, acceptCall, rejectCall, hangUp,
    toggleMute, toggleVideo, toggleSpeaker, flipCamera,
  } = useAudioCall({
    onCallEvent: (event) => {
      /* 1. Mise à jour locale optimiste (si MessagerieCore est monté) */
      callEventHandlerRef.current?.(event);
      /* 2. Persistance REST — toujours, quelle que soit la page courante */
      void persistCallEvent(event);
    },
  });

  // ── Initialisation du socket messaging ──────────────────────
  /* Uniquement pour les rôles qui peuvent utiliser la messagerie.
   * super_admin et admin sont bloqués côté backend → ne pas tenter
   * la connexion pour éviter les erreurs WebSocket en console.
   *
   * NOTE : dépend de location.pathname pour se ré-exécuter après une
   * navigation SPA post-login. Sans ça, si l'utilisateur se connecte
   * depuis /login (token absent au montage), le socket n'est jamais
   * initialisé pour cette session.
   */

  useEffect(() => {
    if (!MESSAGING_ROLES.has(getRoleFromToken() ?? '')) return;

    initGlobalSocket();

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'shopi_access_token' && MESSAGING_ROLES.has(getRoleFromToken() ?? '')) {
        initGlobalSocket();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // ── Notifications de nouveaux messages (hors messagerie) ────

  useEffect(() => {
    /* Uniquement pour les rôles avec accès messagerie */
    if (!MESSAGING_ROLES.has(getRoleFromToken() ?? '')) return;

    let cleanup: (() => void) | null = null;
    let retries = 0;

    function subscribe() {
      const socket = getActiveSocket();
      if (!socket) {
        if (++retries < 15) setTimeout(subscribe, 400);
        return;
      }

      const onNewMessage = (payload: WsNewMessage) => {
        /* Ne montrer le toast que si on n'est PAS déjà sur messagerie */
        if (pathnameRef.current.startsWith('/messagerie')) return;

        const sender  = payload.message.senderName || 'Quelqu\'un';
        const preview = payload.message.content
          ? payload.message.content.slice(0, 60) + (payload.message.content.length > 60 ? '…' : '')
          : payload.message.contentType === 'image' ? '📷 Photo'
          : payload.message.contentType === 'video' ? '🎥 Vidéo'
          : payload.message.contentType === 'audio' ? '🎙️ Vocal'
          : payload.message.contentType === 'file'  ? '📄 Document'
          : 'Message reçu';

        setMsgUnread(prev => prev + 1);
        showToast(`💬 ${sender} : ${preview}`, 'i');
      };

      const onGroupMessage = (p: {
        groupId: string;
        commandeNumero: string;
        message: { senderName: string | null; content: string | null; contentType: string };
      }) => {
        if (pathnameRef.current.startsWith('/messagerie')) return;

        const sender  = p.message.senderName || 'Groupe livraison';
        const preview = p.message.content
          ? p.message.content.slice(0, 60) + (p.message.content.length > 60 ? '…' : '')
          : p.message.contentType === 'image' ? '📷 Photo'
          : p.message.contentType === 'video' ? '🎥 Vidéo'
          : p.message.contentType === 'audio' ? '🎙️ Vocal'
          : p.message.contentType === 'file'  ? '📄 Document'
          : 'Message reçu';

        setMsgUnread(prev => prev + 1);
        showToast(`📦 ${p.commandeNumero} · ${sender} : ${preview}`, 'i');
      };

      socket.on('new_message',       onNewMessage);
      socket.on('group_new_message', onGroupMessage);
      cleanup = () => {
        socket.off('new_message',       onNewMessage);
        socket.off('group_new_message', onGroupMessage);
      };
    }

    subscribe();
    return () => cleanup?.();
  }, [showToast]);

  // ── Enregistrement du handler MessagerieCore ─────────────────

  const registerCallEventHandler = useCallback(
    (handler: ((event: CallEventPayload) => void) | null) => {
      callEventHandlerRef.current = handler;
    },
    [],
  );

  // ── Rendu ─────────────────────────────────────────────────────

  return (
    <GlobalCallContext.Provider value={{
      callStatus, callInfo, duration, isMuted, isVideoOff, isSpeakerOn,
      localMediaStream, remoteMediaStream,
      startCall, acceptCall, rejectCall, hangUp,
      toggleMute, toggleVideo, toggleSpeaker, flipCamera,
      msgUnread,
      syncMsgUnread: setMsgUnread,
      registerCallEventHandler,
    }}>
      {children}

      {/*
       * CallOverlay est rendu DANS le provider, au-dessus de tout le reste.
       * Il reste visible quelle que soit la route active.
       */}
      {callInfo && callStatus !== 'idle' && (
        <CallOverlay
          status={callStatus}
          callInfo={callInfo}
          duration={duration}
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isSpeakerOn={isSpeakerOn}
          localMediaStream={localMediaStream}
          remoteMediaStream={remoteMediaStream}
          onAccept={acceptCall}
          onReject={rejectCall}
          onHangUp={hangUp}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onToggleSpeaker={toggleSpeaker}
          onFlipCamera={flipCamera}
        />
      )}
    </GlobalCallContext.Provider>
  );
}

// ── Hook consommateur ─────────────────────────────────────────

export function useGlobalCall(): GlobalCallContextValue {
  const ctx = useContext(GlobalCallContext);
  if (!ctx) {
    throw new Error('useGlobalCall() doit être utilisé à l\'intérieur de <GlobalCallProvider>');
  }
  return ctx;
}
