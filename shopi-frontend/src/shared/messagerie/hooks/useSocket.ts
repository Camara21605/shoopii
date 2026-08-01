/**
 * ============================================================
 * FICHIER : src/shared/messagerie/hooks/useSocket.ts
 *
 * RÔLE : Hook React qui gère la connexion Socket.IO à
 *        /messaging et expose les événements temps réel.
 *
 * PATTERN : Singleton par token — une seule connexion même si
 *           plusieurs composants utilisent le hook.
 *
 * EVENTS REÇUS :
 *   connected          → handshake confirmé
 *   new_message        → nouveau message entrant
 *   message_delivered  → accusé livraison
 *   message_read       → accusé lecture
 *   typing             → indicateur d'activité
 *   presence           → changement en ligne/hors ligne
 *   message_edited     → message modifié
 *   message_deleted    → message supprimé
 *   heartbeat_ack      → réponse au ping
 *
 * EVENTS ÉMIS :
 *   join_conv          → rejoindre room conversation
 *   leave_conv         → quitter room conversation
 *   typing             → indicateur frappe/enregistrement
 *   mark_read          → marquer conversation lue
 *   heartbeat          → ping présence toutes les 30s
 * ============================================================
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket }                     from 'socket.io-client';
import { tokenStorage, silentRefresh }    from '../../services/apiFetch';

// ── Constantes ────────────────────────────────────────────────

const SOCKET_URL       = (import.meta as any).env?.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:3001';
const HEARTBEAT_MS     = 30_000;
const RECONNECT_DELAY  = 2_000;

// ── Types des payloads reçus ──────────────────────────────────

export interface WsNewMessage {
  conversationId: string;
  message: {
    id:            string;
    fromMe:        boolean;
    senderId:      string;
    senderType:    string;
    senderName:    string;
    contentType:   string;
    content:       string | null;
    mediaUrl:      string | null;
    mediaName:     string | null;
    mediaMimeType: string | null;
    mediaSize:     number | null;
    createdAt:     string;
    replyToId:     string | null;
  };
  convPreview: {
    lastMessage:   string;
    lastMessageAt: string;
    unreadCount:   number;
  };
}

export interface WsMessageDelivered {
  conversationId: string;
  messageId:      string;
  deliveredAt:    string;
}

export interface WsMessageRead {
  conversationId: string;
  readAt:         string;
  readerId:       string;
}

export interface WsTyping {
  conversationId: string;
  senderId:       string;
  senderName:     string;
  activity:       'typing' | 'recording' | 'uploading' | 'stopped';
}

export interface WsPresence {
  userId:   string;
  online:   boolean;
  lastSeen: string;
}

export interface WsMessageEdited {
  conversationId: string;
  messageId:      string;
  newContent:     string;
  editedAt:       string;
}

export interface WsMessageDeleted {
  conversationId: string;
  messageId:      string;
  deletedForAll:  boolean;
}

export interface WsReactionUpdated {
  conversationId: string;
  messageId:      string;
  /** emoji → array of userIds ayant réagi */
  reactions:      Record<string, string[]>;
}

// ── Types des événements d'appel ─────────────────────────────

export interface WsCallIncoming {
  conversationId: string;
  callerUserId:   string;
  callerName:     string;
  callerAvatar?:  string;
  callType?:      'audio' | 'video';
}

export interface WsCallSignal {
  conversationId: string;
  fromUserId:     string;
  sdp?:           RTCSessionDescriptionInit;
  candidate?:     RTCIceCandidateInit;
}

// ── Callbacks exposés au composant ────────────────────────────

