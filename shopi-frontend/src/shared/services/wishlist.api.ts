/* ================================================================
 * FICHIER : src/shared/services/wishlist.api.ts
 *
 * RÔLE : Appels API pour la liste de souhaits d'un client — distincte
 *        des favoris (❤️, voir favoris.api.ts) : liste personnelle
 *        privée, sans effet de bord public (pas de compteur, pas de
 *        notification au vendeur, pas de score "tendances").
 *
 * ENDPOINTS :
 *   GET  /client/wishlist            → liste des produits
 *   GET  /client/wishlist/ids        → IDs des produits présents
 *   POST /client/wishlist/:id/toggle → ajouter / retirer
 * ================================================================ */

import { apiFetch } from './apiFetch';

export interface WishlistItemApi {
  id:         string;
  productId:  string;
  nom:        string;
  prix:       number;
  prixAncien: number | null;
  emoji:      string;
  imageUrl:   string | null;
}

export interface ToggleWishlistResult {
  added: boolean;
}

export function fetchMaWishlist(): Promise<WishlistItemApi[]> {
  return apiFetch<WishlistItemApi[]>('/client/wishlist');
}

export function fetchWishlistIds(): Promise<string[]> {
  return apiFetch<string[]>('/client/wishlist/ids');
}

export function toggleWishlist(productId: string): Promise<ToggleWishlistResult> {
  return apiFetch<ToggleWishlistResult>(`/client/wishlist/${productId}/toggle`, { method: 'POST' });
}
