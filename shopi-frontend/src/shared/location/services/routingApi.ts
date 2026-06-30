/* ============================================================
 * FICHIER : src/shared/location/services/routingApi.ts
 *
 * RÔLE : Client frontend pour les endpoints de tracking/routing.
 *        Appelle le backend Shopi qui relaie vers OpenRouteService.
 * ============================================================ */

import { apiFetch }       from '../../services/apiFetch';
import type { Coordinates } from '../types/location.types';

/* ── Types ──────────────────────────────────────────────────── */

export interface RouteResult {
  polyline:         [number, number][];   // [lat, lng][] pour Leaflet
  totalDistanceM:   number;
  totalDistanceTxt: string;
  totalDurationS:   number;
  totalDurationTxt: string;
  provider:         'openrouteservice' | 'straight-line-fallback';
}

export interface ActorPosition {
  id:       string;
  name:     string;
  role:     'vendor' | 'delivery' | 'client';
  lat:      number;
  lng:      number;
  address?: string;
  isLive:   boolean;
}

export interface OrderTrackingData {
  orderId:        string;
  numero:         string;
  status:         string;
  actors:         ActorPosition[];
  route:          RouteResult | null;
  waypointOrder:  number[];
}

/* ── API calls ──────────────────────────────────────────────── */

/**
 * Récupère le suivi complet d'une commande :
 * positions vendeur + livreur + client + itinéraire calculé.
 */
export async function fetchOrderTracking(orderId: string): Promise<OrderTrackingData> {
  return apiFetch<OrderTrackingData>(`/location/tracking/${orderId}`);
}

/**
 * Calcule un itinéraire libre entre N points GPS.
 * Utilise ORS via le backend (fallback ligne droite si ORS down).
 */
export async function fetchRoute(waypoints: Coordinates[]): Promise<RouteResult> {
  return apiFetch<RouteResult>('/location/route', {
    method: 'POST',
    body:   { waypoints },
  });
}
