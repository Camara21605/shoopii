/* ============================================================
 * FICHIER : src/shared/context/WishlistContext.tsx
 *
 * RÔLE : État global de la liste de souhaits du client — mirroir de
 *        FavorisContext.tsx, mais pour une liste personnelle privée
 *        distincte des favoris (❤️) : voir wishlist.api.ts.
 * ============================================================ */

import React, {
  createContext, useContext, useState,
  useEffect, useCallback,
} from 'react';
import { fetchWishlistIds, toggleWishlist } from '../services/wishlist.api';
import { getRoleFromToken } from '../services/authUtils';

interface WishlistContextValue {
  loading:  boolean;
  isSaved:  (productId: string) => boolean;
  toggle:   (productId: string) => Promise<boolean>;
  refresh:  () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue>({
  loading: false,
  isSaved: () => false,
  toggle:  async () => false,
  refresh: async () => {},
});

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [ids,     setIds]     = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const isClient = getRoleFromToken() === 'client';

  const refresh = useCallback(async () => {
    if (!isClient) { setIds(new Set()); return; }
    setLoading(true);
    try {
      const data = await fetchWishlistIds();
      setIds(new Set(data ?? []));
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, [isClient]);

  useEffect(() => { refresh(); }, [refresh]);

  const isSaved = useCallback((productId: string) => ids.has(productId), [ids]);

  const toggle = useCallback(async (productId: string): Promise<boolean> => {
    /* Mise à jour optimiste — voir FavorisContext.toggle() pour le
     * raisonnement complet (même pattern). */
    const wasSaved = ids.has(productId);
    const nowSaved = !wasSaved;

    setIds(prev => {
      const next = new Set(prev);
      if (nowSaved) next.add(productId); else next.delete(productId);
      return next;
    });

    try {
      const res = await toggleWishlist(productId);
      if (res.added !== nowSaved) {
        setIds(prev => {
          const next = new Set(prev);
          if (res.added) next.add(productId); else next.delete(productId);
          return next;
        });
      }
      return res.added;
    } catch (err) {
      setIds(prev => {
        const next = new Set(prev);
        if (wasSaved) next.add(productId); else next.delete(productId);
        return next;
      });
      throw err;
    }
  }, [ids]);

  return (
    <WishlistContext.Provider value={{ loading, isSaved, toggle, refresh }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);
