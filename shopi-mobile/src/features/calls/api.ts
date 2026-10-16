/**
 * Appels — serveurs ICE (STUN/TURN) et reprise après relance de l'app.
 * Mêmes adresses que le site (call.controller.ts) :
 *   GET /calls/ice-servers        → identifiants TURN dynamiques (Metered.ca)
 *   GET /calls/pending-incoming   → appel entrant manqué pendant que le socket
 *                                    n'était pas connecté (app fermée/relancée) —
 *                                    l'événement temps réel call:incoming n'est
 *                                    jamais rejoué après coup.
 */
import { Platform } from 'react-native';
import { z } from 'zod';

import { getDeviceId } from '@/features/auth/api';
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

/* ── Push des appels entrants (application fermée) ─────────────────────
 * Le jeton FCM de ce téléphone est rattaché au compte connecté : le serveur
 * s'en sert pour faire sonner l'appareil quand l'application est fermée
 * (CallPushService). Même route que le site pour ses abonnements web. */

let registeredFor: string | null = null;   // « jeton|compte » déjà envoyé au serveur

/** `accountKey` : le jeton est rattaché au compte ACTIF — on le renvoie après une bascule de compte. */
export async function registerPushToken(token: string, accountKey: string): Promise<void> {
  const key = `${token}|${accountKey}`;
  if (Platform.OS !== 'android' || !token || key === registeredFor) return;
  await apiFetch('/notifications/push-token', {
    method: 'POST',
    body: { token, platform: 'android', deviceId: await getDeviceId() },
  });
  registeredFor = key;
}

/** À la déconnexion : ce téléphone ne doit plus sonner pour ce compte. */
export async function unregisterPushToken(): Promise<void> {
  if (Platform.OS !== 'android') return;
  registeredFor = null;
  await apiFetch('/notifications/push-token', {
    method: 'DELETE',
    body: { deviceId: await getDeviceId() },
  });
}
