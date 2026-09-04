/* ================================================================
 * FICHIER : src/modules/home/components/explorer/hooks/useExploreSection.ts
 *
 * Charge une section "intelligente" simple (Tendances, Nouveautés,
 * Proches de vous) — pas de pagination, juste une liste courte
 * rechargée quand `enabled`/`param` changent. Utilisé 3x dans
 * ExplorerSection.tsx avec des endpoints différents.
 * ================================================================ */

import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { apiFetch } from '../../../../../shared/services/apiFetch';
import type { ProductApi } from '../../../cards/CardProduit';

/* Même origine que useExploreGrid.ts — namespace /public, sans authentification. */
const SOCKET_URL =
  ((import.meta as any).env?.VITE_API_URL as string | undefined)?.replace('/api', '') ??
  'http://localhost:3001';

export function useExploreSection(endpoint: string, params: Record<string, string | number | undefined>, enabled = true) {
  const [items,   setItems]   = useState<ProductApi[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error,   setError]   = useState(false);

  const paramsKey = JSON.stringify(params);

  const load = useCallback((signal?: AbortSignal, silent = false) => {
    if (!enabled) { setItems([]); setLoading(false); return; }
    if (!silent) { setLoading(true); setError(false); }

    apiFetch<ProductApi[]>(endpoint, { public: true, params, signal })
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(e => { if (!silent && e?.name !== 'AbortError') setError(true); })
      .finally(() => { if (!silent) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, paramsKey, enabled]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  /* Écoute catalogue:changed (Paramètres > Catalogue de n'importe quelle
   * entreprise) — même diffusion globale que useExploreGrid.ts. */
  useEffect(() => {
    const socket = io(`${SOCKET_URL}/public`, { transports: ['websocket', 'polling'] });
    socket.on('catalogue:changed', () => load(undefined, true));
    return () => { socket.disconnect(); };
  }, [load]);

  return { items, loading, error };
}
