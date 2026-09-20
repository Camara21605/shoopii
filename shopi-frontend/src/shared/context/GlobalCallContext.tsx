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
import type { CallStatus, CallInfo, CallEventPayload, ReconnectPhase } from '../messagerie/hooks/useAudioCall';
import { initGlobalSocket, getActiveSocket } from '../messagerie/hooks/useSocket';
import type { WsNewMessage }    from '../messagerie/hooks/useSocket';
import { apiFetch }             from '../services/apiFetch';
import { getRoleFromToken }     from '../services/authUtils';
import { setBadgeSource } from '../notifications/appBadge';
import { useToast }             from './ToastContext';
import CallOverlay              from '../messagerie/components/CallOverlay';

/* Rôles autorisés à utiliser la messagerie Shoneya */
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
  reconnectPhase:    ReconnectPhase | null;
  isScreenSharing:   boolean;
  canFlipCamera:     boolean;
  canShareScreen:    boolean;
  hasRemoteVideo:    boolean;
  needsAudioUnlock:  boolean;

  startCall:         (info: Omit<CallInfo, 'direction'>) => Promise<void>;
  acceptCall:        () => Promise<void>;
  rejectCall:        () => void;
  hangUp:            () => void;
  toggleMute:        () => void;
  toggleVideo:       () => void;
  toggleSpeaker:     () => void;
  flipCamera:        () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  enableAudio:       () => Promise<void>;

  /** Nombre total de messages non lus — mis à jour en temps réel via socket */
  msgUnread: number;

  /** Synchronise le compteur depuis MessagerieCore (totalUnread temps réel) */
  syncMsgUnread: (count: number) => void;

  /**
   * Permet à MessagerieCore de brancher une fonction qui met à jour
   * localement la liste des messages après un appel (update optimiste).
   * Le handler retourne l'id temporaire du message optimiste créé (voir
   * useMessagerie.applyCallEventLocally) — utilisé pour le réconcilier
   * avec le message réel une fois persisté (voir registerCallEventResolvedHandler
   * ci-dessous). Appeler avec null au démontage pour nettoyer.
   */
  registerCallEventHandler: (
    handler: ((event: CallEventPayload) => string | void) | null
  ) => void;

  /**
   * BUG CORRIGÉ — persistCallEvent() postait l'événement d'appel côté
   * serveur en fire-and-forget, sans jamais reconnecter le message
   * optimiste créé par registerCallEventHandler ci-dessus à sa version
   * confirmée par le serveur. Cette dernière arrivait ensuite via le
   * socket ('new_message') comme un message ENTIÈREMENT NOUVEAU (id
   * serveur différent de "tmp-call-…") : le garde anti-doublon de
   * handleNewMessage (comparaison par id) ne le reconnaissait pas comme
   * le même événement, et les DEUX bulles restaient affichées en
   * permanence ("Appel refusé" en double, jamais nettoyé). Permet à
   * useMessagerie de brancher resolveCallEvent(), appelé une fois la
   * persistance REST terminée (avec le message serveur si succès).
   */
  registerCallEventResolvedHandler: (
    handler: ((convId: string, tmpId: string, saved?: unknown) => void) | null
  ) => void;
}

const GlobalCallContext = createContext<GlobalCallContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────

