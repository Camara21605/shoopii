/**
 * Appels — serveurs ICE (STUN/TURN) et reprise après relance de l'app.
 * Mêmes adresses que le site (call.controller.ts) :
 *   GET /calls/ice-servers        → identifiants TURN dynamiques (Metered.ca)
 *   GET /calls/pending-incoming   → appel entrant manqué pendant que le socket
 *                                    n'était pas connecté (app fermée/relancée) —
 *                                    l'événement temps réel call:incoming n'est
 *                                    jamais rejoué après coup.
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';
import { tokenStore } from '@/lib/api/token-store';

const FALLBACK_STUN = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
] as const;

const CACHE_MS = 30 * 60_000;
let cache: { servers: RTCIceServerInit[]; fetchedAt: number } | null = null;
let inFlight: Promise<RTCIceServerInit[]> | null = null;

/** Forme attendue par react-native-webrtc — identique à RTCIceServer du navigateur. */
export interface RTCIceServerInit {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const iceServersSchema = z.object({ iceServers: z.array(z.any()) });

async function fetchIceServers(): Promise<RTCIceServerInit[]> {
  try {
    const { iceServers } = await apiFetch('/calls/ice-servers', { schema: iceServersSchema });
    cache = { servers: iceServers as RTCIceServerInit[], fetchedAt: Date.now() };
    return cache.servers;
  } catch {
    return cache?.servers ?? [...FALLBACK_STUN];
  } finally {
    inFlight = null;
  }
}

/** Réutilise le cache tant qu'il est frais — évite un aller-retour réseau à chaque appel. */
export function getIceServers(): Promise<RTCIceServerInit[]> {
  if (!tokenStore.getAccessToken()) return Promise.resolve([...FALLBACK_STUN]);
  if (cache && Date.now() - cache.fetchedAt < CACHE_MS) return Promise.resolve(cache.servers);
  inFlight ??= fetchIceServers();
  return inFlight;
}

/** Préchauffe le cache dès l'ouverture de l'app (CallProvider) — pas d'attente au premier appel. */
export function prefetchIceServers(): void {
  void getIceServers();
}

/* Forme exacte de CallService.findPendingIncoming() côté backend — callId
 * (pas "id"), conversationId potentiellement null (call.controller.ts). */
const pendingIncomingSchema = z.object({
  call: z
    .object({
      callId: z.string(),
      conversationId: z.string().nullable(),
      callerUserId: z.string(),
      callerName: z.string().nullable().optional(),
      callerAvatar: z.string().nullable().optional(),
      callType: z.enum(['audio', 'video']).optional(),
    })
    .nullable(),
});

export type PendingIncomingCall = NonNullable<z.infer<typeof pendingIncomingSchema>['call']>;

export async function fetchPendingIncoming(): Promise<PendingIncomingCall | null> {
  const res = await apiFetch('/calls/pending-incoming', { schema: pendingIncomingSchema });
  return res.call;
}
