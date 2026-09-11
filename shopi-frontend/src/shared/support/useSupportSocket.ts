/**
 * ============================================================
 * FICHIER : src/shared/support/useSupportSocket.ts
 *
 * RÔLE : Hook Socket.IO pour le namespace /support — fil de
 *        discussion d'un ticket EN TEMPS RÉEL ("la communication
 *        doit être instantanée"). Avant ce hook, seule la
 *        notification-bell (useNotificationSocket) existait : un
 *        agent ou un client avec le fil déjà ouvert à l'écran ne
 *        voyait jamais arriver un nouveau message sans fermer/
 *        rouvrir ou recharger la page.
 *
 * PATTERN : Singleton par token — identique à useNotificationSocket.ts
 *   / useSocket.ts (messagerie). Voir ces fichiers pour le détail des
 *   choix de conception (objet Socket jamais recréé, `auth` en
 *   fonction, reconnexion forcée après rejet serveur).
 *
 * EVENTS REÇUS :
 *   connected              → { userId, socketId }  (handshake)
 *   support:new_message    → { ticketId, message }
 *   support:ticket_updated → { ticketId, status?, priority?, agentId? }
 *
 * EVENTS ÉMIS :
 *   join_ticket   { ticketId } — à l'ouverture du fil
 *   leave_ticket  { ticketId } — à la fermeture
 * ============================================================
 */

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { tokenStorage, silentRefresh } from '../services/apiFetch';

const SOCKET_URL =
  ((import.meta as any).env?.VITE_API_URL as string | undefined)?.replace('/api', '') ??
  'http://localhost:3001';

// ── Types WS ──────────────────────────────────────────────────

export interface WsSupportMessage {
  ticketId: string;
  message: {
    id:         string;
    ticketId:   string;
    content:    string;
    senderType: string;
    senderId:   string;
    senderName: string;
    isInternal: boolean;
    createdAt:  string;
  };
}

export interface WsSupportTicketUpdated {
  ticketId: string;
  status?:   string;
  priority?: string;
  agentId?:  string | null;
}

export interface SupportSocketCallbacks {
  onNewMessage?:    (data: WsSupportMessage)        => void;
  onTicketUpdated?: (data: WsSupportTicketUpdated)  => void;
}

// ── Singleton — même design que useNotificationSocket.ts ───────

let _socket: Socket | null = null;
let _recovering = false;

function getSocket(token: string): Socket {
  if (_socket) {
    if (_socket.disconnected) _socket.connect();
    return _socket;
  }

  _socket = io(`${SOCKET_URL}/support`, {
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
  } finally {
    _recovering = false;
  }
}

// ── Hook ──────────────────────────────────────────────────────

/**
 * @param ticketId  Ticket actuellement affiché — rejoint sa room à
 *                   l'ouverture, la quitte au démontage/changement.
 *                   `null` = pas de ticket ouvert (aucune room jointe).
 */
export function useSupportSocket(ticketId: string | null, callbacks: SupportSocketCallbacks) {
  const cbRef = useRef<SupportSocketCallbacks>(callbacks);
  useEffect(() => { cbRef.current = callbacks; });

  const [authTick, setAuthTick] = useState(0);
  useEffect(() => {
    const bump = () => setAuthTick(t => t + 1);
    window.addEventListener('auth:login', bump);
    return () => window.removeEventListener('auth:login', bump);
  }, []);

  // ── Connexion + listeners globaux au namespace ────────────
  useEffect(() => {
    const token = localStorage.getItem('shopi_access_token');
    if (!token) return;

    const socket = getSocket(token);

    const onNewMessage    = (d: WsSupportMessage)       => cbRef.current.onNewMessage?.(d);
    const onTicketUpdated = (d: WsSupportTicketUpdated) => cbRef.current.onTicketUpdated?.(d);
    const onConnectError  = (err: Error) => console.warn('[SupportSocket] Connexion échouée:', err.message);
    const onDisconnect    = (reason: string) => {
      if (reason === 'io server disconnect') void recoverFromServerDisconnect();
    };

    socket.on('support:new_message',    onNewMessage);
    socket.on('support:ticket_updated', onTicketUpdated);
    socket.on('connect_error',          onConnectError);
    socket.on('disconnect',             onDisconnect);

    if (!socket.connected) socket.connect();

    return () => {
      socket.off('support:new_message',    onNewMessage);
      socket.off('support:ticket_updated', onTicketUpdated);
      socket.off('connect_error',          onConnectError);
      socket.off('disconnect',             onDisconnect);
    };
  }, [authTick]);

  // ── Rejoint/quitte la room du ticket affiché ───────────────
  useEffect(() => {
    if (!ticketId) return;
    const token = localStorage.getItem('shopi_access_token');
    if (!token) return;

    const socket = getSocket(token);
    const join = () => socket.emit('join_ticket', { ticketId });

    if (socket.connected) join();
    socket.on('connect', join);

    return () => {
      socket.off('connect', join);
      socket.emit('leave_ticket', { ticketId });
    };
  }, [ticketId]);
}
