/**
 * Présence connue des autres utilisateurs (un seul endroit pour toute
 * l'appli) : alimentée par les listes (conversations, groupes…), les
 * vérifications et l'événement socket `presence`.
 *
 * « Joignable » a une date d'expiration (reachableUntil) : passé ce délai
 * sans nouveau signe du téléphone, l'état devient « hors ligne » tout seul,
 * même sans nouvel événement (voir effectiveStatus).
 */
import { create } from 'zustand';

import type { PresenceStatus, PresenceView } from './api';

export type PresenceEntry = {
  status: PresenceStatus;
  lastSeen: string | null;
  reachableUntil: string | null;
  /** Vérification silencieuse en cours (le téléphone n'a pas encore répondu). */
  checkingUntil: number | null;
  at: number;
};

type State = { byUser: Record<string, PresenceEntry> };

export const usePresenceStore = create<State>(() => ({ byUser: {} }));

const CHECK_MS = 16_000;

export function ingestPresence(userId: string | null | undefined, v: Omit<Partial<PresenceView>, 'status'> & { status?: PresenceStatus | null }, opts: { checking?: boolean } = {}) {
  if (!userId || !v.status) return;
  const prev = usePresenceStore.getState().byUser[userId];
  const entry: PresenceEntry = {
    status: v.status,
    lastSeen: v.status === 'online' ? null : (v.lastSeen ?? prev?.lastSeen ?? null),
    reachableUntil: v.status === 'reachable' ? (v.reachableUntil ?? null) : null,
    /* Le résultat de la vérification arrive en direct ; un état « en ligne » la termine. */
    checkingUntil: opts.checking && v.status !== 'online' ? Date.now() + CHECK_MS : v.status === 'online' ? null : (prev?.checkingUntil ?? null),
    at: Date.now(),
  };
  if (prev && prev.status === entry.status && prev.lastSeen === entry.lastSeen && prev.reachableUntil === entry.reachableUntil && prev.checkingUntil === entry.checkingUntil) return;
  usePresenceStore.setState((s) => ({ byUser: { ...s.byUser, [userId]: entry } }));
}

/** Événement temps réel : il termine aussi une vérification en cours. */
export function ingestRealtime(p: { userId: string; online: boolean; lastSeen?: string | null; status?: PresenceStatus; reachableUntil?: string | null }) {
  const status: PresenceStatus = p.status ?? (p.online ? 'online' : 'offline');
  ingestPresence(p.userId, { status, lastSeen: p.lastSeen ?? null, reachableUntil: p.reachableUntil ?? null });
  const cur = usePresenceStore.getState().byUser[p.userId];
  if (cur?.checkingUntil) usePresenceStore.setState((s) => ({ byUser: { ...s.byUser, [p.userId]: { ...cur, checkingUntil: null } } }));
}

/** État réel à l'instant `now` : un « joignable » expiré redevient « hors ligne ». */
export function effectiveStatus(e: Pick<PresenceEntry, 'status' | 'reachableUntil'> | null | undefined, now = Date.now()): PresenceStatus {
  if (!e) return 'offline';
  if (e.status === 'reachable' && e.reachableUntil && Date.parse(e.reachableUntil) < now) return 'offline';
  return e.status;
}
