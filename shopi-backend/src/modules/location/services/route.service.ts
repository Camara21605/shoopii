/* ============================================================
 * FICHIER : src/modules/location/services/route.service.ts
 *
 * RÔLE : Calcul d'itinéraire via OpenRouteService (ORS).
 *        Solution 100% gratuite (2000 req/jour).
 *        Endpoint : POST /v2/directions/driving-car/json
 *
 * FORMAT coordonnées ORS : [longitude, latitude] (inverse GPS !).
 *
 * DÉPENDANCES : aucune librairie supplémentaire — utilise fetch natif.
 * ============================================================ */

import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService }   from '@nestjs/config';
import type { ICoordinates } from '../interfaces/location.interfaces';

/** Un tronçon de route avec ses waypoints */
export interface RouteSegment {
  distance:  number;   // mètres
  duration:  number;   // secondes
  waypoints: [number, number][]; // [lng, lat][] — format Leaflet inversé
}

/** Réponse complète d'un calcul d'itinéraire */
export interface RouteResult {
  /** Géométrie complète [lat, lng][] pour Leaflet Polyline */
  polyline:        [number, number][];
  /** Distance totale en mètres */
  totalDistanceM:  number;
  /** Distance totale formatée (ex: "3.4 km") */
  totalDistanceTxt: string;
  /** Durée totale en secondes */
  totalDurationS:  number;
  /** Durée totale formatée (ex: "12 min") */
  totalDurationTxt: string;
  /** Tronçons détaillés (ex: vendeur→livreur, livreur→client) */
  segments:        RouteSegment[];
  /** Provider ayant répondu (pour logs/monitoring) */
  provider:        'openrouteservice' | 'straight-line-fallback';
}

@Injectable()
export class RouteService {

  private readonly logger = new Logger(RouteService.name);
  private readonly ORS_BASE = 'https://api.openrouteservice.org/v2/directions/driving-car/json';

  constructor(private readonly config: ConfigService) {}

  /* ── Calcul d'itinéraire principal ─────────────────────────── */

  /**
   * Calcule l'itinéraire entre N points GPS via OpenRouteService.
   * Fallback vers ligne droite si l'API est indisponible.
   *
   * @param waypoints - Coordonnées [lat, lng] dans l'ordre de passage
   * @returns RouteResult avec polyline, distances et durées
   */
  async getRoute(waypoints: ICoordinates[]): Promise<RouteResult> {
    if (waypoints.length < 2) {
      throw new Error('Au moins 2 points de passage sont requis.');
    }

    const apiKey = this.config.get<string>('OPENROUTESERVICE_API_KEY');

    if (!apiKey || apiKey === 'VOTRE_CLE_ORS') {
      this.logger.warn('[Route] ORS API key manquante — fallback ligne droite');
      return this.buildStraightLineFallback(waypoints);
    }

    try {
      return await this.callOrsApi(waypoints, apiKey);
    } catch (err: any) {
      this.logger.warn(`[Route] ORS indisponible (${err.message}) — fallback ligne droite`);
      return this.buildStraightLineFallback(waypoints);
    }
  }

  /* ── Appel API OpenRouteService ─────────────────────────────── */

