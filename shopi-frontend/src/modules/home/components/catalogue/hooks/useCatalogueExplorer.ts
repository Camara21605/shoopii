/* ================================================================
 * FICHIER : src/modules/home/components/catalogue/hooks/useCatalogueExplorer.ts
 *
 * Données de la page "/catalogue" (navigation type → catégories →
 * entreprises). Tout vient des routes publiques existantes :
 *   GET /company-types                      (ordre personnalisé côté backend)
 *   GET /company-types/:id/categories
 *   GET /public/boutiques?companyTypeId=&businessModel=
 * Caches mémoire au niveau module : un aller-retour entre deux types
 * ne redéclenche pas de requête réseau.
 * ================================================================ */

import { useEffect, useState } from 'react';
import { apiFetch } from '../../../../../shared/services/apiFetch';
import type { BoutiqueCardData } from '../../../data/types';

export type Nature = 'products' | 'services' | 'neutral';
export type Mode   = 'products' | 'services';

export interface CatalogueType {
  id:            string;
  nom:           string;
  icone:         string | null;
  imageUrl:      string | null;
  couleur:       string | null;
  actif:         boolean;
  nature:        Nature;
  nbCategories:  number;
  nbEntreprises: number;
}

export interface CatalogueCategory {
  id:      string;
  nom:     string;
  icone:   string | null;
  imageUrl: string | null;
  couleur: string | null;
  actif:   boolean;
}

/** Nombre maximum d'entreprises montrées dans le panneau de droite — le
 *  reste est accessible via "Voir tout" (/boutiques, paginé). */
const COMPANIES_LIMIT = 30;

const categoriesCache = new Map<string, CatalogueCategory[]>();
const companiesCache  = new Map<string, { list: BoutiqueCardData[]; total: number }>();

export function useCatalogueTypes() {
  const [types,   setTypes]   = useState<CatalogueType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [nonce,   setNonce]   = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    apiFetch<CatalogueType[]>('/company-types', { public: true })
      .then(data => { if (alive) setTypes((data ?? []).filter(t => t.actif)); })
      .catch(e => { if (alive) setError(e?.message ?? 'error'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [nonce]);

  return { types, loading, error, reload: () => setNonce(n => n + 1) };
}

export function useTypeCategories(typeId: string | undefined) {
  const [categories, setCategories] = useState<CatalogueCategory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!typeId) { setCategories([]); setLoading(false); return; }
    const cached = categoriesCache.get(typeId);
    if (cached) { setCategories(cached); setLoading(false); return; }

    let alive = true;
    setCategories([]);
    setLoading(true);
    apiFetch<CatalogueCategory[]>(`/company-types/${typeId}/categories`, { public: true })
      .then(data => {
        const list = (data ?? []).filter(c => c.actif);
        categoriesCache.set(typeId, list);
        if (alive) setCategories(list);
      })
      .catch(() => { if (alive) setCategories([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [typeId]);

  return { categories, loading };
}

export function useTypeCompanies(typeId: string | undefined, mode: Mode | undefined) {
  const [companies, setCompanies] = useState<BoutiqueCardData[]>([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    const key = `${typeId ?? ''}|${mode ?? ''}`;
    const cached = companiesCache.get(key);
    if (cached) { setCompanies(cached.list); setTotal(cached.total); setLoading(false); return; }

    const controller = new AbortController();
    setCompanies([]);
    setTotal(0);
    setLoading(true);
    apiFetch<{ data: BoutiqueCardData[]; total: number }>('/public/boutiques', {
      public: true,
      signal: controller.signal,
      params: { page: 1, limit: COMPANIES_LIMIT, companyTypeId: typeId, businessModel: mode },
    })
      .then(res => {
        const list = res?.data ?? [];
        const entry = { list, total: res?.total ?? list.length };
        companiesCache.set(key, entry);
        setCompanies(entry.list);
        setTotal(entry.total);
      })
      .catch(e => { if (e?.name !== 'AbortError') setCompanies([]); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [typeId, mode]);

  return { companies, total, loading };
}
