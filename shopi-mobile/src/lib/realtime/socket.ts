/**
 * Connexion temps réel (messagerie, appels, présence) — namespace /messaging.
 *
 * `auth` est une FONCTION : Socket.IO la ré-évalue à chaque (re)connexion,
 * donc après un refresh de token le prochain essai utilise le token frais
 * sans recréer le socket.
 */
import { io, type Socket } from 'socket.io-client';

import { env } from '@/config/env';
import { apiFetch } from '@/lib/api/client';
import { tokenStore } from '@/lib/api/token-store';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectRealtime(): Socket {
  if (socket) return socket;

  socket = io(`${env.socketUrl}/messaging`, {
    transports: ['websocket'], // WebSocket direct : pas de handshake polling, plus rapide
    auth: (cb) => cb({ token: tokenStore.getAccessToken() }),
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    timeout: 10_000,
  });

  /* Le serveur rejette un token expiré via l'événement `error` puis coupe.
   * On force un refresh (via un appel authentifié léger) puis on se reconnecte. */
  socket.on('error', (payload: { code?: string }) => {
    if (payload?.code === 'TOKEN_INVALID' || payload?.code === 'TOKEN_MISSING') {
      apiFetch('/auth/me')
        .then(() => socket?.connect())
        .catch(() => undefined);
    }
  });

  return socket;
}

export function disconnectRealtime() {
  socket?.disconnect();
  socket = null;
}
