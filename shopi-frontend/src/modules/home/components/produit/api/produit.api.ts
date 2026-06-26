/* ================================================================
 * src/modules/home/components/produit/api/produit.api.ts
 * Tous les appels API liés aux produits, livreurs, correspondants
 * ================================================================ */

import { apiFetch } from '../../../../../shared/services/apiFetch';
import type { ProduitApi } from '../pages/ProduitPage';

/* ── Types backend ── */
export interface LivreurApi {
  id:        string;
  nom:       string;
  emoji:     string;
  zone:      string;
  rating:    number;
  totalTrips:number;
  online:    boolean;
  baseFee:   number;
  distZone:  'local' | 'near' | 'far';
  source:    'client' | 'boutique' | 'both';
}

export interface CorrespondantApi {
  id:       string;
  nom:      string;
  emoji:    string;
  region:   string;
  type:     string;
  rating:   number;
  missions: number;
  online:   boolean;
  baseFee:  number;
}

export interface SimilaireApi {
  id:         string;
  nom:        string;
  prix:       number;
  prixAncien: number | null;
  imageUrl:   string | null;
  emoji:      string | null;
  shopNom:    string;
  shopId:     string;
  noteAvg:    number;
  nbAvis:     number;
  badge:      'hot' | 'new' | 'promo' | null;
}

export const produitApi = {
  /* Produit par ID */
  getById: (id: string) =>
    apiFetch<ProduitApi>(`/public/produits/${id}`, { public: true }),

  /* Produits similaires (même catégorie) */
  getSimilaires: (produitId: string, limit = 5) =>
    apiFetch<SimilaireApi[]>(`/public/produits/${produitId}/similaires?limit=${limit}`, { public: true }),

  /* Livreurs disponibles (optionnel : ville) */
  getLivreurs: (ville?: string) =>
    apiFetch<LivreurApi[]>(`/public/livreurs${ville ? `?ville=${encodeURIComponent(ville)}` : ''}`, { public: true }),

  /* Correspondants disponibles */
  getCorrespondants: (region?: string) =>
    apiFetch<CorrespondantApi[]>(`/public/correspondants${region ? `?region=${encodeURIComponent(region)}` : ''}`, { public: true }),
};