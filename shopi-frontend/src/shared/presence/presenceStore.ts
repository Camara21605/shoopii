/* ============================================================
 * FICHIER : src/shared/presence/presenceStore.ts
 *
 * Présence à trois états, un seul endroit pour tout le site :
 *   online    — dans l'application ou sur le site en ce moment ;
 *   reachable — application téléphone FERMÉE, mais téléphone connecté à
 *               internet (il s'est manifesté au serveur il y a peu) ;
 *   offline   — pas de connexion (données coupées, téléphone éteint…).
 *
 * Alimenté par la messagerie (listes), les vérifications (POST
 * /presence/probe, GET /presence/actor/…) et l'événement socket `presence`.
 * Suivi en direct de personnes qui ne sont pas des contacts : 'presence:watch'
 * (liste agrégée de tous les composants montés, renvoyée à la reconnexion).
 * « Joignable » expire tout seul (reachableUntil) sans nouvel événement.
 * ============================================================ */

import { useSyncExternalStore } from 'react';

import { getActiveSocket } from '../messagerie/hooks/useSocket';

export type PresenceStatus = 'online' | 'reachable' | 'offline';

export interface PresenceEntry {
  status: PresenceStatus;
  lastSeen: string | null;
  reachableUntil: string | null;
  checkingUntil: number | null;
}

export interface PresenceInput {
  status?: PresenceStatus | null;
  lastSeen?: string | null;
  reachableUntil?: string | null;
}

const CHECK_MS = 16_000;
let byUser: Record<string, PresenceEntry> = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export function subscribe(l: () => void) {
  listeners.add(l);
  ensureSocketListener();
  return () => { listeners.delete(l); };
}

export function usePresenceEntry(userId: string | null | undefined): PresenceEntry | undefined {
  return useSyncExternalStore(subscribe, () => (userId ? byUser[userId] : undefined));
}

export function ingestPresence(userId: string | null | undefined, v: PresenceInput, opts: { checking?: boolean } = {}) {
  if (!userId || !v.status) return;
  const prev = byUser[userId];
  const next: PresenceEntry = {
    status: v.status,
    lastSeen: v.status === 'online' ? null : (v.lastSeen ?? prev?.lastSeen ?? null),
    reachableUntil: v.status === 'reachable' ? (v.reachableUntil ?? null) : null,
    checkingUntil: opts.checking && v.status !== 'online' ? Date.now() + CHECK_MS : v.status === 'online' ? null : (prev?.checkingUntil ?? null),
  };
  if (prev && prev.status === next.status && prev.lastSeen === next.lastSeen && prev.reachableUntil === next.reachableUntil && prev.checkingUntil === next.checkingUntil) return;
  byUser = { ...byUser, [userId]: next };
  emit();
}

export interface WsPresencePayload {
  userId: string;
  online: boolean;
  lastSeen?: string | null;
  status?: PresenceStatus;
  reachableUntil?: string | null;
}

/** Événement temps réel : met à jour et termine une vérification en cours. */
export function ingestRealtime(p: WsPresencePayload) {
  if (!p?.userId) return;
  ingestPresence(p.userId, { status: p.status ?? (p.online ? 'online' : 'offline'), lastSeen: p.lastSeen ?? null, reachableUntil: p.reachableUntil ?? null });
  const cur = byUser[p.userId];
  if (cur?.checkingUntil) { byUser = { ...byUser, [p.userId]: { ...cur, checkingUntil: null } }; emit(); }
}

/** État réel à l'instant `now` : un « joignable » expiré redevient « hors ligne ». */
export function effectiveStatus(e: Pick<PresenceEntry, 'status' | 'reachableUntil'> | null | undefined, now = Date.now()): PresenceStatus {
  if (!e) return 'offline';
  if (e.status === 'reachable' && e.reachableUntil && Date.parse(e.reachableUntil) < now) return 'offline';
  return e.status;
}

// ── Socket : présence en direct + liste suivie ─────────────────

let attachedTo: unknown = null;
const watchCounts = new Map<string, number>();
let watchTimer: ReturnType<typeof setTimeout> | null = null;

function ensureSocketListener() {
  const socket = getActiveSocket();
  if (!socket || attachedTo === socket) return;
  attachedTo = socket;
  socket.on('presence', ingestRealtime);
  socket.on('connect', flushWatch);
}

function flushWatch() {
  watchTimer = null;
  ensureSocketListener();
  const socket = getActiveSocket();
  if (!socket?.connected) return;
  socket.emit('presence:watch', { userIds: Array.from(watchCounts.keys()).slice(0, 50) }, (ack?: Record<string, PresenceInput>) => {
    if (ack && typeof ack === 'object') for (const [id, v] of Object.entries(ack)) ingestPresence(id, v);
  });
}

export function watchPresence(userId: string): () => void {
  watchCounts.set(userId, (watchCounts.get(userId) ?? 0) + 1);
  if (!watchTimer) watchTimer = setTimeout(flushWatch, 250);
  return () => {
    const n = (watchCounts.get(userId) ?? 1) - 1;
    if (n <= 0) watchCounts.delete(userId); else watchCounts.set(userId, n);
    if (!watchTimer) watchTimer = setTimeout(flushWatch, 250);
  };
}
