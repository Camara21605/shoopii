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

/** Mode de déplacement (écran Itinéraire de l'appli, comme Google Maps). */
export type RouteProfile = 'car' | 'moto' | 'foot';

/** Manœuvre à effectuer (guidage pas à pas). */
export type RouteManeuver =
  'depart' | 'arrive' | 'straight' | 'left' | 'right' | 'slight-left' | 'slight-right'
  | 'sharp-left' | 'sharp-right' | 'uturn' | 'roundabout' | 'keep-left' | 'keep-right';

export interface RouteStep {
  /** Consigne en français (« Tournez à droite sur Route du Niger »). */
  text:       string;
  maneuver:   RouteManeuver;
  /** Nom de la voie, si connu. */
  road:       string | null;
  distanceM:  number;
  durationS:  number;
  /** Point où la manœuvre a lieu [lat, lng]. */
  at:         [number, number];
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
  /** Guidage pas à pas (vide pour une ligne droite). */
  steps:           RouteStep[];
  profile:         RouteProfile;
  /** Provider ayant répondu (pour logs/monitoring) */
  provider:        'openrouteservice' | 'osrm' | 'straight-line-fallback';
}

/* Vitesses moyennes en ville (Conakry) pour les modes que le routeur ne calcule pas lui-même. */
const KMH: Record<RouteProfile, number> = { car: 30, moto: 35, foot: 4.8 };
/* Une moto se faufile : ~20 % plus rapide qu'une voiture sur le même trajet. */
const MOTO_FACTOR = 0.8;

@Injectable()
export class RouteService {

  private readonly logger = new Logger(RouteService.name);
  private readonly ORS_BASE = 'https://api.openrouteservice.org/v2/directions';
  /* Serveur public OSRM (sans clé) — itinéraire routier réel quand ORS n'est pas configuré. */
  private readonly OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

  constructor(private readonly config: ConfigService) {}

  /* ── Calcul d'itinéraire principal ─────────────────────────── */

  /**
   * Itinéraire entre N points GPS, par les routes :
   *   1. OpenRouteService si OPENROUTESERVICE_API_KEY est défini (voiture, marche, guidage en français) ;
   *   2. sinon / en panne : OSRM public (sans clé) ;
   *   3. en dernier recours : ligne droite (distance à vol d'oiseau).
   */
  async getRoute(waypoints: ICoordinates[], profile: RouteProfile = 'car'): Promise<RouteResult> {
    if (waypoints.length < 2) {
      throw new Error('Au moins 2 points de passage sont requis.');
    }

    const apiKey = this.config.get<string>('OPENROUTESERVICE_API_KEY');
    if (apiKey && apiKey !== 'VOTRE_CLE_ORS') {
      try {
        return await this.callOrsApi(waypoints, apiKey, profile);
      } catch (err: any) {
        this.logger.warn(`[Route] ORS indisponible (${err.message}) — essai OSRM`);
      }
    }
    try {
      return await this.callOsrm(waypoints, profile);
    } catch (err: any) {
      this.logger.warn(`[Route] OSRM indisponible (${err.message}) — fallback ligne droite`);
      return this.buildStraightLineFallback(waypoints, profile);
    }
  }

  /* ── OpenRouteService (GeoJSON : la géométrie arrive en coordonnées) ── */

