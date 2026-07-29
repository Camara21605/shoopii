/* ================================================================
 * FICHIER : src/modules/home/components/boutiques/hooks/useBoutiquesList.ts
 *
 * Charge les boutiques depuis GET /public/boutiques, filtrées côté
 * backend par catégorie / sous-catégorie / type d'entreprise / recherche.
 *
 * - Annule la requête précédente si les filtres changent avant sa fin
 *   (AbortController — évite qu'une réponse obsolète écrase l'état).
 * - Debounce 300ms sur la recherche texte uniquement (les clics
 *   catégorie/sous-catégorie déclenchent un fetch immédiat).
 * - Cache mémoire par combinaison de filtres+page (évite un refetch
 *   réseau en cas d'aller-retour rapide entre catégories).
 * - Pagination réelle : loadMore() ajoute la page suivante à la liste.
 * ================================================================ */

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../../../../../shared/services/apiFetch';
import type { BoutiqueCardData } from '../../../data/types';

export interface BoutiquesFilters {
  categoryId?:    string;
  subCategoryId?: string;
  companyTypeId?: string;
  search?:        string;
}

interface BoutiquesResponse {
  data:  BoutiqueCardData[];
  total: number;
  page:  number;
}

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 300;

/* Cache mémoire au niveau module — survit aux remounts tant que la page reste ouverte */
const cache = new Map<string, BoutiquesResponse>();

function cacheKey(filters: BoutiquesFilters, debouncedSearch: string, page: number): string {
  return JSON.stringify({
    categoryId:    filters.categoryId    ?? null,
    subCategoryId: filters.subCategoryId ?? null,
    companyTypeId: filters.companyTypeId ?? null,
    search:        debouncedSearch       || null,
    page,
  });
}

export function useBoutiquesList(filters: BoutiquesFilters) {
  const [boutiques, setBoutiques] = useState<BoutiqueCardData[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);

  const [debouncedSearch, setDebouncedSearch] = useState(filters.search ?? '');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef        = useRef<AbortController | null>(null);

  /* ── Debounce de la recherche texte ── */
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(filters.search ?? '');
    }, SEARCH_DEBOUNCE_MS);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [filters.search]);

  const fetchPage = useCallback(async (pageNum: number, replace: boolean) => {
    const key = cacheKey(filters, debouncedSearch, pageNum);
    const cached = cache.get(key);

    if (cached) {
      setBoutiques(prev => replace ? cached.data : [...prev, ...cached.data]);
      setTotal(cached.total);
      setPage(pageNum);
      setError(null);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch<BoutiquesResponse>('/public/boutiques', {
        public: true,
        signal: controller.signal,
        params: {
          page:          pageNum,
          limit:         PAGE_SIZE,
          categoryId:    filters.categoryId,
          subCategoryId: filters.subCategoryId,
          companyTypeId: filters.companyTypeId,
          search:        debouncedSearch || undefined,
        },
      });

      cache.set(key, res);
      setBoutiques(prev => replace ? res.data : [...prev, ...res.data]);
      setTotal(res.total);
      setPage(pageNum);
    } catch (e: any) {
      if (e?.name === 'AbortError') return; // requête annulée volontairement
      setError(e?.message ?? 'Impossible de charger les boutiques.');
      if (replace) setBoutiques([]);
    } finally {
      setLoading(false);
    }
  }, [filters.categoryId, filters.subCategoryId, filters.companyTypeId, debouncedSearch]);

  /* ── Rechargement complet quand les filtres (hors pagination) changent ── */
  useEffect(() => {
    fetchPage(1, true);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.categoryId, filters.subCategoryId, filters.companyTypeId, debouncedSearch]);

  const loadMore = useCallback(() => {
    if (!loading) fetchPage(page + 1, false);
  }, [fetchPage, loading, page]);

  const reload = useCallback(() => fetchPage(1, true), [fetchPage]);

  return {
    boutiques, loading, error, total,
    hasMore: boutiques.length < total,
    loadMore, reload,
  };
}
