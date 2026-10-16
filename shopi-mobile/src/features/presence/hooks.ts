/**
 * usePresence(userId)       — état en direct d'une personne (3 états) ;
 * useActorPresence(type,id) — idem pour le propriétaire d'un profil public.
 *
 * Chaque écran qui en a besoin :
 *   1. part de ce que la liste savait déjà (fallback) ;
 *   2. suit la personne en direct (socket 'presence:watch') ;
 *   3. avec `probe` (conversation, profil ouverts) : demande au serveur de
 *      VÉRIFIER si son téléphone est joignable — résultat en direct en
 *      quelques secondes ;
 *   4. se recalcule chaque 30 s (« vu il y a 5 min », fin de « joignable »).
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useSession } from '@/features/auth/session-store';
import { qk } from '@/lib/query-keys';

import { fetchActorPresence, fetchPresence, probePresence, type ActorKind, type PresenceStatus, type PresenceView } from './api';
import { effectiveStatus, ingestPresence, usePresenceStore } from './store';
import { watchPresence } from './watch';

export type LivePresence = { status: PresenceStatus; lastSeen: string | null; checking: boolean; known: boolean };

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function usePresence(
  userId: string | null | undefined,
  opts: { probe?: boolean; fallback?: Omit<Partial<PresenceView>, 'status'> & { status?: PresenceStatus | null } } = {},
): LivePresence {
  const signedIn = useSession((s) => s.status === 'signedIn');
  const me = useSession((s) => s.user?.id);
  const entry = usePresenceStore((s) => (userId ? s.byUser[userId] : undefined));
  const now = useNow(30_000);
  const { probe = false, fallback } = opts;
  const fbStatus = fallback?.status ?? null;
  const fbSeen = fallback?.lastSeen ?? null;

  /* Ce que la liste savait, si le magasin n'a rien de plus récent. */
  useEffect(() => {
    if (!userId || !fbStatus) return;
    if (!usePresenceStore.getState().byUser[userId]) ingestPresence(userId, { status: fbStatus, lastSeen: fbSeen });
  }, [userId, fbStatus, fbSeen]);

  /* Suivi en direct + vérification / lecture initiale. */
  useEffect(() => {
    if (!userId || userId === me) return;
    let alive = true;
    const stop = signedIn ? watchPresence(userId) : () => undefined;
    const req = signedIn && probe ? probePresence([userId]) : !usePresenceStore.getState().byUser[userId] ? fetchPresence([userId]) : null;
    req
      ?.then((res) => {
        const v = res[userId];
        if (alive && v) ingestPresence(userId, v, { checking: !!v.checking });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      stop();
    };
  }, [userId, me, signedIn, probe]);

  const status = effectiveStatus(entry, now);
  const checking = !!entry?.checkingUntil && entry.checkingUntil > now && status !== 'online';
  return { status, lastSeen: entry?.lastSeen ?? null, checking, known: !!entry };
}

/**
 * Version légère pour les LISTES (conversations, membres) : contacts déjà
 * prévenus en direct par le serveur — pas de suivi ni de vérification.
 */
export function useKnownPresence(
  userId: string | null | undefined,
  fallback: { status?: PresenceStatus | null; lastSeen?: string | null; reachableUntil?: string | null },
): LivePresence {
  const entry = usePresenceStore((s) => (userId ? s.byUser[userId] : undefined));
  const now = useNow(60_000);
  const { status: fbStatus = null, lastSeen: fbSeen = null, reachableUntil: fbUntil = null } = fallback;
  useEffect(() => {
    if (userId && fbStatus) ingestPresence(userId, { status: fbStatus, lastSeen: fbSeen, reachableUntil: fbUntil });
  }, [userId, fbStatus, fbSeen, fbUntil]);
  const e = entry ?? (fbStatus ? { status: fbStatus, reachableUntil: fbUntil } : undefined);
  return { status: effectiveStatus(e, now), lastSeen: entry?.lastSeen ?? fbSeen, checking: false, known: !!e };
}

/** Profil public (boutique, livreur, point relais, client) : présence de son propriétaire. */
export function useActorPresence(type: ActorKind | null, id: string | null | undefined): LivePresence & { userId: string | null } {
  const signedIn = useSession((s) => s.status === 'signedIn');
  const q = useQuery({
    queryKey: qk.presence.actor(type ?? '', id ?? '', signedIn),
    queryFn: () => fetchActorPresence(type!, id!),
    enabled: !!type && !!id,
    staleTime: 60_000,
    retry: 1,
  });
  const userId = q.data?.userId ?? null;
  useEffect(() => {
    if (q.data) ingestPresence(q.data.userId, q.data, { checking: !!q.data.checking });
  }, [q.data]);
  const live = usePresence(userId);
  return { ...live, userId };
}
