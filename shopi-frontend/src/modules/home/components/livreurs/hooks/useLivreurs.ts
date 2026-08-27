/* ================================================================
 * FICHIER : src/modules/home/components/livreurs/hooks/useLivreurs.ts
 *
 * RÔLE : Centralise toute la logique de la page Livreurs :
 *          - Chargement API GET /suivis/livreurs
 *          - Filtrage / tri / recherche
 *          - Toggle follow/unfollow (optimiste)
 *          - Gestion de la vue (grille / liste)
 *
 * PATTERN : Sépare la logique (hook) de l'affichage (composants)
 * ================================================================ */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { apiFetch }                                  from '../../../../../shared/services/apiFetch';
import { MOCK_LIVREURS }                             from '../data/livreursMockData';
import type { LivreurItem }                          from '../data/livreursMockData';

/** Délai de debounce avant d'interroger le backend après un changement
 *  de filtre (recherche, zone, note...) — évite un appel API par frappe. */
const SEARCH_DEBOUNCE_MS = 300;

/* ── Types internes ── */
export type ViewMode   = 'grid' | 'list';
export type FilterType = 'all' | 'available' | 'followed' | 'moto' | 'voiture';
export type SortOption = 'note' | 'livraisons' | 'disponible' | 'proches';

export interface FilterState {
  activeFilter:        FilterType;
  searchQuery:         string;
  sortBy:              SortOption;
  selectedZone:        string;
  selectedVehicles:    string[];
  minRating:           number | null;
  availabilityFilter:  'all' | 'available' | 'busy';
}

const INITIAL_FILTERS: FilterState = {
  activeFilter:       'all',
  searchQuery:        '',
  sortBy:             'note',
  selectedZone:       'all',
  selectedVehicles:   [],
  minRating:          null,
  availabilityFilter: 'all',
};

/* ── Valeur retournée par le hook ── */
export interface UseLivreursReturn {
  livreurs:          LivreurItem[];
  filtered:          LivreurItem[];
  loading:           boolean;
  error:             string | null;
  filters:           FilterState;
  viewMode:          ViewMode;
  onSearch:          (v: string) => void;
  onFilter:          (f: FilterType) => void;
  onSort:            (s: SortOption) => void;
  onViewChange:      (v: ViewMode) => void;
  onZone:            (z: string) => void;
  onVehicleToggle:   (v: string) => void;
  onRating:          (r: number | null) => void;
  onAvailability:    (v: 'all' | 'available' | 'busy') => void;
  onReset:           () => void;
  /** Reflète l'action du menu ⋮ de FollowButton (suivi/masqué/supprimé)
   *  dans la liste partagée — le composant fait lui-même l'appel API,
   *  ce hook n'a plus qu'à synchroniser son état local. */
  onChange:          (id: string, next: { isSuivi: boolean; hidden?: boolean; removed?: boolean }) => void;
}

/* ================================================================
 * HOOK PRINCIPAL
 * ================================================================ */
