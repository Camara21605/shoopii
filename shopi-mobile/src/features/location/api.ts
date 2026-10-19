/**
 * Carte « Localisation » — mêmes adresses que le site (actor-map.controller.ts,
 * tracking.controller.ts) :
 *   GET  /location/map/search   entreprises, livreurs, correspondants (nom, quartier, ville,
 *                               ou « autour de » une position dans un rayon)
 *   GET  /location/map/places   quartiers, communes, villes correspondant à la saisie
 *   GET  /location/map/locate   coordonnées d'un lieu choisi
 *   POST /location/route        itinéraire (OpenRouteService via le serveur, repli ligne droite)
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

export type MapActorRole = 'vendor' | 'delivery' | 'correspondent';
export const ALL_ROLES: MapActorRole[] = ['vendor', 'delivery', 'correspondent'];

const actorSchema = z.object({
  id: z.string(),
  role: z.enum(['vendor', 'delivery', 'correspondent']),
  name: z.string(),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  /** true = position déduite du quartier / de la ville (pas un GPS) */
  approx: z.boolean(),
  precision: z.enum(['exact', 'quartier', 'commune', 'ville']),
  ville: z.string().nullable(),
  quartier: z.string().nullable(),
  localisation: z.string().nullable(),
  address: z.string().nullable(),
  image: z.string().nullable(),
  rating: z.coerce.number().nullable(),
  available: z.boolean().nullable(),
  distanceKm: z.coerce.number().nullable(),
  profilePath: z.string(),
});
export type MapActor = z.infer<typeof actorSchema>;

const searchSchema = z.object({
  results: z.array(actorSchema),
  meta: z.object({
    mode: z.enum(['search', 'nearby']),
    total: z.number(),
    approx: z.number(),
    byRole: z.object({ vendor: z.number(), delivery: z.number(), correspondent: z.number() }),
    truncated: z.boolean(),
  }),
});
export type MapSearchResponse = z.infer<typeof searchSchema>;
export type MapSearchMeta = MapSearchResponse['meta'];

export const EMPTY_META: MapSearchMeta = {
  mode: 'search', total: 0, approx: 0, truncated: false, byRole: { vendor: 0, delivery: 0, correspondent: 0 },
};

export function searchMapActors(
  p: { q?: string; types?: MapActorRole[]; lat?: number; lng?: number; radiusKm?: number; limit?: number },
  signal?: AbortSignal,
) {
  return apiFetch('/location/map/search', {
    schema: searchSchema,
    signal,
    query: {
      q: p.q?.trim() || undefined,
      types: p.types?.length ? p.types.join(',') : undefined,
      lat: p.lat, lng: p.lng, radiusKm: p.radiusKm, limit: p.limit,
    },
  });
}

const placeSchema = z.object({
  key: z.string(),
  name: z.string(),
  type: z.enum(['ville', 'commune', 'quartier']),
  ville: z.string(),
  commune: z.string().nullable(),
  /** « Boussoura · Kaloum, Conakry » */
  label: z.string(),
});
export type MapPlace = z.infer<typeof placeSchema>;

export async function suggestPlaces(q: string, signal?: AbortSignal): Promise<MapPlace[]> {
  const r = await apiFetch('/location/map/places', { schema: z.object({ places: z.array(placeSchema).optional() }), query: { q }, signal });
  return r.places ?? [];
}

const locatedSchema = z.object({
  position: z
    .object({
      lat: z.coerce.number(),
      lng: z.coerce.number(),
      precision: z.enum(['quartier', 'commune', 'ville']),
      label: z.string().optional(),
    })
    .nullable(),
});
export type LocatedPlace = NonNullable<z.infer<typeof locatedSchema>['position']>;

export async function locatePlace(input: {
  nom: string; type: MapPlace['type'] | 'libre'; commune?: string | null; ville?: string | null;
}): Promise<LocatedPlace | null> {
  const r = await apiFetch('/location/map/locate', {
    schema: locatedSchema,
    query: { nom: input.nom, type: input.type, commune: input.commune ?? undefined, ville: input.ville ?? undefined },
  });
  return r.position;
}

export type RouteProfile = 'car' | 'moto' | 'foot';
export type RouteManeuver =
  | 'depart' | 'arrive' | 'straight' | 'left' | 'right' | 'slight-left' | 'slight-right'
  | 'sharp-left' | 'sharp-right' | 'uturn' | 'roundabout' | 'keep-left' | 'keep-right';

const stepSchema = z.object({
  text: z.string().catch(''),
  maneuver: z.string().catch('straight') as unknown as z.ZodType<RouteManeuver>,
  road: z.string().nullable().catch(null),
  distanceM: z.coerce.number().catch(0),
  durationS: z.coerce.number().catch(0),
  at: z.tuple([z.number(), z.number()]),
});
export type RouteStep = z.infer<typeof stepSchema>;

const routeSchema = z.object({
  polyline: z.array(z.tuple([z.number(), z.number()])),
  totalDistanceTxt: z.string(),
  totalDurationTxt: z.string(),
  totalDistanceM: z.coerce.number().catch(0),
  totalDurationS: z.coerce.number().catch(0),
  /* Absents d'un ancien serveur : guidage vide, considéré comme routier. */
  steps: z.array(stepSchema).catch([]),
  provider: z.string().catch('openrouteservice'),
});
export type RouteResult = z.infer<typeof routeSchema>;

/** Itinéraire par les routes (voiture par défaut ; moto, à pied — écran Itinéraire). */
export function fetchRoute(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  profile: RouteProfile = 'car',
) {
  return apiFetch('/location/route', { method: 'POST', schema: routeSchema, body: { waypoints: [from, to], profile } });
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}