export function GlobalCallProvider({ children }: { children: React.ReactNode }) {
  const { pop: showToast } = useToast();
  const location           = useLocation();

  /* Ref vers le handler optionnel de MessagerieCore (mise à jour locale) */
  const callEventHandlerRef = useRef<((e: CallEventPayload) => string | void) | null>(null);
  /* Ref vers le handler de réconciliation optionnel de MessagerieCore
   * (remplace le message optimiste par sa version confirmée serveur) */
  const callEventResolvedRef = useRef<((convId: string, tmpId: string, saved?: unknown) => void) | null>(null);

  // ── Compteur global de messages non lus ─────────────────────

  const [msgUnread, setMsgUnread] = useState(0);

  /* Total exact des messages non lus (onglet Messagerie) : une requête d'agrégat
   * côté serveur pour les conversations (au lieu de charger toute la liste pour
   * en additionner les compteurs) + les groupes de livraison. Source unique de
   * vérité = conversations.unreadCount* — les messages ne passent PLUS par le
   * centre de notifications (cloche). */
  const refreshMsgUnread = useCallback(() => {
    if (!localStorage.getItem('shopi_access_token')) return;
    if (!MESSAGING_ROLES.has(getRoleFromToken() ?? '')) return;
    Promise.all([
      apiFetch<{ unreadCount: number }>('/messagerie/unread-count').catch(() => null),
      apiFetch<{ unreadCount: number }[]>('/delivery-groups').catch(() => []),
    ]).then(([conv, groups]) => {
      if (conv === null) return;               // erreur réseau : on garde la valeur actuelle
      const groupTotal = Array.isArray(groups) ? groups.reduce((sum, g) => sum + (g.unreadCount ?? 0), 0) : 0;
      setMsgUnread((conv.unreadCount ?? 0) + groupTotal);
    });
  }, []);

  /* Chargement au montage. */
  useEffect(() => { refreshMsgUnread(); }, [refreshMsgUnread]);

  /* Resynchronisation au retour sur l'application (onglet/appli remise au
   * premier plan, réseau rétabli) : des messages ont pu arriver pendant que la
   * connexion temps réel était coupée — sans ça le compteur restait figé. */
  useEffect(() => {
    const resync = () => {
      if (document.visibilityState === 'visible' && !pathnameRef.current.startsWith('/messagerie')) {
        refreshMsgUnread();
      }
    };
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('online', resync);
    return () => {
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('online', resync);
    };
  }, [refreshMsgUnread]);

  /* Part « messages » de la pastille sur l'icône de l'application installée
   * (l'autre part, les notifications, est gérée par NotificationContext). */
  useEffect(() => {
    if (!MESSAGING_ROLES.has(getRoleFromToken() ?? '')) return;
    setBadgeSource('msg', msgUnread);
  }, [msgUnread]);

  /* Remet à 0 quand l'utilisateur ouvre la messagerie */
  useEffect(() => {
    if (location.pathname.startsWith('/messagerie')) setMsgUnread(0);
  }, [location.pathname]);

  /* Ref stable pour pathname — évite de re-créer le listener à chaque navigation */
  const pathnameRef = useRef(location.pathname);
  useEffect(() => { pathnameRef.current = location.pathname; });

  // ── Persistance REST de l'événement d'appel ─────────────────

  const persistCallEvent = useCallback(async (event: CallEventPayload, tmpId?: string) => {
    try {
      const saved = await apiFetch(`/messagerie/conversations/${event.conversationId}/messages`, {
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
      /* tmpId absent → aucun message optimiste à réconcilier (l'utilisateur
       * n'était pas sur /messagerie quand l'appel s'est terminé) — la conv
       * chargera ce message normalement à sa prochaine ouverture. */
      if (tmpId) callEventResolvedRef.current?.(event.conversationId, tmpId, saved);
    } catch {
      /* L'historique d'appel sera visible au prochain chargement de la conversation —
       * le message optimiste (s'il existe) reste affiché tel quel. */
    }
  }, []);

  // ── Hook d'appel (état global) ───────────────────────────────

  const {
    callStatus, callInfo, duration, isMuted, isVideoOff, isSpeakerOn,
    isScreenSharing, canFlipCamera, canShareScreen, hasRemoteVideo,
    needsAudioUnlock, enableAudio,
    localMediaStream, remoteMediaStream, reconnectPhase,
    startCall, acceptCall, injectIncomingCall, rejectCall, hangUp, cancelUnavailable,
    toggleMute, toggleVideo, toggleSpeaker, flipCamera, toggleScreenShare,
  } = useAudioCall({
    onCallEvent: (event) => {
      /* 1. Mise à jour locale optimiste (si MessagerieCore est monté) —
       * récupère l'id temporaire créé pour pouvoir le réconcilier ensuite. */
      const tmpId = callEventHandlerRef.current?.(event) || undefined;
      /* 2. Persistance REST — toujours, quelle que soit la page courante */
      void persistCallEvent(event, tmpId);
    },
    /* Le hook ne sait pas afficher de toast (pas de contexte React) — il
       délègue au système UI Shoneya existant (partie 8, remplace les alert()
       précédents). */
    onError: (error) => showToast(error.message, error.severity),
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
    /* 'storage' ne se déclenche JAMAIS dans l'onglet qui a fait le
     * changement (limitation native de l'API) — seulement dans les
     * AUTRES onglets. Or c'est justement DANS cet onglet que le token
     * localStorage vient d'être renouvelé après un silent refresh
     * (apiFetch.ts). Sans 'auth:login' (déclenché par tokenStorage.set()
     * dans le même onglet), le socket restait bloqué avec l'ancien token
     * jusqu'à expiration complète — d'où le bandeau "Déconnecté du
     * serveur temps réel" après une session assez longue. */
    const onAuthLogin = () => {
      if (MESSAGING_ROLES.has(getRoleFromToken() ?? '')) initGlobalSocket();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('auth:login', onAuthLogin);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('auth:login', onAuthLogin);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // ── Appel entrant reçu application fermée / en arrière-plan ─────
  /*
   * Le serveur envoie aussi l'appel par notification push (Répondre / Refuser). Quand l'utilisateur
   * la touche, l'application s'ouvre APRÈS le début de la sonnerie : l'événement temps réel
   * `call:incoming` est déjà passé. On redemande donc au serveur « un appel sonne-t-il pour moi ? »
   * (GET /calls/pending-incoming) et on le fait sonner, avec décrochage automatique si le bouton
   * « Répondre » a été touché. Sert aussi de rattrapage quand le réseau revient en pleine sonnerie.
   */
  const autoAcceptRef = useRef<{ callerUserId: string | null; until: number } | null>(null);
  /* Ref vers la dernière version d'injectIncomingCall : garde resolvePendingIncoming STABLE
   * (sinon ses effets se ré-abonnent et re-interrogent le serveur à chaque rendu). */
  const injectIncomingRef = useRef(injectIncomingCall);
  useEffect(() => { injectIncomingRef.current = injectIncomingCall; });

  const resolvePendingIncoming = useCallback(async (action: 'accept' | 'open' | null) => {
    const token = localStorage.getItem('shopi_access_token');
    if (!token || !MESSAGING_ROLES.has(getRoleFromToken() ?? '')) return;
    if (action === 'accept') {
      autoAcceptRef.current = { callerUserId: null, until: Date.now() + 20_000 };
    }
    try {
      const { call } = await apiFetch<{ call: null | {
        conversationId: string | null; callerUserId: string; callType: 'audio' | 'video';
        callerName: string; callerAvatar: string | null;
      } }>('/calls/pending-incoming');
      console.info('[CallAuto] appel en attente :', call ? 'oui' : 'non', '| action :', action);
      if (!call || !call.conversationId) return;
      if (autoAcceptRef.current) autoAcceptRef.current.callerUserId = call.callerUserId;
      /* Un appel est déjà en cours d'affichage (sonnerie reçue par le socket, ou déjà décroché) :
       * rien à injecter — on peut seulement avoir à décrocher. */
      if (callStateRef.current.callInfo) { tryAutoAccept(); return; }
      injectIncomingRef.current({
        conversationId: call.conversationId,
        callerUserId:   call.callerUserId,
        callerName:     call.callerName,
        callerAvatar:   call.callerAvatar ?? undefined,
        callType:       call.callType,
      });
      tryAutoAccept();   // ça sonnait déjà : l'état ne changera pas, on décroche directement
    } catch { /* hors ligne / session expirée : l'appel sonnera via le socket dès qu'il se reconnecte */ }
  }, []);

  /* Dernier état d'appel connu, lisible depuis des callbacks stables (sans les ré-abonner). */
  const callStateRef = useRef({ callStatus, callInfo, acceptCall });
  useEffect(() => { callStateRef.current = { callStatus, callInfo, acceptCall }; });

  /* Décrochage automatique : répond UNE fois, dès que l'appel visé sonne. Appelé (a) à chaque
   * changement d'état d'appel — sonnerie qui vient d'apparaître — et (b) directement quand l'action
   * « Répondre » arrive alors que ça sonne DÉJÀ (l'état ne change plus : aucun effet ne se relancerait). */
  const tryAutoAccept = useCallback(() => {
    const auto = autoAcceptRef.current;
    const { callStatus: status, callInfo: info, acceptCall: accept } = callStateRef.current;
    if (!auto || status !== 'ringing' || !info || info.direction !== 'incoming') return;
    if (Date.now() > auto.until) { autoAcceptRef.current = null; return; }
    if (auto.callerUserId && auto.callerUserId !== info.remoteUserId) return;
    autoAcceptRef.current = null;
    console.info('[CallAuto] décrochage automatique depuis la notification');
    void accept();
  }, []);

  useEffect(() => { tryAutoAccept(); }, [callStatus, callInfo, tryAutoAccept]);

  /* 1) Ouverture de l'application depuis la notification : ?callAction=accept|open. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('callAction');
    if (action !== 'accept' && action !== 'open') return;
    params.delete('callAction');
    params.delete('callFrom');
    const qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
    void resolvePendingIncoming(action);
  }, [resolvePendingIncoming]);

  /* 2) Application déjà ouverte : le service worker nous transmet l'action sans rechargement. */
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const m = e.data as { type?: string; action?: 'accept' | 'open'; callerUserId?: string | null } | undefined;
      if (m?.type !== 'shoneya-call-action') return;
      /* Accusé de réception : le service worker sait que cette version de l'application traite l'action
       * (sinon il recharge la page, voir push-sw.js). */
      (e.source as ServiceWorker | null)?.postMessage({ type: 'shoneya-call-action-ack' });
      if (m.action === 'accept') {
        autoAcceptRef.current = { callerUserId: m.callerUserId ?? null, until: Date.now() + 20_000 };
      }
      void resolvePendingIncoming(m.action === 'accept' ? 'accept' : 'open');
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [resolvePendingIncoming]);

  /* 3) Rattrapage : ouverture normale de l'application, retour au premier plan, réseau rétabli
   *    ou nouvelle connexion pendant une sonnerie déjà commencée. */
  useEffect(() => {
    void resolvePendingIncoming(null);
    const onLogin = () => { void resolvePendingIncoming(null); };
    window.addEventListener('auth:login', onLogin);
    const resync = () => { if (document.visibilityState === 'visible') void resolvePendingIncoming(null); };
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('online', resync);
    return () => {
      window.removeEventListener('auth:login', onLogin);
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('online', resync);
    };
  }, [resolvePendingIncoming]);

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

      /* Appel impossible à établir (hors ligne / permission refusée) —
       * détecté côté serveur AVANT même que ça sonne (voir CallGateway).
       * useAudioCall n'écoute pas cet événement (il n'existait pas avant),
       * donc on le gère ici : toast explicite + on referme l'overlay
       * "calling…" resté ouvert côté appelant. */
      const onCallUnavailable = (p: { conversationId: string; reason: 'offline' | 'denied'; message: string }) => {
        showToast(`📵 ${p.message}`, 'w');
        cancelUnavailable(p.reason);
      };

      /* Compte banni/suspendu PENDANT que ce socket est ouvert — émis par
       * BroadcastService.disconnectUser() JUSTE AVANT de forcer la
       * déconnexion (voir handleConnection côté serveur, qui bloque déjà
       * toute RECONNEXION future ; ceci gère la session déjà ouverte).
       * Sans ce listener, un appel WebRTC en cours restait affiché/actif
       * côté client (RTCPeerConnection + pistes micro/caméra toujours
       * ouvertes) jusqu'à ce que le socket meure silencieusement — aucun
       * message clair, aucun nettoyage explicite. hangUp() ici fait le
       * même nettoyage complet qu'un raccroché normal (RTCPeerConnection,
       * MediaStream, tracks, timers, overlay) ; sans effet s'il n'y a pas
       * d'appel en cours (callInfoRef déjà null → no-op). */
      const onAccountStatusChanged = (p: { reason: string }) => {
        const message = p.reason === 'account_banned'
          ? 'Votre compte a été bloqué par l\'administration. Tout appel en cours a été interrompu.'
          : p.reason === 'account_suspended'
          ? 'Votre compte a été suspendu par l\'administration. Tout appel en cours a été interrompu.'
          : 'Votre session a été fermée par l\'administration.';
        showToast(`🚫 ${message}`, 'w');
        hangUp();
      };

      socket.on('new_message',           onNewMessage);
      socket.on('group_new_message',     onGroupMessage);
      socket.on('call:unavailable',      onCallUnavailable);
      socket.on('account_status_changed', onAccountStatusChanged);
      cleanup = () => {
        socket.off('new_message',            onNewMessage);
        socket.off('group_new_message',      onGroupMessage);
        socket.off('call:unavailable',       onCallUnavailable);
        socket.off('account_status_changed', onAccountStatusChanged);
      };
    }

    subscribe();
    return () => cleanup?.();
  }, [showToast, cancelUnavailable, hangUp]);

  // ── Enregistrement du handler MessagerieCore ─────────────────

  const registerCallEventHandler = useCallback(
    (handler: ((event: CallEventPayload) => string | void) | null) => {
      callEventHandlerRef.current = handler;
    },
    [],
  );

  const registerCallEventResolvedHandler = useCallback(
    (handler: ((convId: string, tmpId: string, saved?: unknown) => void) | null) => {
      callEventResolvedRef.current = handler;
    },
    [],
  );

  // ── Rendu ─────────────────────────────────────────────────────

  return (
    <GlobalCallContext.Provider value={{
      callStatus, callInfo, duration, isMuted, isVideoOff, isSpeakerOn,
      isScreenSharing, canFlipCamera, canShareScreen, hasRemoteVideo,
      needsAudioUnlock, enableAudio,
      localMediaStream, remoteMediaStream, reconnectPhase,
      startCall, acceptCall, rejectCall, hangUp,
      toggleMute, toggleVideo, toggleSpeaker, flipCamera, toggleScreenShare,
      msgUnread,
      syncMsgUnread: setMsgUnread,
      registerCallEventHandler,
      registerCallEventResolvedHandler,
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
          reconnectPhase={reconnectPhase}
          isScreenSharing={isScreenSharing}
          canFlipCamera={canFlipCamera}
          canShareScreen={canShareScreen}
          hasRemoteVideo={hasRemoteVideo}
          needsAudioUnlock={needsAudioUnlock}
          onEnableAudio={enableAudio}
          onAccept={acceptCall}
          onReject={rejectCall}
          onHangUp={hangUp}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onToggleSpeaker={toggleSpeaker}
          onFlipCamera={flipCamera}
          onToggleScreenShare={toggleScreenShare}
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
