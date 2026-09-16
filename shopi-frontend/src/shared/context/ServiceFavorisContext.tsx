/* ============================================================
 * FICHIER : src/shared/context/ServiceFavorisContext.tsx
 *
 * RÔLE : État global des prestations favorites (❤️) du client.
 *   Miroir exact de FavorisContext.tsx (produits) pour l'entité Service.
 * ============================================================ */

import React, {
  createContext, useContext, useState,
  useEffect, useCallback,
} from 'react';
import { fetchFavorisServicesIds, toggleFavoriService } from '../services/service-favoris.api';
import { getRoleFromToken } from '../services/authUtils';

interface ServiceFavorisContextValue {
  loading:  boolean;
  isLiked:  (serviceId: string) => boolean;
  toggle:   (serviceId: string) => Promise<boolean>;
  refresh:  () => Promise<void>;
}

const ServiceFavorisContext = createContext<ServiceFavorisContextValue>({
  loading: false,
  isLiked: () => false,
  toggle:  async () => false,
  refresh: async () => {},
});

export function ServiceFavorisProvider({ children }: { children: React.ReactNode }) {
  const [ids,     setIds]     = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const isClient = getRoleFromToken() === 'client';

  const refresh = useCallback(async () => {
    if (!isClient) { setIds(new Set()); return; }
    setLoading(true);
    try {
      const data = await fetchFavorisServicesIds();
      setIds(new Set(data ?? []));
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, [isClient]);

  useEffect(() => { refresh(); }, [refresh]);

  const isLiked = useCallback((serviceId: string) => ids.has(serviceId), [ids]);

  const toggle = useCallback(async (serviceId: string): Promise<boolean> => {
    const wasLiked = ids.has(serviceId);
    const nowLiked = !wasLiked;

    setIds(prev => {
      const next = new Set(prev);
      if (nowLiked) next.add(serviceId); else next.delete(serviceId);
      return next;
    });

    try {
      const res = await toggleFavoriService(serviceId);
      if (res.liked !== nowLiked) {
        setIds(prev => {
          const next = new Set(prev);
          if (res.liked) next.add(serviceId); else next.delete(serviceId);
          return next;
        });
      }
      return res.liked;
    } catch (err) {
      setIds(prev => {
        const next = new Set(prev);
        if (wasLiked) next.add(serviceId); else next.delete(serviceId);
        return next;
      });
      throw err;
    }
  }, [ids]);

  return (
    <ServiceFavorisContext.Provider value={{ loading, isLiked, toggle, refresh }}>
      {children}
    </ServiceFavorisContext.Provider>
  );
}

export const useServiceFavoris = () => useContext(ServiceFavorisContext);
