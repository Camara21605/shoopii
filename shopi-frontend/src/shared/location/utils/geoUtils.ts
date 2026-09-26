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

/** Fond de carte commun à toutes les cartes du site (accueil, tableaux de bord…).
 *  Style « OpenStreetMap France » : mêmes données qu'OpenStreetMap, mais rues
 *  plus larges et mieux contrastées, routes principales en couleur, sentiers en
 *  pointillés et noms de quartiers plus lisibles que le style OSM standard —
 *  comparé tuile par tuile sur Kindia/Conakry. Sans clé API. */
type TileOpts = { url: string; attribution: string; maxZoom: number; minZoom?: number; className?: string; subdomains?: string; maxNativeZoom?: number };

/** Au-delà de ce zoom, le fond « vue d'ensemble » cède la place aux rues (voir BaseTiles). */
export const OVERVIEW_MAX_ZOOM = 13;

/* Vue d'ensemble (de loin), comme Google Maps : fond neutre SANS AUCUN NOM + calque
 * des routes principales seules (Esri, sans clé API). Les noms (pays, préfectures,
 * villes, communes, quartiers) sont tous dessinés par PlaceLabels, en grand et
 * lisibles — le fond précédent (World Street Map) écrivait ses propres noms, petits
 * et en double avec les nôtres. */
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const ESRI_ATTR = 'Fond © <a href="https://www.esri.com">Esri</a>, HERE, Garmin';

export const OVERVIEW_BASE_LIGHT: TileOpts = {
  url: `${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, attribution: ESRI_ATTR, maxZoom: OVERVIEW_MAX_ZOOM,
};
export const OVERVIEW_BASE_DARK: TileOpts = {
  url: `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, attribution: ESRI_ATTR, maxZoom: OVERVIEW_MAX_ZOOM,
};
/** Routes principales seules (fond transparent), posées sur le fond neutre. */
export const OVERVIEW_ROADS: TileOpts = {
  url: `${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`, attribution: '', maxZoom: OVERVIEW_MAX_ZOOM,
};

export const OSM_TILE: TileOpts = {
  url:           'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
  minZoom:       OVERVIEW_MAX_ZOOM + 1,
  attribution:   '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · fond © <a href="https://www.openstreetmap.fr">OpenStreetMap France</a>',
  subdomains:    'abc',
  maxNativeZoom: 19,
  maxZoom:       20,
};

/** Classe CSS des tuiles en mode sombre — voir global.css (.shopi-tiles-dark). */
export const DARK_TILE_CLASS = 'shopi-tiles-dark';

/** Options tuile sombre.
 *  BUG CORRIGÉ — c'était CARTO Dark Matter (basemaps.cartocdn.com) : CARTO
 *  exige désormais une clé API et renvoie à la place des tuiles barrées
 *  "API KEY REQUIRED" — toutes les cartes en mode sombre en étaient
 *  couvertes. On garde les tuiles OpenStreetMap (sans clé) assombries
 *  par un filtre CSS : le `className` DOIT être passé au <TileLayer>
 *  (avec une `key` différente clair/sombre, l'URL étant identique). */
export const DARK_TILE: TileOpts = {
  ...OSM_TILE,
  className: DARK_TILE_CLASS,
};
