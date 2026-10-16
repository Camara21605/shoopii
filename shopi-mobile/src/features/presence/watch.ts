/**
 * Suivi en direct de la présence de personnes qui ne sont pas des contacts
 * (profil public, nouvelle conversation) : le serveur garde UNE liste par
 * socket ('presence:watch'), donc on agrège ici les demandes de tous les
 * écrans ouverts (compteur par personne) et on renvoie la liste complète,
 * regroupée, à chaque changement et à chaque reconnexion.
 */
import { getSocket } from '@/lib/realtime/socket';

import { ingestPresence } from './store';
import type { PresenceStatus } from './api';

const counts = new Map<string, number>();
let timer: ReturnType<typeof setTimeout> | null = null;

type Ack = Record<string, { status: PresenceStatus; lastSeen: string | null; reachableUntil: string | null }>;

export function flushWatch() {
  timer = null;
  const socket = getSocket();
  if (!socket?.connected) return;
  const ids = Array.from(counts.keys()).slice(0, 50);
  socket.emit('presence:watch', { userIds: ids }, (ack: Ack | undefined) => {
    if (!ack || typeof ack !== 'object') return;
    for (const [id, v] of Object.entries(ack)) ingestPresence(id, v);
  });
}

function schedule() {
  if (timer) return;
  timer = setTimeout(flushWatch, 250);
}

export function watchPresence(userId: string): () => void {
  counts.set(userId, (counts.get(userId) ?? 0) + 1);
  schedule();
  return () => {
    const n = (counts.get(userId) ?? 1) - 1;
    if (n <= 0) counts.delete(userId);
    else counts.set(userId, n);
    schedule();
  };
}
