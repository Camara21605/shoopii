/* ============================================================
 * FICHIER : src/shared/context/FavorisContext.tsx
 *
 * RÔLE : État global des produits favoris (❤️) du client.
 *   - Charge une seule fois les IDs likés (/client/favoris/ids)
 *   - Garde l'état du cœur synchronisé partout (carte, modale...)
 *   - Persiste après déconnexion/reconnexion ou rafraîchissement
 *     (rechargé depuis le backend à chaque montage de l'app)
 * ============================================================ */

import React, {
  createContext, useContext, useState,
  useEffect, useCallback,
} from 'react';
import { fetchFavorisIds, toggleFavori } from '../services/favoris.api';
import { getRoleFromToken } from '../services/authUtils';

interface FavorisContextValue {
  loading:  boolean;
  isLiked:  (productId: string) => boolean;
  toggle:   (productId: string) => Promise<boolean>;
  refresh:  () => Promise<void>;
}

const FavorisContext = createContext<FavorisContextValue>({
  loading: false,
  isLiked: () => false,
  toggle:  async () => false,
  refresh: async () => {},
});

export function FavorisProvider({ children }: { children: React.ReactNode }) {
  const [ids,     setIds]     = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const isClient = getRoleFromToken() === 'client';

  const refresh = useCallback(async () => {
    if (!isClient) { setIds(new Set()); return; }
    setLoading(true);
    try {
      const data = await fetchFavorisIds();
      setIds(new Set(data ?? []));
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, [isClient]);

  useEffect(() => { refresh(); }, [refresh]);

  const isLiked = useCallback((productId: string) => ids.has(productId), [ids]);

  const toggle = useCallback(async (productId: string): Promise<boolean> => {
    const res = await toggleFavori(productId);
    setIds(prev => {
      const next = new Set(prev);
      if (res.liked) next.add(productId); else next.delete(productId);
      return next;
    });
    return res.liked;
  }, []);

  return (
    <FavorisContext.Provider value={{ loading, isLiked, toggle, refresh }}>
      {children}
    </FavorisContext.Provider>
  );
}

export const useFavoris = () => useContext(FavorisContext);
