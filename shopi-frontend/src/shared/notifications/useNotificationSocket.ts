/**
 * ============================================================
 * FICHIER : src/shared/notifications/useNotificationSocket.ts
 *
 * RÔLE : Hook Socket.IO pour le namespace /notifications.
 *
 * PATTERN : Singleton par token — identique à useSocket.ts
 *   (messagerie) pour garantir une seule connexion même si
 *   plusieurs composants utilisent le hook.
 *
 * EVENTS REÇUS :
 *   notif:connected    → { unreadCount }  (handshake)
 *   notif:new          → { notification, unreadCount }
 *   notif:unread_count → { unreadCount }
 *
 * EVENTS ÉMIS :
 *   notif:mark_read    → { notificationId }
 *   notif:mark_all_read (no data)
 * ============================================================
 */

import { useEffect, useRef } from 'react';
import { io, Socket }        from 'socket.io-client';
import type { INotificationDto } from './types';

const SOCKET_URL =
  ((import.meta as any).env?.VITE_API_URL as string | undefined)?.replace('/api', '') ??
  'http://localhost:3001';

// ── Types WS ──────────────────────────────────────────────────

export interface WsNotifConnected  { unreadCount: number; }
export interface WsNotifNew        { notification: INotificationDto; unreadCount: number; }
export interface WsNotifUnreadCount { unreadCount: number; }

export interface WsNotifUpdated { id: string; count: number; body: string; }

export interface NotificationSocketCallbacks {
  onConnected?:   (data: WsNotifConnected)   => void;
  onNew?:         (data: WsNotifNew)          => void;
  onUnreadCount?: (data: WsNotifUnreadCount)  => void;
  onUpdated?:     (data: WsNotifUpdated)      => void;
}

// ── Singleton ─────────────────────────────────────────────────

let _socket: Socket | null = null;
let _token:  string | null = null;

function getSocket(token: string): Socket {
  if (_socket && token === _token && !_socket.disconnected) return _socket;
  if (_socket) { _socket.disconnect(); _socket = null; }

  _token  = token;
  _socket = io(`${SOCKET_URL}/notifications`, {
    auth:              { token },
    transports:        ['websocket', 'polling'],
    reconnection:      true,
    reconnectionDelay: 2_000,
    timeout:           10_000,
  });

  return _socket;
}

// ── Hook ──────────────────────────────────────────────────────

export function useNotificationSocket(callbacks: NotificationSocketCallbacks) {
  const cbRef    = useRef<NotificationSocketCallbacks>(callbacks);
  const socketRef = useRef<Socket | null>(null);

  // Mise à jour des callbacks sans recréer le socket
  useEffect(() => { cbRef.current = callbacks; });

  useEffect(() => {
    const token = localStorage.getItem('shopi_access_token');
    if (!token) return;

    const socket = getSocket(token);
    socketRef.current = socket;

    const onConnected   = (d: WsNotifConnected)   => cbRef.current.onConnected?.(d);
    const onNew         = (d: WsNotifNew)          => cbRef.current.onNew?.(d);
    const onUnreadCount = (d: WsNotifUnreadCount)  => cbRef.current.onUnreadCount?.(d);
    const onUpdated     = (d: WsNotifUpdated)      => cbRef.current.onUpdated?.(d);

    const onConnectError = (err: Error) =>
      console.warn('[NotifSocket] Connexion échouée:', err.message);

    // ⚠️ Noms exacts des événements backend (notification.gateway.ts)
    socket.on('connected',          onConnected);   // gateway émet 'connected' (pas 'notif:connected')
    socket.on('notif:new',          onNew);
    socket.on('notif:unread_count', onUnreadCount);
    socket.on('notif:updated',      onUpdated);
    socket.on('connect_error',      onConnectError);

    if (!socket.connected) socket.connect();

    return () => {
      socket.off('connected',          onConnected);
      socket.off('notif:new',          onNew);
      socket.off('notif:unread_count', onUnreadCount);
      socket.off('notif:updated',      onUpdated);
      socket.off('connect_error',      onConnectError);
    };
  }, []); // Singleton — jamais recréé

  // ── Émetteurs ─────────────────────────────────────────────

  // ⚠️ Noms exacts attendus par le gateway (SubscribeMessage dans notification.gateway.ts)
  const markRead = (id: string) => socketRef.current?.emit('notif:read', { id });

  const markAllRead = () => socketRef.current?.emit('notif:read_all');

  return { markRead, markAllRead };
}
