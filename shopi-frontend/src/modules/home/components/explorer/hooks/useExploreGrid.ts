/* ================================================================
 * FICHIER : src/modules/home/components/explorer/hooks/useExploreGrid.ts
 *
 * Charge la grille principale de l'onglet Explorer depuis
 * GET /public/explore, filtrée côté backend (recherche, catégorie,
 * prix, ville) — même structure que useBoutiquesList.ts :
 *   - AbortController : annule la requête précédente si les filtres
 *     changent avant sa fin.
 *   - Debounce 300ms sur la recherche texte uniquement.
 *   - Cache mémoire par combinaison filtres+page.
 *   - Pagination réelle : loadMore() ajoute la page suivante.
 * ================================================================ */

import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { apiFetch } from '../../../../../shared/services/apiFetch';
import type { ProductApi } from '../../../cards/CardProduit';

/* Même origine que BoutiquePage.tsx/RandomBloc.tsx — namespace /public,
 * sans authentification. */
const SOCKET_URL =
  ((import.meta as any).env?.VITE_API_URL as string | undefined)?.replace('/api', '') ??
  'http://localhost:3001';

export interface ExploreFilters {
  search?:   string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  ville?:    string;
}

interface ExploreGridResponse {
  data:  ProductApi[];
  total: number;
  page:  number;
}

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const cache = new Map<string, ExploreGridResponse>();

function cacheKey(filters: ExploreFilters, debouncedSearch: string, page: number): string {
  return JSON.stringify({
    category: filters.category ?? null,
    minPrice: filters.minPrice ?? null,
    maxPrice: filters.maxPrice ?? null,
    ville:    filters.ville    ?? null,
    search:   debouncedSearch  || null,
    page,
  });
}

export function useExploreGrid(filters: ExploreFilters) {
  const [items,   setItems]   = useState<ProductApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);

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
      setItems(prev => replace ? cached.data : [...prev, ...cached.data]);
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
      const res = await apiFetch<ExploreGridResponse>('/public/explore', {
        public: true,
        signal: controller.signal,
        params: {
          page:     pageNum,
          limit:    PAGE_SIZE,
          category: filters.category,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          ville:    filters.ville,
          search:   debouncedSearch || undefined,
        },
      });

      cache.set(key, res);
      setItems(prev => replace ? res.data : [...prev, ...res.data]);
      setTotal(res.total);
      setPage(pageNum);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Impossible de charger les produits.');
      if (replace) setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filters.category, filters.minPrice, filters.maxPrice, filters.ville, debouncedSearch]);

  /* ── Rechargement complet quand les filtres (hors pagination) changent ── */
  useEffect(() => {
    fetchPage(1, true);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.category, filters.minPrice, filters.maxPrice, filters.ville, debouncedSearch]);

  const loadMore = useCallback(() => {
    if (!loading) fetchPage(page + 1, false);
  }, [fetchPage, loading, page]);

  const reload = useCallback(() => fetchPage(1, true), [fetchPage]);

  /* Écoute catalogue:changed (Paramètres > Catalogue de n'importe quelle
   * entreprise) — même diffusion globale que RandomBloc.tsx/ProduitPage.tsx.
   * Le cache mémoire ci-dessus (persistant tant que l'onglet reste ouvert)
   * doit être vidé, sinon reload() re-servirait les données périmées
   * qu'il vient de mettre en cache. */
  useEffect(() => {
    const socket = io(`${SOCKET_URL}/public`, { transports: ['websocket', 'polling'] });
    socket.on('catalogue:changed', () => { cache.clear(); fetchPage(1, true); });
    return () => { socket.disconnect(); };
  }, [fetchPage]);

  return {
    items, loading, error, total,
    hasMore: items.length < total,
    loadMore, reload,
  };
}
