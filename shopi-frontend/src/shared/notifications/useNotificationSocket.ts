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
 *   story:viewed       → { storyId, productId, viewsCount } (compteur de vues story en direct)
 *
 * EVENTS ÉMIS :
 *   notif:mark_read    → { notificationId }
 *   notif:mark_all_read (no data)
 * ============================================================
 */

import { useEffect, useRef, useState } from 'react';
import { io, Socket }        from 'socket.io-client';
import type { INotificationDto } from './types';
import { tokenStorage, silentRefresh } from '../services/apiFetch';

const SOCKET_URL =
  ((import.meta as any).env?.VITE_API_URL as string | undefined)?.replace('/api', '') ??
  'http://localhost:3001';

// ── Types WS ──────────────────────────────────────────────────

export interface WsNotifConnected  { unreadCount: number; }
export interface WsNotifNew        { notification: INotificationDto; unreadCount: number; }
export interface WsNotifUnreadCount { unreadCount: number; }

export interface WsNotifUpdated { id: string; count: number; body: string; }

export interface WsStoryViewed { storyId: string; productId: string; viewsCount: number; }

/** Émis par le backend quand une nouvelle connexion sur un autre
 *  appareil révoque la session courante (session unique par
 *  utilisateur — voir SessionService côté backend). */
export interface WsSessionRevoked {
  reason:  'NEW_LOGIN' | 'USER_LOGOUT';
  message: string;
}

export interface NotificationSocketCallbacks {
  onConnected?:      (data: WsNotifConnected)   => void;
  onNew?:            (data: WsNotifNew)          => void;
  onUnreadCount?:    (data: WsNotifUnreadCount)  => void;
  onUpdated?:        (data: WsNotifUpdated)      => void;
  onSessionRevoked?: (data: WsSessionRevoked)     => void;
  onStoryViewed?:    (data: WsStoryViewed)        => void;
}

// ── Singleton ─────────────────────────────────────────────────

/*
 * Même design que useSocket.ts (messagerie) — voir les commentaires
 * détaillés là-bas. Résumé : objet Socket unique et jamais recréé
 * (sinon les listeners posés par useNotificationSocket restent liés à
 * l'ancien objet abandonné après un changement de token) ; `auth` en
 * fonction pour toujours relire le token le plus frais ; reconnexion
 * manuelle forcée après un rejet serveur (TOKEN_INVALID), car Socket.IO
 * ne reconnecte jamais tout seul quand la déconnexion est initiée par
 * le serveur (reason === 'io server disconnect').
 */
let _socket: Socket | null = null;
let _recovering = false;

function getSocket(token: string): Socket {
  if (_socket) {
    if (_socket.disconnected) _socket.connect();
    return _socket;
  }

  _socket = io(`${SOCKET_URL}/notifications`, {
    auth: (cb: (data: { token: string }) => void) =>
      cb({ token: tokenStorage.get() ?? token }),
    transports:        ['websocket', 'polling'],
    reconnection:      true,
    reconnectionDelay: 2_000,
    timeout:           10_000,
  });

  return _socket;
}

async function recoverFromServerDisconnect(): Promise<void> {
  if (_recovering) return;
  _recovering = true;
  try {
    const refreshed = await silentRefresh();
    if (refreshed) {
      const freshToken = tokenStorage.get();
      if (freshToken) getSocket(freshToken);
    }
    /* Refresh échoué : pas de redirect /login ici (contrairement à
     * useSocket.ts) — plusieurs hooks socket tournent en parallèle,
     * seul l'échec du refresh sur la messagerie doit décider de la
     * redirection pour éviter des redirects concurrents en double. */
  } finally {
    _recovering = false;
  }
}

/** Ferme et efface le socket singleton — à appeler au logout, ou avant un
 *  switch de compte "Mon espace" (nouvelle identité = nouveau handshake
 *  requis, un socket déjà connecté ne se ré-authentifie pas tout seul —
 *  voir disconnectGlobalSocket() dans useSocket.ts pour le même besoin
 *  côté messagerie). */
export function disconnectNotificationSocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}

