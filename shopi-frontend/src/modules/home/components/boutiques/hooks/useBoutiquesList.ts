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

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { apiFetch, tokenStorage } from '../../../../../shared/services/apiFetch';
import { getRoleFromToken }       from '../../../../../shared/services/authUtils';
import type { BoutiqueCardData }  from '../../../data/types';

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

  /* ── Statut d'abonnement du client connecté ──────────────────
   * /public/boutiques est un endpoint 100% anonyme (aucun contexte
   * utilisateur) : il ne renvoie jamais isSuivi. Sans ce complément,
   * le bouton "S'abonner" de cette page ne refléterait JAMAIS un
   * abonnement réel, même juste après l'avoir fait — le prochain
   * chargement de la liste (filtre, pagination, retour sur la page)
   * repartirait toujours de isSuivi=false. On récupère donc les ids
   * suivis séparément (même endpoint que RandomBloc.EntreprisesBloc)
   * et on les fusionne dans les résultats affichés. */
  const isClient = useMemo(
    () => !!tokenStorage.get() && getRoleFromToken() === 'client',
    [],
  );
  const [suiviIds,  setSuiviIds]  = useState<Set<string>>(new Set());
  /* Boutiques suivies mais masquées ("Masquer" dans le menu ⋮) : à
   * exclure entièrement de cette liste de découverte, contrairement à
   * suiviIds qui ne fait que piloter le libellé du bouton. */
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isClient) { setSuiviIds(new Set()); setHiddenIds(new Set()); return; }
    apiFetch<{ boutiques: { id: string; hidden: boolean }[] }>('/suivis/mes-abonnements')
      .then(res => {
        const list = res?.boutiques ?? [];
        setSuiviIds(new Set(list.map(b => b.id)));
        setHiddenIds(new Set(list.filter(b => b.hidden).map(b => b.id)));
      })
      .catch(() => { setSuiviIds(new Set()); setHiddenIds(new Set()); });
  }, [isClient]);

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

  /* Retire une boutique de la liste affichée sans refetch — utilisé par
   * l'action "Supprimer" du menu ⋮ (FollowButton). */
  const removeLocal = useCallback((id: string) => {
    setBoutiques(prev => prev.filter(b => b.id !== id));
    setTotal(t => Math.max(0, t - 1));
  }, []);

  /* Fusion isSuivi + exclusion des boutiques masquées — voir les
   * commentaires sur suiviIds/hiddenIds ci-dessus. */
  const boutiquesEnrichies = useMemo(
    () => boutiques
      .filter(b => !hiddenIds.has(b.id))
      .map(b => ({ ...b, isSuivi: suiviIds.has(b.id) })),
    [boutiques, suiviIds, hiddenIds],
  );

  return {
    boutiques: boutiquesEnrichies, loading, error, total,
    hasMore: boutiques.length < total,
    loadMore, reload, removeLocal,
  };
}
