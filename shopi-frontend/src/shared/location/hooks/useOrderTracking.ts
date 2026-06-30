/* ============================================================
 * FICHIER : src/shared/location/hooks/useOrderTracking.ts
 *
 * RÔLE : Hook React pour le suivi d'une commande en temps réel.
 *        - Charge les positions initiales via REST
 *        - Met à jour la position du livreur via Socket.IO
 *        - Recalcule l'itinéraire si le livreur bouge de > 50m
 * ============================================================ */

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchOrderTracking, fetchRoute }            from '../services/routingApi';
import { useTrackDelivery }                          from './useLocationSocket';
import { isSignificantMove }                         from '../utils/geoUtils';
import type { OrderTrackingData, ActorPosition, RouteResult } from '../services/routingApi';

const RECALC_THRESHOLD_M = 50;  // recalcul si livreur bouge de > 50m

interface UseOrderTrackingReturn {
  actors:       ActorPosition[];
  route:        RouteResult | null;
  numero:       string;
  status:       string;
  loading:      boolean;
  error:        string | null;
  deliveryLive: boolean;    // true si livreur partage sa position
  refresh:      () => void;
}

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
      /* Initialiser la position de référence pour recalcul */
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

  /* ── Mise à jour live du livreur + recalcul itinéraire ────── */

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

    /* 2. Recalcul d'itinéraire si mouvement > 50m */
    const newPos = { latitude: livePos.latitude, longitude: livePos.longitude };
    const shouldRecalc = !lastRecalcPos.current
      || isSignificantMove(lastRecalcPos.current, newPos, RECALC_THRESHOLD_M);

    if (!shouldRecalc) return;
    lastRecalcPos.current = newPos;

    /* Construire les waypoints dans l'ordre : vendor → delivery → client */
    const actors = data.actors;
    const waypoints = data.waypointOrder
      .map(i => actors[i])
      .map(a => {
        if (a.role === 'delivery') {
          return { latitude: livePos.latitude, longitude: livePos.longitude };
        }
        return { latitude: a.lat, longitude: a.lng };
      });

    if (waypoints.length >= 2) {
      fetchRoute(waypoints)
        .then(route => setData(prev => prev ? { ...prev, route } : prev))
        .catch(() => {}); // silencieux — on garde l'ancien itinéraire
    }
  }, [livePos, data]);

  return {
    actors:       data?.actors        ?? [],
    route:        data?.route         ?? null,
    numero:       data?.numero        ?? '',
    status:       data?.status        ?? '',
    loading,
    error,
    deliveryLive: sharing,
    refresh:      load,
  };
}
