/* ============================================================
 * FICHIER : src/shared/location/hooks/useOrderTracking.ts
 *
 * RÔLE : Hook React pour le suivi d'une commande en temps réel.
 *        - Charge les positions + 3 tronçons colorés initiaux via REST
 *        - Met à jour la position du livreur via Socket.IO
 *        - Recalcule le tronçon ACTIF (rouge avant récupération,
 *          bleu après) si le livreur bouge de > 50m — le tronçon
 *          vert (boutique → client) ne bouge jamais, pas de recalcul.
 * ============================================================ */

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchOrderTracking, fetchRoute }            from '../services/routingApi';
import { useTrackDelivery }                          from './useLocationSocket';
import { isSignificantMove }                         from '../utils/geoUtils';
import type { OrderTrackingData, OrderTrackingRoutes, ActorPosition } from '../services/routingApi';

const RECALC_THRESHOLD_M = 50;  // recalcul si livreur bouge de > 50m

interface UseOrderTrackingReturn {
  actors:          ActorPosition[];
  routes:          OrderTrackingRoutes;
  livreurPickedUp: boolean;
  numero:          string;
  status:          string;
  loading:         boolean;
  error:           string | null;
  deliveryLive:    boolean;    // true si livreur partage sa position
  refresh:         () => void;
}

const EMPTY_ROUTES: OrderTrackingRoutes = { livreurToShop: null, shopToClient: null, livreurToClient: null };

export function useOrderTracking(orderId: string | null): UseOrderTrackingReturn {
  const [data,    setData]    = useState<OrderTrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  /* Position du livreur en temps réel via Socket.IO */
  const deliveryId = data?.actors.find(a => a.role === 'delivery')?.id ?? null;
  const { position: livePos, sharing } = useTrackDelivery(deliveryId);

  /* Référence pour détecter les mouvements significatifs */
  const lastRecalcPos = useRef<{ latitude: number; longitude: number } | null>(null);

  /* ── Chargement initial ─────────────────────────────────── */

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchOrderTracking(orderId);
      setData(result);
      const deliveryActor = result.actors.find(a => a.role === 'delivery');
      if (deliveryActor) {
        lastRecalcPos.current = { latitude: deliveryActor.lat, longitude: deliveryActor.lng };
      }
    } catch (e: any) {
      setError(e?.message ?? 'Erreur de chargement du suivi.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  /* ── Mise à jour live du livreur + recalcul du tronçon actif ── */

  useEffect(() => {
    if (!livePos || !data) return;

    /* 1. Mettre à jour la position du livreur dans les actors */
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        actors: prev.actors.map(a =>
          a.role === 'delivery'
            ? { ...a, lat: livePos.latitude, lng: livePos.longitude }
            : a,
        ),
      };
    });

    /* 2. Recalcul si mouvement > 50m */
    const newPos = { latitude: livePos.latitude, longitude: livePos.longitude };
    const shouldRecalc = !lastRecalcPos.current
      || isSignificantMove(lastRecalcPos.current, newPos, RECALC_THRESHOLD_M);

    if (!shouldRecalc) return;
    lastRecalcPos.current = newPos;

    const shop   = data.actors.find(a => a.role === 'vendor');
    const client = data.actors.find(a => a.role === 'client');

    /* Avant récupération → recalcule le tronçon rouge (livreur→boutique).
     * Après récupération → recalcule le tronçon bleu (livreur→client). */
    if (!data.livreurPickedUp && shop) {
      fetchRoute([newPos, { latitude: shop.lat, longitude: shop.lng }])
        .then(route => setData(prev => prev ? { ...prev, routes: { ...prev.routes, livreurToShop: route } } : prev))
        .catch(() => {});
    } else if (data.livreurPickedUp && client) {
      fetchRoute([newPos, { latitude: client.lat, longitude: client.lng }])
        .then(route => setData(prev => prev ? { ...prev, routes: { ...prev.routes, livreurToClient: route } } : prev))
        .catch(() => {});
    }
  }, [livePos, data]);

  return {
    actors:          data?.actors          ?? [],
    routes:          data?.routes          ?? EMPTY_ROUTES,
    livreurPickedUp: data?.livreurPickedUp ?? false,
    numero:          data?.numero          ?? '',
    status:          data?.status          ?? '',
    loading,
    error,
    deliveryLive:    sharing,
    refresh:         load,
  };
}
