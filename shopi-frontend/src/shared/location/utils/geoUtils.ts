/* ============================================================
 * FICHIER : src/shared/location/utils/geoUtils.ts
 * RÔLE    : Utilitaires géographiques côté frontend
 *           (miroir léger de GeoService backend)
 * ============================================================ */

import type { Coordinates } from '../types/location.types';

const EARTH_RADIUS_KM = 6371;

/** Formule Haversine — distance en km */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat  = toRad(b.latitude  - a.latitude);
  const dLng  = toRad(b.longitude - a.longitude);
  const lat1  = toRad(a.latitude);
  const lat2  = toRad(b.latitude);
  const x     =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c     = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return Math.round(EARTH_RADIUS_KM * c * 100) / 100;
}

/** Distance en mètres */
export function distanceM(a: Coordinates, b: Coordinates): number {
  return distanceKm(a, b) * 1000;
}

/** Distance lisible : "250 m" ou "3.4 km" */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/** Temps estimé à moto (30 km/h) */
export function estimatedDuration(km: number, vitesseMoyenneKmh = 30): string {
  const minutes = Math.ceil((km / vitesseMoyenneKmh) * 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m} min` : `${h}h`;
}

/** Vérifier si le mouvement est significatif (> seuil mètres) */
export function isSignificantMove(
  prev:   Coordinates,
  next:   Coordinates,
  seuilM = 10,
): boolean {
  return distanceM(prev, next) >= seuilM;
}

/** Centroïde d'un tableau de coordonnées */
export function centroid(points: Coordinates[]): Coordinates {
  if (points.length === 0) return { latitude: 9.538, longitude: -13.677 }; // Conakry
  const sum = points.reduce(
    (acc, p) => ({ latitude: acc.latitude + p.latitude, longitude: acc.longitude + p.longitude }),
    { latitude: 0, longitude: 0 },
  );
  return {
    latitude:  sum.latitude  / points.length,
    longitude: sum.longitude / points.length,
  };
}

/** Coordonnées par défaut — Conakry, Guinée */
export const DEFAULT_CENTER: Coordinates = {
  latitude:  9.5370,
  longitude: -13.6773,
};

/** Zoom par défaut */
export const DEFAULT_ZOOM = 13;

/** Options tuile OpenStreetMap standard */
export const OSM_TILE = {
  url:         'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom:     19,
};

/** Options tuile sombre (CartoDB Dark Matter) */
export const DARK_TILE = {
  url:         'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com">CARTO</a>',
  maxZoom:     19,
};
