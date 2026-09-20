/* ================================================================
 * FICHIER : src/shared/location/hooks/useActorDistance.ts
 *
 * Distance client → acteur, fournie par le système de localisation.
 * Toutes les cartes d'une page s'inscrivent ; leurs demandes sont REGROUPÉES
 * en un seul appel POST /location/map/distances (jusqu'à 60 acteurs), et chaque
 * résultat est gardé en mémoire tant que la position du client ne change pas.
 * ================================================================ */

import { useEffect, useSyncExternalStore } from 'react';
import { fetchActorDistances, type ActorDistanceInfo } from '../services/distanceApi';
import type { MapActorRole } from '../services/mapSearchApi';
import { useClientPosition } from './useClientPosition';

const BATCH_DELAY_MS = 40;
const BATCH_MAX      = 60;

interface Pending { key: string; lat: number; lng: number; role: MapActorRole; id: string }

const cache     = new Map<string, ActorDistanceInfo | null>();
const requested = new Set<string>();
const listeners = new Set<() => void>();
let queue: Pending[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

const posKey = (lat: number, lng: number) => `${lat.toFixed(3)},${lng.toFixed(3)}`;
const notify = () => listeners.forEach(l => l());

async function flush(): Promise<void> {
  timer = null;
  const batch = queue;
  queue = [];

  /* un appel par position (en pratique une seule) et par paquet de 60 */
  const groups = new Map<string, Pending[]>();
  for (const q of batch) {
    const g = q.key.split('|')[0];
    const list = groups.get(g) ?? [];
    list.push(q);
    groups.set(g, list);
  }

  const calls: Promise<void>[] = [];
  for (const items of groups.values()) {
    for (let i = 0; i < items.length; i += BATCH_MAX) {
      const chunk = items.slice(i, i + BATCH_MAX);
      calls.push((async () => {
        try {
          const res = await fetchActorDistances(
            { lat: chunk[0].lat, lng: chunk[0].lng },
            chunk.map(c => ({ role: c.role, id: c.id })),
          );
          for (const c of chunk) cache.set(c.key, res[`${c.role}:${c.id}`] ?? null);
        } catch {
          /* échec (réseau, limite de débit) : on libère les clés pour permettre un nouvel essai */
          for (const c of chunk) requested.delete(c.key);
        }
      })());
    }
  }
  await Promise.all(calls);
  notify();
}

function request(pos: { lat: number; lng: number }, role: MapActorRole, id: string): void {
  const key = `${posKey(pos.lat, pos.lng)}|${role}:${id}`;
  if (cache.has(key) || requested.has(key)) return;
  requested.add(key);
  queue.push({ key, lat: pos.lat, lng: pos.lng, role, id });
  if (!timer) timer = setTimeout(() => { void flush(); }, BATCH_DELAY_MS);
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export interface ActorDistanceResult extends ActorDistanceInfo { from: 'gps' | 'adresse' }

/** Distance du client à l'acteur, ou null (visiteur, position inconnue, acteur non localisable). */
export function useActorDistance(role: MapActorRole, id: string | null | undefined): ActorDistanceResult | null {
  const pos = useClientPosition();
  const key = pos && id ? `${posKey(pos.lat, pos.lng)}|${role}:${id}` : null;

  useEffect(() => {
    if (pos && id) request(pos, role, id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos?.lat, pos?.lng, role, id]);

  const info = useSyncExternalStore(subscribe, () => (key ? cache.get(key) ?? null : null), () => null);
  return info && pos ? { ...info, from: pos.source } : null;
}
