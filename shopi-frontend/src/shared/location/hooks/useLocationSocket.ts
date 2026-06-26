/* ============================================================
 * FICHIER : src/shared/location/hooks/useLocationSocket.ts
 * RÔLE    : Hook Socket.IO pour le namespace /location.
 *           - Livreur : partage sa position en temps réel
 *           - Client / Entreprise : suit la position d'un livreur
 * ============================================================ */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket }             from 'socket.io-client';
import { tokenStorage }           from '../../services/apiFetch';
import { isSignificantMove }      from '../utils/geoUtils';
import type { DeliveryPosition }  from '../types/location.types';

const SOCKET_URL = (import.meta as any).env?.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:3001';

/** Intervalle d'envoi GPS en ms */
const SEND_INTERVAL_MS = 3_000;

/** Seuil de mouvement minimal en mètres */
const MIN_MOVE_M = 5;

/* ── Singleton socket /location ──────────────────────────────── */

let _locSocket: Socket | null = null;
let _locToken:  string | null = null;

function getLocationSocket(): Socket {
  const token = tokenStorage.get() ?? '';
  /* Même fix Strict Mode que useSocket : !disconnected au lieu de connected */
  if (_locSocket && token === _locToken && !_locSocket.disconnected) return _locSocket;
  if (_locSocket) { _locSocket.disconnect(); _locSocket = null; }

  _locToken  = token;
  _locSocket = io(`${SOCKET_URL}/location`, {
    auth:              { token },
    transports:        ['websocket', 'polling'],
    reconnection:      true,
    reconnectionDelay: 2_000,
    timeout:           10_000,
  });
  return _locSocket;
}

/* ── Hook livreur (partage de position) ─────────────────────── */

export interface UseLivreurSharingOptions {
  onError?: (msg: string) => void;
}

export function useLivreurSharing(options: UseLivreurSharingOptions = {}) {
  const [sharing,  setSharing]  = useState(false);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const watchIdRef  = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPosRef  = useRef<{ latitude: number; longitude: number } | null>(null);
  const pendingPos  = useRef<GeolocationPosition | null>(null);

  /** Démarre le partage GPS */
  const startSharing = useCallback(() => {
    if (!('geolocation' in navigator)) {
      options.onError?.('GPS non disponible sur cet appareil.');
      return;
    }

    const socket = getLocationSocket();
    socket.emit('location:start-sharing');
    setSharing(true);

    // Watch position GPS en continu
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => { pendingPos.current = pos; },
      err => options.onError?.(`GPS : ${err.message}`),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );

    // Envoie la position toutes les 3 secondes si déplacement significatif
    intervalRef.current = setInterval(() => {
      const pos = pendingPos.current;
      if (!pos) return;

      const next = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };

      if (lastPosRef.current && !isSignificantMove(lastPosRef.current, next, MIN_MOVE_M)) return;

      lastPosRef.current = next;
      setPosition(next);

      socket.emit('location:update', {
        latitude:   pos.coords.latitude,
        longitude:  pos.coords.longitude,
        precisionM: pos.coords.accuracy ?? undefined,
        cap:        pos.coords.heading  ?? undefined,
        vitesseKmh: pos.coords.speed != null ? pos.coords.speed * 3.6 : undefined,
        horodatage: new Date(pos.timestamp).toISOString(),
      });
    }, SEND_INTERVAL_MS);
  }, [options]);

  /** Arrête le partage GPS */
  const stopSharing = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    getLocationSocket().emit('location:stop-sharing');
    setSharing(false);
    setSessionId(null);
    pendingPos.current = null;
    lastPosRef.current = null;
  }, []);

  // Écoute l'événement de démarrage de session
  useEffect(() => {
    const socket = getLocationSocket();
    const onSharingOn = (data: { sessionId: string }) => setSessionId(data.sessionId);
    socket.on('location:sharing-on', onSharingOn);
    return () => { socket.off('location:sharing-on', onSharingOn); };
  }, []);

  // Nettoyage à l'unmount
  useEffect(() => () => {
    if (sharing) stopSharing();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { sharing, position, sessionId, startSharing, stopSharing };
}

/* ── Hook abonné (suit la position d'un livreur) ────────────── */

export function useTrackDelivery(deliveryId: string | null) {
  const [position, setPosition] = useState<DeliveryPosition | null>(null);
  const [sharing,  setSharing]  = useState(false);

  useEffect(() => {
    if (!deliveryId) return;

    const socket = getLocationSocket();
    socket.emit('location:subscribe', { deliveryId });

    const onPosition   = (data: DeliveryPosition) => setPosition(data);
    const onSharingOn  = (data: { deliveryId: string }) => {
      if (data.deliveryId === deliveryId) setSharing(true);
    };
    const onSharingOff = (data: { deliveryId: string }) => {
      if (data.deliveryId === deliveryId) setSharing(false);
    };

    socket.on('location:position',   onPosition);
    socket.on('location:sharing-on', onSharingOn);
    socket.on('location:sharing-off', onSharingOff);

    return () => {
      socket.emit('location:unsubscribe', { deliveryId });
      socket.off('location:position',   onPosition);
      socket.off('location:sharing-on', onSharingOn);
      socket.off('location:sharing-off', onSharingOff);
    };
  }, [deliveryId]);

  return { position, sharing };
}
