/**
 * Partage de position du livreur — équivalent de useLivreurSharing du site
 * (Socket.IO, namespace /location) :
 *   emit location:start-sharing   → le serveur ouvre une session de partage
 *   emit location:update {latitude, longitude, precisionM, cap, vitesseKmh, horodatage}
 *                                 → position enregistrée (carte, distances) et
 *                                   diffusée en direct au client et à la boutique
 *   emit location:stop-sharing
 * Le serveur lie la session à la CONNEXION : elle doit rester ouverte d'une page
 * à l'autre → un seul service pour tout l'espace livreur (état partagé lu par
 * useSharing()), et la session est rouverte après une reconnexion.
 * Partage automatique pendant une livraison (voir useAutoSharing dans le layout
 * livreur), impossible à arrêter tant qu'elle est en cours.
 * Limite : application au premier plan uniquement (pas de localisation en
 * arrière-plan) — l'écran le dit au livreur.
 */
import * as Location from 'expo-location';
import { useEffect, useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';

import { env } from '@/config/env';
import { tokenStore } from '@/lib/api/token-store';

export type SharingState = {
  sharing: boolean;
  starting: boolean;
  position: { latitude: number; longitude: number; accuracy?: number | null } | null;
  error: string | null;
};

let state: SharingState = { sharing: false, starting: false, position: null, error: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<SharingState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

let socket: Socket | null = null;
let watch: Location.LocationSubscription | null = null;
let last: { latitude: number; longitude: number } | null = null;

/** Distance en mètres (haversine) — même filtre « déplacement significatif » que le site (5 m). */
function meters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6_371_000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function openSocket() {
  if (socket) return socket;
  socket = io(`${env.socketUrl}/location`, {
    transports: ['websocket'],
    auth: (cb) => cb({ token: tokenStore.getAccessToken() }),
    reconnection: true,
    reconnectionDelay: 2000,
    timeout: 10_000,
  });
  /* Le serveur reconnaît le livreur APRÈS l'ouverture de la connexion (lecture en base) :
   * une demande envoyée trop tôt est ignorée. On attend donc son signal
   * « location:connected » pour (ré)ouvrir la session, à chaque (re)connexion. */
  socket.on('location:connected', () => {
    ready = true;
    if (!state.sharing) return;
    socket?.emit('location:start-sharing');
    const p = pending ?? last;
    if (p) send(p);
  });
  socket.on('disconnect', () => {
    ready = false;
  });
  return socket;
}

let ready = false;
let pending: Update | null = null;
type Update = { latitude: number; longitude: number; precisionM?: number; cap?: number; vitesseKmh?: number; horodatage?: string };
/* Le serveur ignore une position reçue moins d'1 s après la précédente (THROTTLE_MS) :
 * on espace les envois et on renvoie la DERNIÈRE position retenue, sinon un livreur
 * qui s'arrête juste après un déplacement resterait affiché à l'ancien endroit. */
const MIN_GAP_MS = 1200;
let lastSentAt = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
function send(u: Update) {
  if (!socket || !ready) {
    pending = u;
    return;
  }
  const wait = lastSentAt + MIN_GAP_MS - Date.now();
  if (wait > 0) {
    pending = u;
    if (!flushTimer)
      flushTimer = setTimeout(() => {
        flushTimer = null;
        if (pending) send(pending);
      }, wait);
    return;
  }
  pending = null;
  lastSentAt = Date.now();
  last = { latitude: u.latitude, longitude: u.longitude };
  socket.emit('location:update', { ...u, horodatage: u.horodatage ?? new Date().toISOString() });
}

export async function startSharing(): Promise<boolean> {
  if (state.sharing || state.starting) return state.sharing;
  set({ starting: true, error: null });
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) {
      set({ starting: false, error: 'Autorisez la localisation pour partager votre position.' });
      return false;
    }
    set({ sharing: true });
    const s = openSocket();
    if (ready) s.emit('location:start-sharing');
    watch = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 }, (p) => {
      const next = { latitude: p.coords.latitude, longitude: p.coords.longitude };
      set({ position: { ...next, accuracy: p.coords.accuracy } });
      if (last && meters(last, next) < 5) return;
      send({
        latitude: next.latitude,
        longitude: next.longitude,
        precisionM: p.coords.accuracy ?? undefined,
        cap: p.coords.heading ?? undefined,
        vitesseKmh: p.coords.speed != null && p.coords.speed >= 0 ? p.coords.speed * 3.6 : undefined,
        horodatage: new Date(p.timestamp).toISOString(),
      });
    });
    set({ starting: false });
    return true;
  } catch {
    stopSharing();
    set({ error: 'GPS indisponible sur cet appareil.' });
    return false;
  }
}

export function stopSharing() {
  watch?.remove();
  watch = null;
  if (socket) {
    if (socket.connected && state.sharing) socket.emit('location:stop-sharing');
    socket.disconnect();
    socket = null;
  }
  last = null;
  pending = null;
  ready = false;
  lastSentAt = 0;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  set({ sharing: false, starting: false, position: null });
}

export function useSharing() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/**
 * Partage automatique : démarre dès qu'une livraison est en cours (mission
 * acceptée), s'arrête quand il n'y en a plus — comme LivreurApp du site.
 * Coupé aussi en quittant l'espace livreur (déconnexion).
 */
export function useAutoSharing(hasActiveMission: boolean) {
  useEffect(() => {
    if (hasActiveMission && !state.sharing) void startSharing();
    else if (!hasActiveMission && state.sharing) stopSharing();
  }, [hasActiveMission]);
  useEffect(() => () => stopSharing(), []);
}
