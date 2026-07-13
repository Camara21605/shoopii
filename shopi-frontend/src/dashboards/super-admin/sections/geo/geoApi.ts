/* ================================================================
 * FICHIER : sections/geo/geoApi.ts
 *
 * Client HTTP pour le référentiel géographique.
 * Toutes les routes → /geo/*  (JwtAuthGuard + SUPER_ADMIN/ADMIN)
 * ================================================================ */

import { apiFetch } from '@/shared/services/apiFetch';
import type { GeoItem, ZoneLivraison, AllGeoData } from './geo.types';

const BASE = '/geo';

/* ── Params de filtre optionnels ── */
export interface GeoListParams {
  search?: string;
  statut?: 'actif' | 'inactif';
}

/* ── Réponse de /geo/all ── */
export interface GeoAllResponse extends AllGeoData {
  zones: GeoItem[];
}

/* ── Helper interne : construit la liste de query params ── */
function qp(params?: GeoListParams) {
  return params as Record<string, string | undefined> | undefined;
}

/* ================================================================
 * API PAR NIVEAU
 * ================================================================ */

function makeLevelApi(segment: string) {
  return {
    list:       (p?: GeoListParams)                   => apiFetch<GeoItem[]>(`${BASE}/${segment}`, { params: qp(p) }),
    create:     (data: Partial<GeoItem>)               => apiFetch<GeoItem>(`${BASE}/${segment}`, { method: 'POST', body: data }),
    update:     (id: string, data: Partial<GeoItem>)   => apiFetch<GeoItem>(`${BASE}/${segment}/${id}`, { method: 'PATCH', body: data }),
    remove:     (id: string)                           => apiFetch<void>(`${BASE}/${segment}/${id}`, { method: 'DELETE' }),
    toggle:     (id: string)                           => apiFetch<GeoItem>(`${BASE}/${segment}/${id}/toggle`, { method: 'PATCH' }),
    /* Bascule protection super-admin ↔ délégué (SUPER_ADMIN only) */
    delegation: (id: string)                           => apiFetch<GeoItem>(`${BASE}/${segment}/${id}/delegation`, { method: 'PATCH' }),
  };
}

export const geoApi = {
  /** Charge les 6 niveaux en une requête — pour les sélecteurs en cascade */
  all: () => apiFetch<GeoAllResponse>(`${BASE}/all`),

  pays:        makeLevelApi('pays'),
  regions:     makeLevelApi('regions'),
  prefectures: makeLevelApi('prefectures'),
  communes:    makeLevelApi('communes'),
  quartiers:   makeLevelApi('quartiers'),

  /* Les zones ont des champs supplémentaires (couvertureType/couvertureIds) */
  zones: {
    list:       (p?: GeoListParams)                         => apiFetch<ZoneLivraison[]>(`${BASE}/zones`, { params: qp(p) }),
    create:     (data: Partial<ZoneLivraison>)              => apiFetch<ZoneLivraison>(`${BASE}/zones`, { method: 'POST', body: data }),
    update:     (id: string, data: Partial<ZoneLivraison>)  => apiFetch<ZoneLivraison>(`${BASE}/zones/${id}`, { method: 'PATCH', body: data }),
    remove:     (id: string)                                => apiFetch<void>(`${BASE}/zones/${id}`, { method: 'DELETE' }),
    toggle:     (id: string)                                => apiFetch<ZoneLivraison>(`${BASE}/zones/${id}/toggle`, { method: 'PATCH' }),
    delegation: (id: string)                                => apiFetch<ZoneLivraison>(`${BASE}/zones/${id}/delegation`, { method: 'PATCH' }),
  },
};