/**
 * Initialise (ou réutilise) le socket notifications sans monter le hook
 * React complet — miroir de initGlobalSocket() (useSocket.ts). Utile après
 * un disconnectNotificationSocket() explicite (switch de compte) pour
 * rouvrir immédiatement une connexion sous la nouvelle identité, sans
 * attendre qu'un composant utilisant useNotificationSocket() remonte.
 */
export function initNotificationSocket(): void {
  const token = localStorage.getItem('shopi_access_token');
  if (!token) return;
  getSocket(token);
}

// ── Hook ──────────────────────────────────────────────────────

export function useNotificationSocket(callbacks: NotificationSocketCallbacks) {
  const cbRef    = useRef<NotificationSocketCallbacks>(callbacks);
  const socketRef = useRef<Socket | null>(null);

  // Mise à jour des callbacks sans recréer le socket
  useEffect(() => { cbRef.current = callbacks; });

  /* Re-déclenche l'effet de connexion ci-dessous quand un token apparaît
   * APRÈS le montage de ce composant (ex: AppProvider est monté une seule
   * fois pour toute la durée de vie de l'app, souvent AVANT que
   * l'utilisateur soit connecté — sans ce compteur, son effet ci-dessous
   * s'exécutait une fois avec `!token` et ne se relançait plus jamais,
   * donc onSessionRevoked ne s'attachait jamais réellement au socket).
   * tokenStorage.set() (apiFetch.ts) émet 'auth:login' à chaque login/
   * register/refresh réussi. */
  const [authTick, setAuthTick] = useState(0);
  useEffect(() => {
    const bump = () => setAuthTick(t => t + 1);
    window.addEventListener('auth:login', bump);
    return () => window.removeEventListener('auth:login', bump);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('shopi_access_token');
    if (!token) return;

    const socket = getSocket(token);
    socketRef.current = socket;

    const onConnected      = (d: WsNotifConnected)   => cbRef.current.onConnected?.(d);
    const onNew            = (d: WsNotifNew)          => cbRef.current.onNew?.(d);
    const onUnreadCount    = (d: WsNotifUnreadCount)  => cbRef.current.onUnreadCount?.(d);
    const onUpdated        = (d: WsNotifUpdated)      => cbRef.current.onUpdated?.(d);
    const onSessionRevoked = (d: WsSessionRevoked)    => cbRef.current.onSessionRevoked?.(d);
    const onStoryViewed    = (d: WsStoryViewed)        => cbRef.current.onStoryViewed?.(d);

    const onConnectError = (err: Error) =>
      console.warn('[NotifSocket] Connexion échouée:', err.message);

    const onDisconnect = (reason: string) => {
      // Rejet serveur (token invalide/expiré) → pas de reconnexion auto
      // par Socket.IO dans ce cas précis. Voir recoverFromServerDisconnect.
      if (reason === 'io server disconnect') {
        void recoverFromServerDisconnect();
      }
    };

    // ⚠️ Noms exacts des événements backend (notification.gateway.ts)
    socket.on('connected',          onConnected);   // gateway émet 'connected' (pas 'notif:connected')
    socket.on('notif:new',          onNew);
    socket.on('notif:unread_count', onUnreadCount);
    socket.on('notif:updated',      onUpdated);
    socket.on('session:revoked',    onSessionRevoked);
    socket.on('story:viewed',       onStoryViewed);
    socket.on('connect_error',      onConnectError);
    socket.on('disconnect',         onDisconnect);

    if (!socket.connected) socket.connect();

    return () => {
      socket.off('connected',          onConnected);
      socket.off('notif:new',          onNew);
      socket.off('notif:unread_count', onUnreadCount);
      socket.off('notif:updated',      onUpdated);
      socket.off('session:revoked',    onSessionRevoked);
      socket.off('story:viewed',       onStoryViewed);
      socket.off('connect_error',      onConnectError);
      socket.off('disconnect',         onDisconnect);
    };
  }, [authTick]); // authTick : re-tente la connexion si le token n'existait pas au montage

  // ── Émetteurs ─────────────────────────────────────────────

  // ⚠️ Noms exacts attendus par le gateway (SubscribeMessage dans notification.gateway.ts)
  const markRead = (id: string) => socketRef.current?.emit('notif:read', { id });

  const markAllRead = () => socketRef.current?.emit('notif:read_all');

  return { markRead, markAllRead };
}
