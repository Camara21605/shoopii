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
  /* Appels audio */
  onCallIncoming?:     (payload: WsCallIncoming)     => void;
  onCallAccepted?:     (payload: { conversationId: string; calleeUserId: string }) => void;
  onCallRejected?:     (payload: { conversationId: string }) => void;
  onCallEnded?:        (payload: { conversationId: string }) => void;
  onCallOffer?:        (payload: WsCallSignal)       => void;
  onCallAnswer?:       (payload: WsCallSignal)       => void;
  onCallIceCandidate?: (payload: WsCallSignal)       => void;
  onCallBusy?:         (payload: { conversationId: string }) => void;
  onConnected?:        () => void;
  onDisconnected?:     () => void;
}

// ── Singleton socket (une connexion globale par session) ──────

let _socket: Socket | null = null;
let _token:  string | null = null;

function getSocket(token: string): Socket {
  /*
   * Réutiliser le socket existant si :
   *   - même token ET
   *   - socket non explicitement déconnecté
   *
   * POURQUOI !_socket.disconnected plutôt que _socket.connected :
   *   _socket.connected = true  seulement APRÈS l'établissement complet
   *   _socket.disconnected = false pendant TOUTE la phase de connexion
   *
   *   React 19 Strict Mode double-invoque les effects.
   *   Sans ce fix : le 2ème appel voit connected=false (connexion en cours),
   *   déconnecte le socket → "WebSocket closed before established".
   *   Avec !disconnected : on réutilise le socket en cours de connexion.
   */
  if (_socket && token === _token && !_socket.disconnected) return _socket;

  // Déconnecte l'ancien socket si le token a changé ou socket mort
  if (_socket) { _socket.disconnect(); _socket = null; }

  _token  = token;
  _socket = io(`${SOCKET_URL}/messaging`, {
    auth:             { token },
    transports:       ['websocket', 'polling'],
    reconnection:     true,
    reconnectionDelay: RECONNECT_DELAY,
    timeout:          10_000,
  });

  return _socket;
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

    const onDisconnect = () => {
      setConnected(false);
      cbRef.current.onDisconnected?.();
      if (heartbeatId.current) { clearInterval(heartbeatId.current); heartbeatId.current = null; }
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
    /* Appels */
    const onCallIncoming     = (p: WsCallIncoming)     => cbRef.current.onCallIncoming?.(p);
    const onCallAccepted     = (p: any)                => cbRef.current.onCallAccepted?.(p);
    const onCallRejected     = (p: any)                => cbRef.current.onCallRejected?.(p);
    const onCallEnded        = (p: any)                => cbRef.current.onCallEnded?.(p);
    const onCallOffer        = (p: WsCallSignal)       => cbRef.current.onCallOffer?.(p);
    const onCallAnswer       = (p: WsCallSignal)       => cbRef.current.onCallAnswer?.(p);
    const onCallIce          = (p: WsCallSignal)       => cbRef.current.onCallIceCandidate?.(p);
    const onCallBusy         = (p: any)                => cbRef.current.onCallBusy?.(p);

    socket.on('connect',            onConnect);
    socket.on('disconnect',         onDisconnect);
    socket.on('new_message',        onNewMessage);
    socket.on('message_delivered',  onMessageDelivered);
    socket.on('message_read',       onMessageRead);
    socket.on('typing',             onTyping);
    socket.on('presence',           onPresence);
    socket.on('message_edited',     onMessageEdited);
    socket.on('message_deleted',    onMessageDeleted);
    socket.on('call:incoming',      onCallIncoming);
    socket.on('call:accepted',      onCallAccepted);
    socket.on('call:rejected',      onCallRejected);
    socket.on('call:ended',         onCallEnded);
    socket.on('call:offer',         onCallOffer);
    socket.on('call:answer',        onCallAnswer);
    socket.on('call:ice-candidate', onCallIce);
    socket.on('call:busy',          onCallBusy);

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
      socket.off('call:incoming',      onCallIncoming);
      socket.off('call:accepted',      onCallAccepted);
      socket.off('call:rejected',      onCallRejected);
      socket.off('call:ended',         onCallEnded);
      socket.off('call:offer',         onCallOffer);
      socket.off('call:answer',        onCallAnswer);
      socket.off('call:ice-candidate', onCallIce);
      socket.off('call:busy',          onCallBusy);
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
