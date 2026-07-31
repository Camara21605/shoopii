/**
 * src/shared/messagerie/hooks/iceServers.ts
 *
 * Serveurs ICE (STUN + TURN) pour RTCPeerConnection, partagés entre
 * useAudioCall.ts (1:1) et useGroupCall.ts (mesh de groupe).
 *
 * Les identifiants TURN viennent désormais de GET /calls/ice-servers
 * (la clé API Metered.ca reste côté serveur, jamais exposée au bundle
 * frontend — contrairement à l'ancienne approche VITE_TURN_* en dur
 * au build). Résultat mis en cache en mémoire (30 min) pour éviter un
 * aller-retour réseau à chaque appel ; le backend a lui-même son propre
 * cache Redis, donc ce fetch reste léger.
 */

import { apiFetch } from '../../services/apiFetch';

const FALLBACK_STUN: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302'  },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const CACHE_MS = 30 * 60 * 1000;

let cache: { servers: RTCIceServer[]; fetchedAt: number } | null = null;
let inFlight: Promise<RTCIceServer[]> | null = null;

async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const { iceServers } = await apiFetch<{ iceServers: RTCIceServer[] }>('/calls/ice-servers');
    cache = { servers: iceServers, fetchedAt: Date.now() };
    return iceServers;
  } catch {
    /* Backend/Metered indisponible — on retombe sur STUN seul (ou le dernier cache connu). */
    return cache?.servers ?? FALLBACK_STUN;
  } finally {
    inFlight = null;
  }
}

/** Renvoie les serveurs ICE à utiliser, en réutilisant le cache tant qu'il est frais. */
export function getIceServers(): Promise<RTCIceServer[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_MS) return Promise.resolve(cache.servers);
  if (!inFlight) inFlight = fetchIceServers();
  return inFlight;
}

/** Préchauffe le cache sans bloquer — à appeler au montage d'un hook d'appel. */
export function prefetchIceServers(): void {
  void getIceServers();
}
