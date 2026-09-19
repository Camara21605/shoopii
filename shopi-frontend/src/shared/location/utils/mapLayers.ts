/* ================================================================
 * FICHIER : src/shared/location/utils/mapLayers.ts
 *
 * Fonds de carte disponibles sur la carte de recherche :
 *   - Plan       : OpenStreetMap (clair) / CARTO Dark Matter (thème sombre)
 *   - Relief     : OpenTopoMap — courbes de niveau, ombrage du relief, sentiers
 *   - Satellite  : Esri World Imagery + couche d'étiquettes (noms des lieux :
 *                  villes, quartiers, routes) activable — « hybride »
 * Sources publiques sans clé d'API ; l'attribution de chaque fournisseur est
 * affichée sur la carte (obligation de leurs conditions d'utilisation).
 * ================================================================ */

import { DARK_TILE } from './geoUtils';

export type MapStyleId = 'plan' | 'relief' | 'satellite';

export interface TileDef {
  url:            string;
  attribution:    string;
  subdomains?:    string;
  /** Zoom max réellement fourni par le serveur de tuiles */
  maxNativeZoom?: number;
  maxZoom:        number;
}

export interface MapStyleDef {
  id:     MapStyleId;
  label:  string;
  icon:   string;
  base:   (dark: boolean) => TileDef;
  /** Étiquettes superposées (noms des lieux) — uniquement pour le satellite */
  labels?: TileDef;
}

const VOYAGER_TILE: TileDef = {
  url:         'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com">CARTO</a>',
  subdomains:  'abcd',
  maxZoom:     19,
};

const ESRI_ATTR = 'Imagerie © <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics';

export const MAP_STYLES: Record<MapStyleId, MapStyleDef> = {
  plan: {
    id: 'plan', label: 'Plan', icon: 'fa-map',
    /* Clair : CARTO Voyager (rendu proche de Google Maps) ; sombre : CARTO Dark Matter */
    base: dark => dark
      ? { ...DARK_TILE, maxNativeZoom: 19 }
      : { ...VOYAGER_TILE, maxNativeZoom: 19 },
  },
  relief: {
    id: 'relief', label: 'Relief', icon: 'fa-mountain',
    base: () => ({
      url:           'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      subdomains:    'abc',
      attribution:   'Données © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM · Style © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
      maxNativeZoom: 17,
      maxZoom:       19,
    }),
  },
  satellite: {
    id: 'satellite', label: 'Satellite', icon: 'fa-satellite',
    base: () => ({
      url:           'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution:   ESRI_ATTR,
      maxNativeZoom: 18,
      maxZoom:       19,
    }),
    labels: {
      url:           'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      attribution:   'Étiquettes © Esri',
      maxNativeZoom: 18,
      maxZoom:       19,
    },
  },
};

export const MAP_STYLE_ORDER: MapStyleId[] = ['plan', 'relief', 'satellite'];

const STORAGE_KEY = 'shoneya.map.style';

/** Dernier fond choisi (ou `fallback`) — le stockage peut être indisponible (navigation privée). */
export function readStoredStyle(fallback: MapStyleId = 'plan'): MapStyleId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && v in MAP_STYLES ? (v as MapStyleId) : fallback;
  } catch { return fallback; }
}

export function storeStyle(id: MapStyleId): void {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* préférence non conservée */ }
}
