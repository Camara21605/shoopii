/* ============================================================
 * FICHIER : src/shared/location/services/routingApi.ts
 *
 * RÔLE : Client frontend pour les endpoints de tracking/routing.
 *        Appelle le backend Shoneya qui relaie vers OpenRouteService.
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
  /* 'correspondent' = position fixe du dépôt/point relais, uniquement
   * présente quand la commande implique réellement un correspondant. */
  role:     'vendor' | 'delivery' | 'client' | 'correspondent';
  lat:      number;
  lng:      number;
  address?: string;
  isLive:   boolean;
}

export interface OrderTrackingRoutes {
  livreurToShop:   RouteResult | null;   // rouge — avant récupération du colis
  shopToClient:    RouteResult | null;   // vert  — trajet de référence, toujours
  livreurToClient: RouteResult | null;   // bleu  — après récupération du colis
}

export interface OrderTrackingData {
  orderId:         string;
  numero:          string;
  status:          string;
  actors:          ActorPosition[];
  /** true = le livreur a validé son code (colis récupéré en boutique) */
  livreurPickedUp: boolean;
  routes:          OrderTrackingRoutes;
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

/* ── Recherche d'acteur (carte "Ma position" du client) ─────── */

export interface ActorSearchResult {
  id:      string;
  name:    string;
  role:    'vendor' | 'delivery' | 'correspondent';
  lat:     number;
  lng:     number;
  address: string | null;
}

/** Recherche une boutique / un livreur / un correspondant par nom. */
export async function searchActor(query: string): Promise<ActorSearchResult[]> {
  return apiFetch<ActorSearchResult[]>(`/location/search-actor?q=${encodeURIComponent(query)}`);
}
