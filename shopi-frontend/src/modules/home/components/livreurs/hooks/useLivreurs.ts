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

import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiFetch }                                  from '../../../../../shared/services/apiFetch';
import { MOCK_LIVREURS }                             from '../data/livreursMockData';
import type { LivreurItem }                          from '../data/livreursMockData';
// En haut du fichier, ajouter l'import du helper partagé :
import { toggleFollowLivreur } from '../../../../../shared/services/follow';

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
  onFollow:          (id: string, newState: boolean) => void;
}

/* ================================================================
 * HOOK PRINCIPAL
 * ================================================================ */
export function useLivreurs(
  onToast?: (msg: string, type?: 's' | 'i' | 'w' | 'e') => void,
): UseLivreursReturn {

  const [livreurs, setLivreurs] = useState<LivreurItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [filters,  setFilters]  = useState<FilterState>(INITIAL_FILTERS);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

 /* ── Chargement initial depuis l'API ── */
  useEffect(() => {
    setLoading(true);
    /* L'API renvoie un objet paginé { data, total, page, limit } */
    apiFetch<{ data: LivreurItem[] }>('/suivis/livreurs')
      .then(res => setLivreurs(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {
        /* Fallback mock si l'API n'est pas prête */
        setLivreurs(MOCK_LIVREURS);
        setError(null);
      })
      .finally(() => setLoading(false));
  }, []);

  /* ── Filtrage + tri mémoïsé ── */
  const filtered = useMemo<LivreurItem[]>(() => {
    let r = [...livreurs];

    /* 1. Filtre rapide */
    if (filters.activeFilter === 'available') r = r.filter(l => l.disponible);
    if (filters.activeFilter === 'followed')  r = r.filter(l => l.isSuivi);
    if (filters.activeFilter === 'moto')      r = r.filter(l => l.vehiculeType === 'moto');
    if (filters.activeFilter === 'voiture')   r = r.filter(l => l.vehiculeType === 'voiture');

    /* 2. Recherche texte */
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      r = r.filter(l =>
        l.fullName.toLowerCase().includes(q) ||
        l.zone?.toLowerCase().includes(q)    ||
        l.vehicule?.toLowerCase().includes(q)
      );
    }

    /* 3. Zone sidebar */
    if (filters.selectedZone !== 'all') {
      r = r.filter(l => l.zone?.toLowerCase().includes(filters.selectedZone));
    }

    /* 4. Véhicule sidebar */
    if (filters.selectedVehicles.length > 0) {
      r = r.filter(l =>
        filters.selectedVehicles.includes(l.vehiculeType)
      );
    }

    /* 5. Note minimale */
    if (filters.minRating !== null) {
      r = r.filter(l => l.averageRating >= (filters.minRating ?? 0));
    }

    /* 6. Disponibilité sidebar */
    if (filters.availabilityFilter === 'available') r = r.filter(l =>  l.disponible);
    if (filters.availabilityFilter === 'busy')      r = r.filter(l => !l.disponible);

    /* 7. Tri */
    if (filters.sortBy === 'note')       r.sort((a, b) => b.averageRating   - a.averageRating);
    if (filters.sortBy === 'livraisons') r.sort((a, b) => b.totalLivraisons - a.totalLivraisons);
    if (filters.sortBy === 'disponible') r.sort((a, b) => (b.disponible ? 1 : 0) - (a.disponible ? 1 : 0));

    return r;
  }, [livreurs, filters]);



// ... puis remplacer onFollow par :

/* ── Toggle follow (optimiste, centralisé) ── */
const onFollow = useCallback(async (id: string, next: boolean) => {
  /* 1. Optimistic update de la liste globale */
  setLivreurs(prev => prev.map(l =>
    l.id === id ? { ...l, isSuivi: next } : l
  ));

  try {
    /* 2. Un SEUL appel API (helper partagé) */
    const confirmed = await toggleFollowLivreur(id);

    /* 3. Aligne l'état sur la valeur confirmée par le serveur */
    setLivreurs(prev => prev.map(l =>
      l.id === id ? { ...l, isSuivi: confirmed } : l
    ));
  } catch (e) {
    /* 4. Rollback + relance pour que la carte affiche le toast d'erreur */
    setLivreurs(prev => prev.map(l =>
      l.id === id ? { ...l, isSuivi: !next } : l
    ));
    throw e;
  }
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
    onReset, onFollow,
  };
}