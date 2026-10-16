/* ============================================================
 * FICHIER : src/shared/presence/usePresence.ts
 *
 * usePresence(userId, { probe })  — état en direct d'une personne ;
 * useKnownPresence(userId, list)   — listes (contacts déjà prévenus en direct) ;
 * useActorPresence(type, id)       — propriétaire d'un profil public.
 * `probe` (conversation / profil ouverts, compte connecté) : le serveur
 * vérifie en silence si le téléphone est joignable — résultat en direct.
 * ============================================================ */

import { useEffect, useState } from 'react';

import { apiFetch, tokenStorage } from '../services/apiFetch';
import { effectiveStatus, ingestPresence, usePresenceEntry, watchPresence, type PresenceInput, type PresenceStatus } from './presenceStore';

export interface LivePresence { status: PresenceStatus; lastSeen: string | null; checking: boolean; known: boolean }
type View = PresenceInput & { checking?: boolean };

export type ActorKind = 'client' | 'company' | 'delivery' | 'correspondent' | 'partner';

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

const signedIn = () => !!tokenStorage.get();

export function usePresence(userId: string | null | undefined, opts: { probe?: boolean; fallback?: PresenceInput } = {}): LivePresence {
  const entry = usePresenceEntry(userId);
  const now = useNow(30_000);
  const { probe = false, fallback } = opts;
  const fbStatus = fallback?.status ?? null;
  const fbSeen = fallback?.lastSeen ?? null;

  useEffect(() => {
    if (userId && fbStatus) ingestPresence(userId, { status: fbStatus, lastSeen: fbSeen });
  }, [userId, fbStatus, fbSeen]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const logged = signedIn();
    const stop = logged ? watchPresence(userId) : () => undefined;
    const req = logged && probe
      ? apiFetch<Record<string, View>>('/presence/probe', { method: 'POST', body: { userIds: [userId] } })
      : apiFetch<Record<string, View>>('/presence/users', { public: true, params: { ids: userId } });
    req.then(res => { const v = res?.[userId]; if (alive && v) ingestPresence(userId, v, { checking: !!v.checking }); })
       .catch(() => undefined);
    return () => { alive = false; stop(); };
  }, [userId, probe]);

  const status = effectiveStatus(entry, now);
  return { status, lastSeen: entry?.lastSeen ?? null, checking: !!entry?.checkingUntil && entry.checkingUntil > now && status !== 'online', known: !!entry };
}

export function useKnownPresence(userId: string | null | undefined, list: PresenceInput): LivePresence {
  const entry = usePresenceEntry(userId);
  const now = useNow(60_000);
  const { status = null, lastSeen = null, reachableUntil = null } = list;
  useEffect(() => {
    if (userId && status) ingestPresence(userId, { status, lastSeen, reachableUntil });
  }, [userId, status, lastSeen, reachableUntil]);
  const e = entry ?? (status ? { status, reachableUntil } : undefined);
  return { status: effectiveStatus(e, now), lastSeen: entry?.lastSeen ?? lastSeen, checking: false, known: !!e };
}

export function useActorPresence(type: ActorKind | null, id: string | null | undefined): LivePresence & { userId: string | null } {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    if (!type || !id) return;
    let alive = true;
    apiFetch<View & { userId: string }>(`/presence/actor/${type}/${id}`, { public: !signedIn() })
      .then(v => { if (!alive || !v?.userId) return; ingestPresence(v.userId, v, { checking: !!v.checking }); setUserId(v.userId); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [type, id]);
  const entry = usePresenceEntry(userId);
  const now = useNow(30_000);
  useEffect(() => (userId && signedIn() ? watchPresence(userId) : undefined), [userId]);
  const status = effectiveStatus(entry, now);
  return { userId, status, lastSeen: entry?.lastSeen ?? null, checking: !!entry?.checkingUntil && entry.checkingUntil > now && status !== 'online', known: !!entry };
}