  private async callOrsApi(waypoints: ICoordinates[], apiKey: string, profile: RouteProfile): Promise<RouteResult> {
    /* ORS attend [longitude, latitude]. */
    const orsProfile = profile === 'foot' ? 'foot-walking' : 'driving-car';
    const res = await fetch(`${this.ORS_BASE}/${orsProfile}/geojson`, {
      method:  'POST',
      headers: { 'Authorization': apiKey, 'Content-Type': 'application/json', 'Accept': 'application/geo+json' },
      body: JSON.stringify({
        coordinates:  waypoints.map(w => [w.longitude, w.latitude]),
        instructions: true,
        language:     'fr',
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ServiceUnavailableException(`ORS API error ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json() as OrsGeoJson;
    const feature = data.features?.[0];
    const coords = feature?.geometry?.coordinates ?? [];
    if (!feature || coords.length < 2) throw new Error('ORS : aucun itinéraire retourné');

    const polyline = coords.map(([lng, lat]) => [lat, lng] as [number, number]);
    const factor = profile === 'moto' ? MOTO_FACTOR : 1;
    const ORS_TYPE: RouteManeuver[] = ['left', 'right', 'sharp-left', 'sharp-right', 'slight-left', 'slight-right',
      'straight', 'roundabout', 'roundabout', 'uturn', 'arrive', 'depart', 'keep-left', 'keep-right'];
    const steps: RouteStep[] = (feature.properties.segments ?? []).flatMap(seg => (seg.steps ?? []).map(st => ({
      text:      st.instruction,
      maneuver:  ORS_TYPE[st.type] ?? 'straight',
      road:      st.name && st.name !== '-' ? st.name : null,
      distanceM: st.distance,
      durationS: st.duration * factor,
      at:        polyline[Math.min(st.way_points?.[0] ?? 0, polyline.length - 1)],
    })));
    const { distance, duration } = feature.properties.summary;
    return this.result(polyline, distance, duration * factor, steps, profile, 'openrouteservice', waypoints);
  }

  /* ── OSRM public (voiture) — consignes rédigées ici en français ── */

  private async callOsrm(waypoints: ICoordinates[], profile: RouteProfile): Promise<RouteResult> {
    const coords = waypoints.map(w => `${w.longitude},${w.latitude}`).join(';');
    const res = await fetch(`${this.OSRM_BASE}/${coords}?overview=full&geometries=geojson&steps=true`, {
      headers: { 'User-Agent': 'Shoneya/1.0 (shoneya.com)' },
      signal:  AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new ServiceUnavailableException(`OSRM ${res.status}`);
    const data = await res.json() as OsrmResponse;
    const route = data.routes?.[0];
    if (data.code !== 'Ok' || !route || (route.geometry?.coordinates?.length ?? 0) < 2) {
      throw new Error(`OSRM : ${data.code ?? 'aucun itinéraire'}`);
    }
    const polyline = route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
    /* Le serveur public ne calcule que la voiture : moto et marche sont déduites de la distance. */
    const durOf = (d: number, carS: number) =>
      profile === 'foot' ? d / (KMH.foot / 3.6) : profile === 'moto' ? carS * MOTO_FACTOR : carS;
    const steps: RouteStep[] = route.legs.flatMap(leg => leg.steps.map(st => {
      const maneuver = osrmManeuver(st.maneuver.type, st.maneuver.modifier);
      const road = st.name?.trim() || null;
      return {
        text: frenchInstruction(maneuver, road, st.maneuver.exit, profile),
        maneuver, road,
        distanceM: st.distance,
        durationS: durOf(st.distance, st.duration),
        at: [st.maneuver.location[1], st.maneuver.location[0]] as [number, number],
      };
    }));
    return this.result(polyline, route.distance, durOf(route.distance, route.duration), steps, profile, 'osrm', waypoints);
  }

  private result(
    polyline: [number, number][], distanceM: number, durationS: number, steps: RouteStep[],
    profile: RouteProfile, provider: RouteResult['provider'], waypoints: ICoordinates[],
  ): RouteResult {
    return {
      polyline,
      totalDistanceM:   distanceM,
      totalDistanceTxt: this.formatDistance(distanceM),
      totalDurationS:   durationS,
      totalDurationTxt: this.formatDuration(durationS),
      segments:         [{ distance: distanceM, duration: durationS, waypoints: waypoints.map(w => [w.longitude, w.latitude]) }],
      steps,
      profile,
      provider,
    };
  }

  /* ── Fallback ligne droite ──────────────────────────────────── */

  /**
   * Calcule une distance approximative en ligne droite (Haversine)
   * lorsque l'API ORS est indisponible ou non configurée.
   * ETA basé sur une vitesse moyenne de 30 km/h en ville.
   */
  private buildStraightLineFallback(waypoints: ICoordinates[], profile: RouteProfile = 'car'): RouteResult {
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
          duration:  Math.round((dM / 1000) / KMH[profile] * 3600),
          waypoints: [
            [waypoints[i - 1].longitude, waypoints[i - 1].latitude],
            [waypoints[i].longitude,     waypoints[i].latitude],
          ],
        });
      }
    }

    const totalDurationS = Math.round((totalDistanceM / 1000) / KMH[profile] * 3600);

    return {
      polyline,
      totalDistanceM,
      totalDistanceTxt: this.formatDistance(totalDistanceM),
      totalDurationS,
      totalDurationTxt: this.formatDuration(totalDurationS),
      segments,
      steps:            [],
      profile,
      provider:         'straight-line-fallback',
    };
  }

  /* ── Helpers privés ─────────────────────────────────────────── */

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

/* ── Consignes en français (OSRM ne les fournit qu'en anglais) ── */

function osrmManeuver(type: string, modifier?: string): RouteManeuver {
  if (type === 'depart') return 'depart';
  if (type === 'arrive') return 'arrive';
  if (type === 'roundabout' || type === 'rotary' || type === 'exit roundabout' || type === 'exit rotary') return 'roundabout';
  switch (modifier) {
    case 'left':         return type === 'fork' || type === 'off ramp' ? 'keep-left' : 'left';
    case 'right':        return type === 'fork' || type === 'off ramp' ? 'keep-right' : 'right';
    case 'slight left':  return 'slight-left';
    case 'slight right': return 'slight-right';
    case 'sharp left':   return 'sharp-left';
    case 'sharp right':  return 'sharp-right';
    case 'uturn':        return 'uturn';
    default:             return 'straight';
  }
}

export function frenchInstruction(m: RouteManeuver, road: string | null, exit: number | undefined, profile: RouteProfile): string {
  const sur = road ? ` sur ${road}` : '';
  switch (m) {
    case 'depart':       return `${profile === 'foot' ? 'Marchez' : 'Partez'}${road ? ` sur ${road}` : ''}`;
    case 'arrive':       return 'Vous êtes arrivé à destination';
    case 'left':         return `Tournez à gauche${sur}`;
    case 'right':        return `Tournez à droite${sur}`;
    case 'slight-left':  return `Tournez légèrement à gauche${sur}`;
    case 'slight-right': return `Tournez légèrement à droite${sur}`;
    case 'sharp-left':   return `Tournez franchement à gauche${sur}`;
    case 'sharp-right':  return `Tournez franchement à droite${sur}`;
    case 'keep-left':    return `Restez à gauche${sur}`;
    case 'keep-right':   return `Restez à droite${sur}`;
    case 'uturn':        return `Faites demi-tour${sur}`;
    case 'roundabout':   return `Au rond-point, prenez la ${exit ? `${exit}${exit === 1 ? 're' : 'e'} sortie` : 'sortie'}${sur}`;
    default:             return `Continuez tout droit${sur}`;
  }
}

/* ── Types des réponses ── */

interface OrsGeoJson {
  features: {
    geometry:   { coordinates: [number, number][] };
    properties: {
      summary:   { distance: number; duration: number };
      segments?: { distance: number; duration: number; steps?: { distance: number; duration: number; type: number; instruction: string; name?: string; way_points?: [number, number] }[] }[];
    };
  }[];
}

interface OsrmResponse {
  code: string;
  routes?: {
    distance: number; duration: number;
    geometry: { coordinates: [number, number][] };
    legs: { steps: { distance: number; duration: number; name?: string; maneuver: { type: string; modifier?: string; exit?: number; location: [number, number] } }[] }[];
  }[];
}
