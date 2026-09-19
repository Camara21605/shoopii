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

/* ── Lieux (villes, communes, quartiers) ─────────────────────── */

export type PlaceKind = 'ville' | 'commune' | 'quartier';

export interface MapPlace {
  key:     string;
  name:    string;
  type:    PlaceKind;
  ville:   string;
  commune: string | null;
  /** « Boussoura · Kaloum, Conakry » */
  label:   string;
}

export interface LocatedPlace {
  lat:       number;
  lng:       number;
  precision: 'quartier' | 'commune' | 'ville';
  label?:    string;
}

/** Suggestions locales (aucun appel externe côté serveur) — utilisable à la frappe. */
export async function suggestPlaces(q: string, signal?: AbortSignal): Promise<MapPlace[]> {
  const r = await apiFetch<{ places: MapPlace[] }>('/location/map/places', { params: { q }, signal } as any);
  return r.places ?? [];
}

/** Coordonnées d'un lieu choisi (une requête par choix). `type: 'libre'` = texte tapé tel quel. */
export async function locatePlace(
  input: { nom: string; type: PlaceKind | 'libre'; commune?: string | null; ville?: string | null },
): Promise<LocatedPlace | null> {
  const params: Record<string, string> = { nom: input.nom, type: input.type };
  if (input.commune) params.commune = input.commune;
  if (input.ville)   params.ville   = input.ville;
  const r = await apiFetch<{ position: LocatedPlace | null }>('/location/map/locate', { params });
  return r.position;
}
