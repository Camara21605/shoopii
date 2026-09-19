/* ================================================================
 * FICHIER : src/shared/location/services/mapSearchApi.ts
 *
 * Client de la carte de recherche : GET /location/map/search
 * (entreprises, livreurs, correspondants — voir ActorMapService côté API).
 * ================================================================ */

import { apiFetch } from '../../services/apiFetch';

export type MapActorRole = 'vendor' | 'delivery' | 'correspondent';

export interface MapActor {
  id:           string;
  role:         MapActorRole;
  name:         string;
  lat:          number;
  lng:          number;
  /** true = position déduite du quartier / de la ville (pas un GPS) */
  approx:       boolean;
  precision:    'exact' | 'quartier' | 'commune' | 'ville';
  ville:        string | null;
  quartier:     string | null;
  localisation: string | null;
  address:      string | null;
  image:        string | null;
  rating:       number;
  available:    boolean | null;
  distanceKm:   number | null;
  profilePath:  string;
}

export interface MapSearchMeta {
  mode:      'search' | 'nearby';
  total:     number;
  approx:    number;
  byRole:    Record<MapActorRole, number>;
  truncated: boolean;
}

export interface MapSearchResponse {
  results: MapActor[];
  meta:    MapSearchMeta;
}

export interface MapSearchParams {
  q?:        string;
  types?:    MapActorRole[];
  lat?:      number;
  lng?:      number;
  radiusKm?: number;
  limit?:    number;
}

export const EMPTY_META: MapSearchMeta = {
  mode: 'search', total: 0, approx: 0, truncated: false, byRole: { vendor: 0, delivery: 0, correspondent: 0 },
};

/** `signal` permet d'annuler la requête précédente quand l'utilisateur continue de taper. */
export function searchMapActors(params: MapSearchParams, signal?: AbortSignal): Promise<MapSearchResponse> {
  const qs: Record<string, string> = {};
  if (params.q?.trim())        qs.q        = params.q.trim();
  if (params.types?.length)    qs.types    = params.types.join(',');
  if (params.lat != null)      qs.lat      = String(params.lat);
  if (params.lng != null)      qs.lng      = String(params.lng);
  if (params.radiusKm != null) qs.radiusKm = String(params.radiusKm);
  if (params.limit != null)    qs.limit    = String(params.limit);

  return apiFetch<MapSearchResponse>('/location/map/search', { params: qs, signal } as any);
}
