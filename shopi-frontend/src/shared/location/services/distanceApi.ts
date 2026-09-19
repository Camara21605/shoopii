/* ================================================================
 * FICHIER : src/shared/location/services/distanceApi.ts
 *
 * Distance du client à des entreprises, livreurs, correspondants :
 * POST /location/distances — calculée par le système de localisation
 * (voir ActorDistanceService côté API).
 * ================================================================ */

import { apiFetch } from '../../services/apiFetch';
import type { MapActorRole } from './mapSearchApi';

export interface ActorDistanceInfo {
  /** Distance à vol d'oiseau, en km (arrondie à 100 m) */
  km:        number;
  /** true = position de l'acteur déduite de son quartier / sa ville (pas un GPS) */
  approx:    boolean;
  precision: 'exact' | 'quartier' | 'commune' | 'ville';
}

export async function fetchActorDistances(
  from:   { lat: number; lng: number },
  actors: { role: MapActorRole; id: string }[],
): Promise<Record<string, ActorDistanceInfo>> {
  const r = await apiFetch<{ distances: Record<string, ActorDistanceInfo> }>('/location/distances', {
    method: 'POST', body: { lat: from.lat, lng: from.lng, actors },
  });
  return r.distances ?? {};
}
