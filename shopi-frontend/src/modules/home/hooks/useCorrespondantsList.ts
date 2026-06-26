/* ================================================================
 * src/modules/home/hooks/useCorrespondantsList.ts
 *
 * Charge les correspondants depuis le backend avec leur isSuivi.
 * Endpoint : GET /api/suivis/correspondants
 * ================================================================ */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch }                          from '../../../shared/services/apiFetch';
import type { CorrespondantCardData }        from '../cards/CardCorrespondant';

export interface CorrespondantFilters {
  commune?: string;
  ville?:   string;
  type?:    'regional' | 'zonal' | 'national';
  online?:  boolean;
  search?:  string;
}

export function useCorrespondantsList(filters?: CorrespondantFilters) {
  const [correspondants, setCorrespondants] = useState<CorrespondantCardData[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<CorrespondantCardData[]>(
        '/suivis/correspondants',
        {
          method: 'GET',
          params: {
            commune: filters?.commune,
            ville:   filters?.ville,
            type:    filters?.type,
            online:  filters?.online,
            search:  filters?.search,
          },
        },
      );
      setCorrespondants(data ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur de chargement');
      setCorrespondants([]);
    } finally {
      setLoading(false);
    }
  }, [
    filters?.commune,
    filters?.ville,
    filters?.type,
    filters?.online,
    filters?.search,
  ]);

  useEffect(() => { load(); }, [load]);

  return { correspondants, loading, error, refresh: load };
}