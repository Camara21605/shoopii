/* ================================================================
 * FICHIER : src/shared/services/favoris.api.ts
 *
 * RÔLE : Appels API pour les produits favoris (❤️) d'un client.
 *
 * ENDPOINTS :
 *   GET  /client/favoris            → liste des produits favoris
 *   GET  /client/favoris/ids        → IDs des produits likés
 *   POST /client/favoris/:id/toggle → like / unlike
 * ================================================================ */

import { apiFetch } from './apiFetch';

export interface FavoriApi {
  id:         string;
  productId:  string;
  nom:        string;
  prix:       number;
  prixAncien: number | null;
  emoji:      string;
  imageUrl:   string | null;
}

export interface ToggleFavoriResult {
  liked:      boolean;
  likesCount: number;
}

export function fetchMesFavoris(): Promise<FavoriApi[]> {
  return apiFetch<FavoriApi[]>('/client/favoris');
}

export function fetchFavorisIds(): Promise<string[]> {
  return apiFetch<string[]>('/client/favoris/ids');
}

export function toggleFavori(productId: string): Promise<ToggleFavoriResult> {
  return apiFetch<ToggleFavoriResult>(`/client/favoris/${productId}/toggle`, { method: 'POST' });
}