export function useLivreurs(initialSearch?: string): UseLivreursReturn {

  const [livreurs, setLivreurs] = useState<LivreurItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  /* initialSearch vient de la recherche générale du Header (navigate avec
   * state.search) — voir LivreursPage.tsx et Header.tsx handleSearchSubmit. */
  const [filters,  setFilters]  = useState<FilterState>(() => ({
    ...INITIAL_FILTERS,
    searchQuery: initialSearch ?? '',
  }));
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

 /* ── Chargement depuis l'API, recherche/filtres réellement exécutés
  * côté backend (GET /suivis/livreurs supporte search/zone/vehicule/
  * sortBy/disponibleOnly/minRating/page/limit — cf. QueryLivreursDto).
  * Avant : un seul fetch sans paramètres puis filtrage 100% client sur
  * cette page fixe de 20 résultats → une recherche pouvait passer à
  * côté de livreurs situés au-delà de la 1ère page. Debounce 300ms
  * pour ne pas spammer l'API à chaque frappe dans la recherche. ── */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Filtres non couverts par QueryLivreursDto (isSuivi, "occupé
   * uniquement", sélection multi-véhicules) restent appliqués côté
   * client, sur la page déjà filtrée/triée par le backend. */
  const singleVehicule = useMemo<string | null>(() => {
    if (filters.activeFilter === 'moto')    return 'moto';
    if (filters.activeFilter === 'voiture') return 'voiture';
    if (filters.selectedVehicles.length === 1) return filters.selectedVehicles[0];
    return null;
  }, [filters.activeFilter, filters.selectedVehicles]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.searchQuery.trim())              params.set('search', filters.searchQuery.trim());
      if (filters.selectedZone !== 'all')           params.set('zone', filters.selectedZone);
      if (singleVehicule)                           params.set('vehicule', singleVehicule);
      if (filters.activeFilter === 'available' || filters.availabilityFilter === 'available') {
        params.set('disponibleOnly', 'true');
      }
      if (filters.minRating !== null)               params.set('minRating', String(filters.minRating));
      if (filters.sortBy !== 'proches')             params.set('sortBy', filters.sortBy);
      params.set('limit', '50');

      /* L'API renvoie un objet paginé { data, total, page, limit } */
      apiFetch<{ data: LivreurItem[] }>(`/suivis/livreurs?${params.toString()}`)
        .then(res => setLivreurs(Array.isArray(res?.data) ? res.data : []))
        .catch(() => {
          /* Fallback mock si l'API n'est pas prête */
          setLivreurs(MOCK_LIVREURS);
        })
        .finally(() => setLoading(false));
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    filters.searchQuery, filters.selectedZone, filters.minRating,
    filters.sortBy, filters.activeFilter, filters.availabilityFilter,
    singleVehicule,
  ]);

  /* ── Résidu client : uniquement ce que le backend ne filtre pas ── */
  const filtered = useMemo<LivreurItem[]>(() => {
    let r = livreurs;

    if (filters.activeFilter === 'followed') r = r.filter(l => l.isSuivi);
    if (filters.availabilityFilter === 'busy') r = r.filter(l => !l.disponible);

    /* Sélection multi-véhicules (2+) : le backend ne prend qu'une seule
     * valeur, donc ce cas précis reste filtré côté client. */
    if (filters.selectedVehicles.length > 1) {
      r = r.filter(l => filters.selectedVehicles.includes(l.vehiculeType));
    }

    return r;
  }, [livreurs, filters.activeFilter, filters.availabilityFilter, filters.selectedVehicles]);



/* ── Synchronise la liste locale après une action de FollowButton ──
 * FollowButton fait lui-même l'appel API (toggle/masquer) ; ce hook
 * n'a qu'à répercuter le résultat confirmé sur sa propre liste, pour
 * que le filtre rapide "Abonnés" et la sidebar "Mes livreurs suivis"
 * restent à jour sans refetch. */
const onChange = useCallback((id: string, next: { isSuivi: boolean; hidden?: boolean; removed?: boolean }) => {
  if (next.removed) {
    setLivreurs(prev => prev.filter(l => l.id !== id));
    return;
  }
  setLivreurs(prev => prev.map(l => l.id === id ? { ...l, isSuivi: next.isSuivi } : l));
}, []);

  /* ── Handlers filtres ── */
  const onSearch         = useCallback((v: string)   => setFilters(f => ({ ...f, searchQuery:        v    })), []);
  const onFilter         = useCallback((f: FilterType)=> setFilters(p => ({ ...p, activeFilter:       f    })), []);
  const onSort           = useCallback((s: SortOption)=> setFilters(f => ({ ...f, sortBy:             s    })), []);
  const onViewChange     = useCallback((v: ViewMode)  => setViewMode(v),                                        []);
  const onZone           = useCallback((z: string)    => setFilters(f => ({ ...f, selectedZone:       z    })), []);
  const onRating         = useCallback((r: number|null)=>setFilters(f => ({ ...f, minRating:          r    })), []);
  const onAvailability   = useCallback((v: 'all'|'available'|'busy') =>
                                        setFilters(f => ({ ...f, availabilityFilter: v })),                      []);
  const onVehicleToggle  = useCallback((v: string) =>
    setFilters(f => ({
      ...f,
      selectedVehicles: f.selectedVehicles.includes(v)
        ? f.selectedVehicles.filter(x => x !== v)
        : [...f.selectedVehicles, v],
    })), []);
  const onReset = useCallback(() => setFilters(INITIAL_FILTERS), []);

  return {
    livreurs, filtered, loading, error,
    filters, viewMode,
    onSearch, onFilter, onSort, onViewChange,
    onZone, onVehicleToggle, onRating, onAvailability,
    onReset, onChange,
  };
}