export interface SocketCallbacks {
  onNewMessage?:       (payload: WsNewMessage)       => void;
  onMessageDelivered?: (payload: WsMessageDelivered) => void;
  onMessageRead?:      (payload: WsMessageRead)      => void;
  onTyping?:           (payload: WsTyping)           => void;
  onPresence?:         (payload: WsPresence)         => void;
  onMessageEdited?:    (payload: WsMessageEdited)    => void;
  onMessageDeleted?:   (payload: WsMessageDeleted)   => void;
  onReactionUpdated?:  (payload: WsReactionUpdated)  => void;
  /* Appels audio */
  onCallIncoming?:     (payload: WsCallIncoming)     => void;
  onCallAccepted?:     (payload: { conversationId: string; calleeUserId: string }) => void;
  onCallRejected?:     (payload: { conversationId: string }) => void;
  onCallEnded?:        (payload: { conversationId: string }) => void;
  onCallOffer?:        (payload: WsCallSignal)       => void;
  onCallAnswer?:       (payload: WsCallSignal)       => void;
  onCallIceCandidate?: (payload: WsCallSignal)       => void;
  onCallBusy?:         (payload: { conversationId: string }) => void;
  /* Appels de groupe */
  onGroupCallIncoming?:        (payload: any) => void;
  onGroupCallJoined?:          (payload: any) => void;
  onGroupCallParticipantJoined?(payload: any): void;
  onGroupCallParticipantLeft?  (payload: any): void;
  onGroupCallDeclined?         (payload: any): void;
  onGroupCallEnded?            (payload: any): void;
  onGroupCallOffer?            (payload: any): void;
  onGroupCallAnswer?           (payload: any): void;
  onGroupCallIceCandidate?     (payload: any): void;
  onGroupCallMediaToggled?     (payload: any): void;
  onConnected?:        () => void;
  onDisconnected?:     () => void;
}

// ── Singleton socket (une connexion globale par session) ──────

let _socket: Socket | null = null;

/**
 * Renvoie le socket singleton, créé UNE SEULE FOIS pour toute la durée de
 * l'onglet — l'objet Socket n'est plus jamais recréé après coup, y compris
 * quand le token change (silent refresh).
 *
 * ⚠️ Ancien design (retiré) : un token différent de celui capturé à la
 * création déclenchait `_socket.disconnect(); _socket = null` puis
 * recréait un tout nouvel objet `io(...)`. Problème : tout ce qui avait
 * capturé la RÉFÉRENCE de l'ancien objet à son montage — le closure interne
 * de useSocket() (deps `[]`, ne se remonte jamais) ET les listeners
 * call:* de useAudioCall (ré-enregistrés seulement quand `status` change,
 * pas à chaque reconnexion) — continuait à écouter un socket mort et
 * abandonné. Résultat : après un silent refresh, le bandeau restait
 * bloqué et/ou les appels entrants cessaient d'arriver, alors même que le
 * NOUVEAU socket, lui, se connectait correctement en coulisses.
 *
 * Avec un objet unique et persistant, tous les listeners posés une fois
 * restent valides pour toute la session — un simple `.connect()` suffit
 * pour relancer la connexion, et `auth` (fonction, voir plus bas) relit de
 * toute façon le token le plus frais à chaque tentative.
 */
function getSocket(token: string): Socket {
  if (_socket) {
    /* Toujours le même objet : on s'assure juste qu'il est bien en train
     * de se (re)connecter. `.connect()` est un no-op sûr si déjà connecté
     * ou déjà en cours de connexion (y compris double-invoke React
     * StrictMode) — pas de risque de "WebSocket closed before established". */
    if (_socket.disconnected) _socket.connect();
    return _socket;
  }

  _socket = io(`${SOCKET_URL}/messaging`, {
    /*
     * ⚠️ `auth` en FONCTION (pas un objet statique) : socket.io-client
     * l'appelle à CHAQUE tentative de (re)connexion, donc à chaque coupure
     * puis reconnexion automatique il relit le token le plus frais possible
     * dans le storage — au lieu de renvoyer pour toujours l'instantané pris
     * au tout premier appel de getSocket().
     *
     * Pourquoi c'est nécessaire : apiFetch.ts rafraîchit le access token en
     * silence (silentRefresh) à chaque 401 sur un appel REST classique, et
     * réécrit le nouveau token dans le storage (tokenStorage.set). Mais le
     * socket, lui, n'appelle jamais aucune route REST — sans ce correctif il
     * gardait pour toujours le token capturé au montage.
     */
    auth: (cb: (data: { token: string }) => void) =>
      cb({ token: tokenStorage.get() ?? token }),
    transports:       ['websocket', 'polling'],
    reconnection:     true,
    reconnectionDelay: RECONNECT_DELAY,
    timeout:          10_000,
  });

  return _socket;
}

