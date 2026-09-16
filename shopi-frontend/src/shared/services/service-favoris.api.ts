/* ================================================================
 * FICHIER : src/shared/services/service-favoris.api.ts
 *
 * RÔLE : Appels API pour les prestations favorites (❤️) d'un client.
 *   Miroir exact de favoris.api.ts (produits) pour l'entité Service.
 *
 * ENDPOINTS :
 *   GET  /client/favoris-services            → liste des prestations favorites
 *   GET  /client/favoris-services/ids        → IDs des prestations likées
 *   POST /client/favoris-services/:id/toggle → like / unlike
 * ================================================================ */

import { apiFetch } from './apiFetch';

export interface ServiceFavoriApi {
  id:          string;
  serviceId:   string;
  nom:         string;
  prix:        number | null;
  prixAncien:  number | null;
  pricingType: string;
  emoji:       string;
  imageUrl:    string | null;
}

export interface ToggleServiceFavoriResult {
  liked:      boolean;
  likesCount: number;
}

export function fetchMesFavorisServices(): Promise<ServiceFavoriApi[]> {
  return apiFetch<ServiceFavoriApi[]>('/client/favoris-services');
}

export function fetchFavorisServicesIds(): Promise<string[]> {
  return apiFetch<string[]>('/client/favoris-services/ids');
}

export function toggleFavoriService(serviceId: string): Promise<ToggleServiceFavoriResult> {
  return apiFetch<ToggleServiceFavoriResult>(`/client/favoris-services/${serviceId}/toggle`, { method: 'POST' });
}
