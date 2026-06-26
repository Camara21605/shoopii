/* ================================================================
 * src/modules/home/hooks/useLivreursList.ts
 * Charge les livreurs depuis GET /api/suivis/livreurs
 * ================================================================ */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch }                          from '../../../shared/services/apiFetch';
import type { LivreurCardData }              from '../cards/CardLivreur';

export interface LivreurFilters {
  zone?:      string;
  vehicule?:  string;
  disponible?: boolean;
  search?:    string;
}

export function useLivreursList(filters?: LivreurFilters) {
  const [livreurs, setLivreurs] = useState<LivreurCardData[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<LivreurCardData[]>(
        '/suivis/livreurs',
        {
          method: 'GET',
          params: {
            zone:       filters?.zone,
            vehicule:   filters?.vehicule,
            disponible: filters?.disponible,
            search:     filters?.search,
          },
        },
      );
      setLivreurs(data ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur de chargement');
      setLivreurs([]);
    } finally {
      setLoading(false);
    }
  }, [filters?.zone, filters?.vehicule, filters?.disponible, filters?.search]);

  useEffect(() => { load(); }, [load]);

  return { livreurs, loading, error, refresh: load };
}