/**
 * Ferme et efface définitivement le socket singleton — à appeler au
 * logout. Sans ça, le socket restait connecté sous l'identité de
 * l'utilisateur déconnecté jusqu'à l'expiration naturelle du token
 * (le logout ne le coupait jamais explicitement).
 */
export function disconnectGlobalSocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}

/*
 * ── Récupération après rejet serveur (token invalide/expiré) ──────
 *
 * Quand le serveur rejette la connexion (TOKEN_MISSING/TOKEN_INVALID,
 * voir messagerie.gateway.ts → rejectSocket), il appelle lui-même
 * `socket.disconnect()`. Or Socket.IO NE relance PAS automatiquement la
 * reconnexion quand la déconnexion est initiée par le SERVEUR — c'est le
 * comportement documenté de la lib (reason === 'io server disconnect'),
 * volontaire pour éviter de spammer un serveur qui vient de nous rejeter
 * explicitement. `reconnection: true` ne couvre donc QUE les coupures
 * réseau/serveur down, pas les rejets d'authentification.
 *
 * Sans ce correctif : le socket reste déconnecté pour toujours après un
 * rejet, le bandeau "Déconnecté du serveur temps réel" ne disparaît
 * jamais tout seul — il fallait recharger la page pour s'en sortir.
 *
 * Avec ce correctif : on tente un silent refresh (comme apiFetch le fait
 * déjà pour les 401 REST) puis on reconnecte via getSocket(). Si le refresh
 * échoue aussi, la session est réellement terminée → on redirige vers
 * /login, exactement comme apiFetch le fait pour un 401.
 *
 * ⚠️ On passe PAR getSocket() (et non par un `.connect()` direct sur
 * l'ancien objet socket capturé à la fermeture) : silentRefresh() réussi
 * déclenche tokenStorage.set() → event 'auth:login' → GlobalCallContext
 * appelle initGlobalSocket() en parallèle. Comme getSocket() est idempotent
 * (réutilise l'instance si le token n'a pas changé depuis), les deux
 * chemins convergent vers UN SEUL socket au lieu de risquer deux
 * connexions simultanées (doublons de messages/appels entrants).
 */
let _recovering = false;

async function recoverFromServerDisconnect(): Promise<void> {
  if (_recovering) return;
  _recovering = true;
  try {
    const refreshed = await silentRefresh();
    if (refreshed) {
      const freshToken = tokenStorage.get();
      if (freshToken) getSocket(freshToken);
    } else {
      tokenStorage.remove();
      window.location.href = '/login';
    }
  } finally {
    _recovering = false;
  }
}

// ── Hook ──────────────────────────────────────────────────────

