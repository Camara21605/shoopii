/* ================================================================
 * src/modules/home/components/produit/api/produit.api.ts
 * Tous les appels API liés aux produits, livreurs, correspondants
 * ================================================================ */

import { apiFetch } from '../../../../../shared/services/apiFetch';
import type { ProduitApi } from '../pages/ProduitPage';

/* ── Types backend ──
 * BUG CORRIGÉ : ce type mimait l'ancien mock (nom/rating/totalTrips) mais
 * ne correspondait à AUCUN endpoint réel — getLivreurs() ci-dessous
 * appelait /public/livreurs?ville=, une route qui n'a jamais existé,
 * donc tombait systématiquement sur le fallback mock (LIVREURS_DATA,
 * frais inventés). La vraie route est /public/boutiques/:id/livreurs
 * (PublicLivreurResponse, voir public.service.ts backend) — champs
 * alignés dessus ; le mapping vers le type d'affichage `Livreur` se
 * fait dans LivraisonSection.tsx (toLivreur()). */
export interface LivreurApi {
  id:           string;
  fullName:     string;
  zone:         string | null;
  availability: string;
  phone:        string | null;
  emoji:        string;
  note:         number;
  trips:        number;
  baseFee:      number;
  online:       boolean;
  distZone:     'local' | 'near' | 'far';
  source:       'client' | 'boutique' | 'both';
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

/** Tarif de livraison réel pour une destination — voir GeoZone (backend),
 * géré par un administrateur (permission "geo_zones" accordée par le
 * super-admin), PAS par le livreur. */
export interface FraisLivraisonApi { fraisLivraison: number; zoneNom: string | null; }

export const produitApi = {
  /* Produit par ID */
  getById: (id: string) =>
    apiFetch<ProduitApi>(`/public/produits/${id}`, { public: true }),

  /* Produits similaires (même catégorie) */
  getSimilaires: (produitId: string, limit = 5) =>
    apiFetch<SimilaireApi[]>(`/public/produits/${produitId}/similaires?limit=${limit}`, { public: true }),

  /* Livreurs rattachés à la boutique du produit (tarifs réels) — BUG
   * CORRIGÉ : appelait /public/livreurs?ville=, route inexistante. */
  getLivreurs: (companyId: string) =>
    apiFetch<LivreurApi[]>(`/public/boutiques/${companyId}/livreurs`, { public: true }),

  /* Correspondants disponibles */
  getCorrespondants: (region?: string) =>
    apiFetch<CorrespondantApi[]>(`/public/correspondants${region ? `?region=${encodeURIComponent(region)}` : ''}`, { public: true }),

  /* Tarif de livraison réel de la zone couvrant cette destination
   * (GeoZone.fraisLivraison — géré par un administrateur, pas par le
   * livreur). Route publique, GeoController. */
  getFraisLivraison: (ville: string) =>
    apiFetch<FraisLivraisonApi>(`/geo/frais-livraison?ville=${encodeURIComponent(ville)}`, { public: true }),
};