/* ================================================================
 * FICHIER : src/shared/location/utils/mapLayers.ts
 *
 * Fonds de carte disponibles sur la carte de recherche :
 *   - Plan       : fond commun du site (voir BaseTiles)
 *   - Satellite  : Esri World Imagery + routes par-dessus
 * (Relief retiré à la demande : plus proposé sur la carte.)
 * Sources publiques sans clé d'API ; l'attribution de chaque fournisseur est
 * affichée sur la carte (obligation de leurs conditions d'utilisation).
 * ================================================================ */

import { DARK_TILE, OSM_TILE } from './geoUtils';

export type MapStyleId = 'plan' | 'satellite';

export interface TileDef {
  url:            string;
  attribution:    string;
  /** Classe CSS du calque (ex. filtre sombre, voir DARK_TILE) */
  className?:     string;
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
  /** Calque superposé au fond (routes du satellite) */
  overlay?: TileDef;
}

/* BUG CORRIGÉ — c'était CARTO Voyager (basemaps.cartocdn.com), qui exige
 * désormais une clé API (tuiles barrées "API KEY REQUIRED") : même fond
 * que toutes les autres cartes du site (OSM_TILE), sans clé. */
const PLAN_TILE: TileDef = { ...OSM_TILE };

const ESRI_ATTR = 'Imagerie © <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics';

export const MAP_STYLES: Record<MapStyleId, MapStyleDef> = {
  plan: {
    id: 'plan', label: 'Plan', icon: 'fa-map',
    /* Clair : OpenStreetMap ; sombre : les mêmes tuiles assombries (DARK_TILE) */
    base: dark => dark ? { ...DARK_TILE } : { ...PLAN_TILE },
  },
  satellite: {
    id: 'satellite', label: 'Satellite', icon: 'fa-satellite',
    base: () => ({
      url:           'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution:   ESRI_ATTR,
      maxNativeZoom: 18,
      maxZoom:       19,
    }),
    /* Routes seules par-dessus l'image (pas de noms : ceux de PlaceLabels, plus
     * lisibles, sont les seuls affichés — les noms Esri faisaient doublon). */
    overlay: {
      url:           'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
      attribution:   '',
      maxNativeZoom: 18,
      maxZoom:       19,
    },
  },
};

export const MAP_STYLE_ORDER: MapStyleId[] = ['plan', 'satellite'];

const STORAGE_KEY = 'shoneya.map.style';

/** Dernier fond choisi (ou `fallback`) — le stockage peut être indisponible (navigation privée).
 *  Une ancienne préférence « relief » (fond retiré) retombe sur `fallback`. */
export function readStoredStyle(fallback: MapStyleId = 'plan'): MapStyleId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && v in MAP_STYLES ? (v as MapStyleId) : fallback;
  } catch { return fallback; }
}

export function storeStyle(id: MapStyleId): void {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* préférence non conservée */ }
}