  private async callOrsApi(waypoints: ICoordinates[], apiKey: string): Promise<RouteResult> {
    /*
     * ORS attend les coordonnées au format [longitude, latitude]
     * (ordre inversé par rapport à GPS standard [lat, lng]).
     */
    const orsCoords = waypoints.map(w => [w.longitude, w.latitude]);

    const res = await fetch(this.ORS_BASE, {
      method:  'POST',
      headers: {
        'Authorization':  apiKey,
        'Content-Type':  'application/json',
        'Accept':        'application/json, application/geo+json',
      },
      body: JSON.stringify({
        coordinates:  orsCoords,
        instructions: false,   // pas de turn-by-turn, allège la réponse
        geometry:     true,
      }),
      signal: AbortSignal.timeout(8_000), // 8s timeout
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ServiceUnavailableException(
        `ORS API error ${res.status}: ${body.slice(0, 200)}`,
      );
    }

    const data = await res.json() as OrsResponse;
    const route = data.routes?.[0];

    if (!route) {
      throw new Error('ORS : aucun itinéraire retourné');
    }

    /*
     * Convertit la géométrie ORS [[lng, lat], ...] → [[lat, lng], ...]
     * pour Leaflet qui attend [latitude, longitude].
     */
    const polyline = (route.geometry?.coordinates ?? [])
      .map(([lng, lat]) => [lat, lng] as [number, number]);

    return {
      polyline,
      totalDistanceM:   route.summary.distance,
      totalDistanceTxt: this.formatDistance(route.summary.distance),
      totalDurationS:   route.summary.duration,
      totalDurationTxt: this.formatDuration(route.summary.duration),
      segments:         this.buildSegments(route, waypoints),
      provider:         'openrouteservice',
    };
  }

  /* ── Fallback ligne droite ──────────────────────────────────── */

  /**
   * Calcule une distance approximative en ligne droite (Haversine)
   * lorsque l'API ORS est indisponible ou non configurée.
   * ETA basé sur une vitesse moyenne de 30 km/h en ville.
   */
  private buildStraightLineFallback(waypoints: ICoordinates[]): RouteResult {
    let totalDistanceM = 0;
    const polyline: [number, number][] = [];
    const segments: RouteSegment[] = [];

    for (let i = 0; i < waypoints.length; i++) {
      polyline.push([waypoints[i].latitude, waypoints[i].longitude]);

      if (i > 0) {
        const dM = this.haversineM(waypoints[i - 1], waypoints[i]);
        totalDistanceM += dM;
        segments.push({
          distance:  dM,
          duration:  Math.round((dM / 1000) / 30 * 3600),
          waypoints: [
            [waypoints[i - 1].longitude, waypoints[i - 1].latitude],
            [waypoints[i].longitude,     waypoints[i].latitude],
          ],
        });
      }
    }

    const totalDurationS = Math.round((totalDistanceM / 1000) / 30 * 3600);

    return {
      polyline,
      totalDistanceM,
      totalDistanceTxt: this.formatDistance(totalDistanceM),
      totalDurationS,
      totalDurationTxt: this.formatDuration(totalDurationS),
      segments,
      provider:         'straight-line-fallback',
    };
  }

  /* ── Helpers privés ─────────────────────────────────────────── */

  private buildSegments(route: OrsRoute, waypoints: ICoordinates[]): RouteSegment[] {
    const segs: RouteSegment[] = [];
    /*
     * ORS v2 ne retourne pas toujours les étapes individuelles
     * en mode simplifié. On crée un segment global si pas de détail.
     */
    const orsSegs = route.segments ?? [];
    if (orsSegs.length === 0) {
      segs.push({
        distance:  route.summary.distance,
        duration:  route.summary.duration,
        waypoints: waypoints.map(w => [w.longitude, w.latitude]),
      });
      return segs;
    }

    for (const s of orsSegs) {
      segs.push({
        distance:  s.distance,
        duration:  s.duration,
        waypoints: [],
      });
    }
    return segs;
  }

  private haversineM(a: ICoordinates, b: ICoordinates): number {
    const R    = 6_371_000; // mètres
    const dLat = this.toRad(b.latitude  - a.latitude);
    const dLng = this.toRad(b.longitude - a.longitude);
    const x    = Math.sin(dLat / 2) ** 2
                + Math.cos(this.toRad(a.latitude)) * Math.cos(this.toRad(b.latitude))
                * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  private toRad(deg: number): number { return deg * Math.PI / 180; }

  private formatDistance(meters: number): string {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }

  private formatDuration(seconds: number): string {
    const m = Math.ceil(seconds / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem > 0 ? `${h}h ${rem} min` : `${h}h`;
  }
}

/* ── Types ORS interne ──────────────────────────────────────── */

interface OrsResponse {
  routes: OrsRoute[];
}

interface OrsRoute {
  summary:  { distance: number; duration: number };
  geometry: { coordinates: [number, number][] };
  segments?: { distance: number; duration: number }[];
}
