/* ================================================================
 * FICHIER : typeEntreprise/hooks/useProduitsByType.ts
 *
 * Charge, pour un type d'entreprise donné (typeId) :
 *   - ses infos (GET /company-types/:id)
 *   - ses catégories (GET /company-types/:id/categories)
 *   - ses produits, paginés (GET /public/produits?companyTypeId=&categoryId=)
 *
 * Même pattern que useBoutiquesList.ts (cache mémoire par combinaison de
 * filtres+page, AbortController, pagination réelle "Charger plus").
 * ================================================================ */

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../../../../../shared/services/apiFetch';
import type { ProductApi } from '../../../cards/CardProduit';

export interface CompanyTypeInfo {
  id:            string;
  slug:          string;
  nom:           string;
  description:   string | null;
  icone:         string | null;
  couleur:       string | null;
  nbCategories:  number;
  nbEntreprises: number;
}

export interface TypeCategory {
  id:    string;
  nom:   string;
  icone: string | null;
}

interface ProduitsResponse {
  data:  ProductApi[];
  total: number;
  page:  number;
}

const PAGE_SIZE = 20;

/* Cache mémoire au niveau module — survit aux remounts tant que la page reste ouverte */
const cache = new Map<string, ProduitsResponse>();

function cacheKey(typeId: string, categoryId: string | undefined, page: number): string {
  return JSON.stringify({ typeId, categoryId: categoryId ?? null, page });
}

export function useProduitsByType(typeId: string | undefined, categoryId?: string) {
  const [typeInfo,   setTypeInfo]   = useState<CompanyTypeInfo | null>(null);
  const [typeError,  setTypeError]  = useState<string | null>(null);
  const [categories, setCategories] = useState<TypeCategory[]>([]);

  const [produits, setProduits] = useState<ProductApi[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);

  const abortRef = useRef<AbortController | null>(null);

  /* ── Infos du type + ses catégories — une fois par typeId ── */
  useEffect(() => {
    if (!typeId) return;
    setTypeInfo(null);
    setTypeError(null);
    setCategories([]);

    Promise.all([
      apiFetch<CompanyTypeInfo>(`/company-types/${typeId}`, { public: true }),
      apiFetch<TypeCategory[]>(`/company-types/${typeId}/categories`, { public: true }).catch(() => []),
    ])
      .then(([info, cats]) => {
        setTypeInfo(info);
        setCategories(Array.isArray(cats) ? cats : []);
      })
      .catch(e => setTypeError(e?.message ?? "Impossible de charger ce type d'entreprise."));
  }, [typeId]);

  /* ── Produits paginés, filtrés par type (+ catégorie optionnelle) ── */
  const fetchPage = useCallback(async (pageNum: number, replace: boolean) => {
    if (!typeId) return;
    const key = cacheKey(typeId, categoryId, pageNum);
    const cached = cache.get(key);

    if (cached) {
      setProduits(prev => replace ? cached.data : [...prev, ...cached.data]);
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
      const res = await apiFetch<ProduitsResponse>('/public/produits', {
        public: true,
        signal: controller.signal,
        params: {
          page: pageNum, limit: PAGE_SIZE,
          companyTypeId: typeId, categoryId,
        },
      });

      cache.set(key, res);
      setProduits(prev => replace ? res.data : [...prev, ...res.data]);
      setTotal(res.total);
      setPage(pageNum);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e?.message ?? 'Impossible de charger les produits.');
      if (replace) setProduits([]);
    } finally {
      setLoading(false);
    }
  }, [typeId, categoryId]);

  useEffect(() => {
    fetchPage(1, true);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId, categoryId]);

  const loadMore = useCallback(() => {
    if (!loading) fetchPage(page + 1, false);
  }, [fetchPage, loading, page]);

  const reload = useCallback(() => fetchPage(1, true), [fetchPage]);

  return {
    typeInfo, typeError, categories,
    produits, loading, error, total,
    hasMore: produits.length < total,
    loadMore, reload,
  };
}
