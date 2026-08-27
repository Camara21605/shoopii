/* ================================================================
 * FICHIER : src/modules/home/components/explorer/hooks/useExploreSection.ts
 *
 * Charge une section "intelligente" simple (Tendances, Nouveautés,
 * Proches de vous) — pas de pagination, juste une liste courte
 * rechargée quand `enabled`/`param` changent. Utilisé 3x dans
 * ExplorerSection.tsx avec des endpoints différents.
 * ================================================================ */

import { useEffect, useState } from 'react';
import { apiFetch } from '../../../../../shared/services/apiFetch';
import type { ProductApi } from '../../../cards/CardProduit';

export function useExploreSection(endpoint: string, params: Record<string, string | number | undefined>, enabled = true) {
  const [items,   setItems]   = useState<ProductApi[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error,   setError]   = useState(false);

  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    if (!enabled) { setItems([]); setLoading(false); return; }

    const controller = new AbortController();
    setLoading(true);
    setError(false);

    apiFetch<ProductApi[]>(endpoint, { public: true, params, signal: controller.signal })
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(e => { if (e?.name !== 'AbortError') setError(true); })
      .finally(() => setLoading(false));

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, paramsKey, enabled]);

  return { items, loading, error };
}
