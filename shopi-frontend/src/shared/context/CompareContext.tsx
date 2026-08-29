/* ============================================================
 * FICHIER : src/shared/context/CompareContext.tsx
 *
 * RÔLE : État global de la liste de comparaison produits (⚖️).
 *   - Purement local (localStorage) — pas de backend : contrairement
 *     aux favoris/panier, comparer des produits est un usage ponctuel
 *     de la session en cours, pas une donnée à synchroniser entre
 *     appareils ou à conserver après déconnexion.
 *   - Plafonné à MAX_COMPARE produits — comparer plus de 4 articles
 *     à la fois rend un tableau de comparaison illisible.
 * ============================================================ */

import React, {
  createContext, useContext, useState, useCallback,
} from 'react';

const STORAGE_KEY = 'shopi_compare_ids';
export const MAX_COMPARE = 4;

interface CompareContextValue {
  ids:         string[];
  count:       number;
  isComparing: (productId: string) => boolean;
  /** Ajoute/retire le produit. `full: true` si déjà à MAX_COMPARE et qu'on essayait d'ajouter. */
  toggle:      (productId: string) => { added: boolean; full: boolean };
  remove:      (productId: string) => void;
  clear:       () => void;
}

const CompareContext = createContext<CompareContextValue>({
  ids: [], count: 0,
  isComparing: () => false,
  toggle:      () => ({ added: false, full: false }),
  remove:      () => {},
  clear:       () => {},
});

function loadInitial(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function persist(ids: string[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch { /* stockage indisponible — état reste en mémoire pour la session */ }
}

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>(loadInitial);

  const isComparing = useCallback((productId: string) => ids.includes(productId), [ids]);

  const toggle = useCallback((productId: string): { added: boolean; full: boolean } => {
    let result = { added: false, full: false };
    setIds(prev => {
      if (prev.includes(productId)) {
        result = { added: false, full: false };
        const next = prev.filter(id => id !== productId);
        persist(next);
        return next;
      }
      if (prev.length >= MAX_COMPARE) {
        result = { added: false, full: true };
        return prev;
      }
      result = { added: true, full: false };
      const next = [...prev, productId];
      persist(next);
      return next;
    });
    return result;
  }, []);

  const remove = useCallback((productId: string) => {
    setIds(prev => {
      const next = prev.filter(id => id !== productId);
      persist(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setIds([]);
    persist([]);
  }, []);

  return (
    <CompareContext.Provider value={{ ids, count: ids.length, isComparing, toggle, remove, clear }}>
      {children}
    </CompareContext.Provider>
  );
}

export const useCompare = () => useContext(CompareContext);
