/**
 * Position en temps réel d'un livreur — même canal que useTrackDelivery du
 * site (Socket.IO, namespace /location) :
 *   emit  location:subscribe { deliveryId }   (à l'ouverture de l'onglet)
 *   on    location:sharing-on / sharing-off   (le livreur partage ou non)
 *   on    location:position                   (dernière position, puis chaque déplacement)
 *   emit  location:unsubscribe                (en quittant l'onglet)
 * Le serveur renvoie tout de suite la dernière position connue si un partage
 * est en cours. La connexion n'est ouverte que pendant l'affichage de l'onglet.
 */
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

import { env } from '@/config/env';
import { tokenStore } from '@/lib/api/token-store';

export type TrackedPosition = { latitude: number; longitude: number; vitesseKmh?: number | null; ts?: string };

export function useTrackDelivery(deliveryId: string | null) {
  const [position, setPosition] = useState<TrackedPosition | null>(null);
  const [sharing, setSharing] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!deliveryId) return;
    const socket = io(`${env.socketUrl}/location`, {
      transports: ['websocket'],
      auth: (cb) => cb({ token: tokenStore.getAccessToken() }),
      reconnection: true,
      reconnectionDelay: 2000,
      timeout: 10_000,
    });
    const mine = (d: { deliveryId?: string }) => !d?.deliveryId || d.deliveryId === deliveryId;
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('location:subscribe', { deliveryId });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('location:sharing-on', (d: { deliveryId?: string }) => mine(d) && setSharing(true));
    socket.on('location:sharing-off', (d: { deliveryId?: string }) => mine(d) && setSharing(false));
    socket.on('location:position', (d: TrackedPosition & { deliveryId?: string }) => {
      if (mine(d) && Number.isFinite(d.latitude) && Number.isFinite(d.longitude)) setPosition(d);
    });
    return () => {
      socket.emit('location:unsubscribe', { deliveryId });
      socket.disconnect();
    };
  }, [deliveryId]);

  return { position, sharing, connected };
}