export function useSocket(callbacks: SocketCallbacks) {
  const cbRef       = useRef<SocketCallbacks>(callbacks);
  const heartbeatId = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef   = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  // Mise à jour des callbacks sans recréer le socket
  useEffect(() => { cbRef.current = callbacks; });

  useEffect(() => {
    const token = localStorage.getItem('shopi_access_token');
    if (!token) return;

    const socket = getSocket(token);
    socketRef.current = socket;

    // ── Événements de connexion ────────────────────────────

    const onConnect = () => {
      setConnected(true);
      cbRef.current.onConnected?.();
      heartbeatId.current = setInterval(() => socket.emit('heartbeat'), HEARTBEAT_MS);
    };

    const onDisconnect = (reason: string) => {
      setConnected(false);
      cbRef.current.onDisconnected?.();
      if (heartbeatId.current) { clearInterval(heartbeatId.current); heartbeatId.current = null; }
      // Rejet serveur (token invalide/expiré) → pas de reconnexion auto par
      // Socket.IO dans ce cas précis. Voir recoverFromServerDisconnect ci-dessus.
      if (reason === 'io server disconnect') {
        void recoverFromServerDisconnect();
      }
    };

    const onConnectError = (err: Error) => {
      setConnected(false);
      console.warn('[Socket] Erreur connexion:', err.message);
    };

    socket.on('connect_error', onConnectError);

    // ── Événements métier ──────────────────────────────────

    const onNewMessage       = (p: WsNewMessage)       => cbRef.current.onNewMessage?.(p);
    const onMessageDelivered = (p: WsMessageDelivered) => cbRef.current.onMessageDelivered?.(p);
    const onMessageRead      = (p: WsMessageRead)      => cbRef.current.onMessageRead?.(p);
    const onTyping           = (p: WsTyping)           => cbRef.current.onTyping?.(p);
    const onPresence         = (p: WsPresence)         => cbRef.current.onPresence?.(p);
    const onMessageEdited    = (p: WsMessageEdited)    => cbRef.current.onMessageEdited?.(p);
    const onMessageDeleted   = (p: WsMessageDeleted)   => cbRef.current.onMessageDeleted?.(p);
    const onReactionUpdated  = (p: WsReactionUpdated)  => cbRef.current.onReactionUpdated?.(p);
    /* Appels */
    const onCallIncoming     = (p: WsCallIncoming)     => cbRef.current.onCallIncoming?.(p);
    const onCallAccepted     = (p: any)                => cbRef.current.onCallAccepted?.(p);
    const onCallRejected     = (p: any)                => cbRef.current.onCallRejected?.(p);
    const onCallEnded        = (p: any)                => cbRef.current.onCallEnded?.(p);
    const onCallOffer        = (p: WsCallSignal)       => cbRef.current.onCallOffer?.(p);
    const onCallAnswer       = (p: WsCallSignal)       => cbRef.current.onCallAnswer?.(p);
    const onCallIce          = (p: WsCallSignal)       => cbRef.current.onCallIceCandidate?.(p);
    const onCallBusy                = (p: any) => cbRef.current.onCallBusy?.(p);
    /* Groupe */
    const onGrpIncoming             = (p: any) => cbRef.current.onGroupCallIncoming?.(p);
    const onGrpJoined               = (p: any) => cbRef.current.onGroupCallJoined?.(p);
    const onGrpParticipantJoined    = (p: any) => cbRef.current.onGroupCallParticipantJoined?.(p);
    const onGrpParticipantLeft      = (p: any) => cbRef.current.onGroupCallParticipantLeft?.(p);
    const onGrpDeclined             = (p: any) => cbRef.current.onGroupCallDeclined?.(p);
    const onGrpEnded                = (p: any) => cbRef.current.onGroupCallEnded?.(p);
    const onGrpOffer                = (p: any) => cbRef.current.onGroupCallOffer?.(p);
    const onGrpAnswer               = (p: any) => cbRef.current.onGroupCallAnswer?.(p);
    const onGrpIce                  = (p: any) => cbRef.current.onGroupCallIceCandidate?.(p);
    const onGrpMediaToggled         = (p: any) => cbRef.current.onGroupCallMediaToggled?.(p);

    socket.on('connect',            onConnect);
    socket.on('disconnect',         onDisconnect);
    socket.on('new_message',        onNewMessage);
    socket.on('message_delivered',  onMessageDelivered);
    socket.on('message_read',       onMessageRead);
    socket.on('typing',             onTyping);
    socket.on('presence',           onPresence);
    socket.on('message_edited',     onMessageEdited);
    socket.on('message_deleted',    onMessageDeleted);
    socket.on('reaction_updated',   onReactionUpdated);
    socket.on('call:incoming',      onCallIncoming);
    socket.on('call:accepted',      onCallAccepted);
    socket.on('call:rejected',      onCallRejected);
    socket.on('call:ended',         onCallEnded);
    socket.on('call:offer',         onCallOffer);
    socket.on('call:answer',        onCallAnswer);
    socket.on('call:ice-candidate', onCallIce);
    socket.on('call:busy',                   onCallBusy);
    socket.on('group_call:incoming',          onGrpIncoming);
    socket.on('group_call:joined',            onGrpJoined);
    socket.on('group_call:participant_joined',onGrpParticipantJoined);
    socket.on('group_call:participant_left',  onGrpParticipantLeft);
    socket.on('group_call:participant_declined', onGrpDeclined);
    socket.on('group_call:ended',             onGrpEnded);
    socket.on('group_call:offer',             onGrpOffer);
    socket.on('group_call:answer',            onGrpAnswer);
    socket.on('group_call:ice_candidate',     onGrpIce);
    socket.on('group_call:media_toggled',     onGrpMediaToggled);

    if (!socket.connected) socket.connect();

    return () => {
      socket.off('connect',            onConnect);
      socket.off('disconnect',         onDisconnect);
      socket.off('connect_error',      onConnectError);
      socket.off('new_message',        onNewMessage);
      socket.off('message_delivered',  onMessageDelivered);
      socket.off('message_read',       onMessageRead);
      socket.off('typing',             onTyping);
      socket.off('presence',           onPresence);
      socket.off('message_edited',     onMessageEdited);
      socket.off('message_deleted',    onMessageDeleted);
      socket.off('reaction_updated',   onReactionUpdated);
      socket.off('call:incoming',      onCallIncoming);
      socket.off('call:accepted',      onCallAccepted);
      socket.off('call:rejected',      onCallRejected);
      socket.off('call:ended',         onCallEnded);
      socket.off('call:offer',         onCallOffer);
      socket.off('call:answer',        onCallAnswer);
      socket.off('call:ice-candidate', onCallIce);
      socket.off('call:busy',                    onCallBusy);
      socket.off('group_call:incoming',           onGrpIncoming);
      socket.off('group_call:joined',             onGrpJoined);
      socket.off('group_call:participant_joined', onGrpParticipantJoined);
      socket.off('group_call:participant_left',   onGrpParticipantLeft);
      socket.off('group_call:participant_declined', onGrpDeclined);
      socket.off('group_call:ended',              onGrpEnded);
      socket.off('group_call:offer',              onGrpOffer);
      socket.off('group_call:answer',             onGrpAnswer);
      socket.off('group_call:ice_candidate',      onGrpIce);
      socket.off('group_call:media_toggled',      onGrpMediaToggled);
      if (heartbeatId.current) clearInterval(heartbeatId.current);
    };
  }, []); // Socket singleton — ne se recréé pas à chaque render

  // ── Actions exposées au composant ─────────────────────────

  const joinConv = useCallback((conversationId: string) => {
    socketRef.current?.emit('join_conv', { conversationId });
  }, []);

  const leaveConv = useCallback((conversationId: string) => {
    socketRef.current?.emit('leave_conv', { conversationId });
  }, []);

  const sendTyping = useCallback((
    conversationId: string,
    activity: WsTyping['activity'],
  ) => {
    socketRef.current?.emit('typing', { conversationId, activity });
  }, []);

  const markRead = useCallback((conversationId: string) => {
    socketRef.current?.emit('mark_read', { conversationId });
  }, []);

  const isConnected = useCallback(
    () => socketRef.current?.connected ?? false,
    [],
  );

  return { joinConv, leaveConv, sendTyping, markRead, isConnected, socketConnected: connected };
}

/**
 * Accès direct au singleton Socket.IO pour les modules externes
 * (ex: useAudioCall) qui ont besoin d'émettre des événements sans
 * passer par un hook React.
 */
export function getActiveSocket(): Socket | null { return _socket; }

/**
 * Initialise (ou réutilise) le socket global sans monter le hook React complet.
 * À appeler depuis GlobalCallProvider pour garantir que le socket est connecté
 * même quand l'utilisateur n'est pas sur la page messagerie.
 */
export function initGlobalSocket(): void {
  const token = localStorage.getItem('shopi_access_token');
  if (!token) return;
  getSocket(token); // crée ou réutilise le singleton
}
