/* ================================================================
 * FICHIER : typeEntreprise/hooks/useServicesByType.ts
 *
 * Miroir de useProduitsByType.ts pour un type d'entreprise dont
 * nature==='services' (voir TypeEntreprisePage.tsx) — dupliqué plutôt que
 * généralisé, cohérent avec le choix d'entité Service dédiée du plan
 * Produits/Services : GET /public/services?companyTypeId=&categoryId=
 * remplace GET /public/produits.
 * ================================================================ */

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../../../../../shared/services/apiFetch';
import type { ServiceApi } from '../../../cards/CardService';
import type { CompanyTypeInfo, TypeCategory } from './useProduitsByType';

interface ServicesResponse {
  data:  ServiceApi[];
  total: number;
  page:  number;
}

const PAGE_SIZE = 20;

/* Cache mémoire au niveau module — survit aux remounts tant que la page reste ouverte */
const cache = new Map<string, ServicesResponse>();

function cacheKey(typeId: string, categoryId: string | undefined, page: number): string {
  return JSON.stringify({ typeId, categoryId: categoryId ?? null, page });
}

export function useServicesByType(typeId: string | undefined, categoryId?: string) {
  const [typeInfo,   setTypeInfo]   = useState<CompanyTypeInfo | null>(null);
  const [typeError,  setTypeError]  = useState<string | null>(null);
  const [categories, setCategories] = useState<TypeCategory[]>([]);

  const [services, setServices] = useState<ServiceApi[]>([]);
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

  /* ── Services paginés, filtrés par type (+ catégorie optionnelle) ── */
  const fetchPage = useCallback(async (pageNum: number, replace: boolean) => {
    if (!typeId) return;
    const key = cacheKey(typeId, categoryId, pageNum);
    const cached = cache.get(key);

    if (cached) {
      setServices(prev => replace ? cached.data : [...prev, ...cached.data]);
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
      const res = await apiFetch<ServicesResponse>('/public/services', {
        public: true,
        signal: controller.signal,
        params: {
          page: pageNum, limit: PAGE_SIZE,
          companyTypeId: typeId, categoryId,
        },
      });

      cache.set(key, res);
      setServices(prev => replace ? res.data : [...prev, ...res.data]);
      setTotal(res.total);
      setPage(pageNum);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e?.message ?? 'Impossible de charger les services.');
      if (replace) setServices([]);
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
    services, loading, error, total,
    hasMore: services.length < total,
    loadMore, reload,
  };
}
