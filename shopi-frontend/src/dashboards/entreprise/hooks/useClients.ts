/* ============================================================
 * FICHIER : hooks/useClients.ts
 *
 * RÔLE : Charge et filtre les clients de l'entreprise.
 *        Source : GET /dashboard/entreprise/clients
 *
 * DEUX SOURCES FUSIONNÉES CÔTÉ BACKEND :
 *   1. Acheteurs  → clients ayant passé au moins une commande
 *   2. Abonnés    → clients qui suivent la boutique (Follow)
 * ============================================================ */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';

/* ── Types ── */

export type ClientSegment = 'VIP' | 'Fidèle' | 'Régulier' | 'Nouveau' | 'Abonné';

export interface ClientRow {
  id:             string;
  userId:         string;
  fullName:       string;
  email:          string;
  profilePicture: string | null;
  totalOrders:    number;
  totalSpent:     number;    // GNF
  lastOrderAt:    string | null;
  isSuivi:        boolean;
  segment:        ClientSegment;
  createdAt:      string;
}

export interface ClientsStats {
  total:       number;
  buyers:      number;
  abonnes:     number;
  vip:         number;
  fideles:     number;
  reguliers:   number;
  nouveaux:    number;
  caTotal:     number;
  panierMoyen: number;
}

export interface ClientsResult {
  data:  ClientRow[];
  total: number;
  page:  number;
  pages: number;
  stats: ClientsStats;
}

export interface ClientsFilters {
  search?:    string;
  segment?:   ClientSegment | 'all';
  source?:    'buyers' | 'abonnes' | 'all';
  page?:      number;
  limit?:     number;
  sortBy?:    'totalSpent' | 'totalOrders' | 'lastOrderAt' | 'createdAt';
  sortOrder?: 'ASC' | 'DESC';
}

/* ── Hook principal ── */

export function useClients() {
  const [result,  setResult]  = useState<ClientsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [filters, setFilters] = useState<ClientsFilters>({
    segment:   'all',
    source:    'all',
    page:      1,
    limit:     20,
    sortBy:    'totalSpent',
    sortOrder: 'DESC',
  });

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    /* Construire les query params */
    const params = new URLSearchParams();
    if (filters.search?.trim()) params.set('search',    filters.search.trim());
    if (filters.segment && filters.segment !== 'all') params.set('segment', filters.segment);
    if (filters.source  && filters.source  !== 'all') params.set('source',  filters.source);
    if (filters.sortBy)    params.set('sortBy',    filters.sortBy);
    if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
    params.set('page',  String(filters.page  ?? 1));
    params.set('limit', String(filters.limit ?? 20));

    apiFetch<ClientsResult>(`/dashboard/entreprise/clients?${params}`)
      .then(data => setResult(data))
      .catch(e => setError(e?.message ?? 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  /* Mettre à jour un filtre (reset page à 1) */
  const applyFilter = useCallback((patch: Partial<ClientsFilters>) => {
    setFilters(prev => ({ ...prev, ...patch, page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters(prev => ({ ...prev, page }));
  }, []);

  return {
    clients:  result?.data    ?? [],
    stats:    result?.stats   ?? null,
    total:    result?.total   ?? 0,
    pages:    result?.pages   ?? 0,
    loading,
    error,
    filters,
    applyFilter,
    setPage,
    reload: load,
  };
}
