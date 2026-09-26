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
  createContext, useContext, useState, useCallback, useRef,
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
  /* Copie synchrone de `ids` : toggle() doit RETOURNER le résultat
   * (ajouté / retiré / plein) au moment du clic. L'ancien code le
   * calculait à l'intérieur de l'updater de setIds — or React peut
   * exécuter cet updater plus tard (au rendu suivant), toggle()
   * renvoyait alors {added:false} même quand le produit était ajouté
   * (toast "Retiré de la comparaison" affiché à tort). */
  const idsRef = useRef(ids);
  const commit = useCallback((next: string[]) => {
    idsRef.current = next;
    persist(next);
    setIds(next);
  }, []);

  const isComparing = useCallback((productId: string) => ids.includes(productId), [ids]);

  const toggle = useCallback((productId: string): { added: boolean; full: boolean } => {
    const prev = idsRef.current;
    if (prev.includes(productId)) {
      commit(prev.filter(id => id !== productId));
      return { added: false, full: false };
    }
    if (prev.length >= MAX_COMPARE) return { added: false, full: true };
    commit([...prev, productId]);
    return { added: true, full: false };
  }, [commit]);

  const remove = useCallback((productId: string) => {
    commit(idsRef.current.filter(id => id !== productId));
  }, [commit]);

  const clear = useCallback(() => {
    commit([]);
  }, [commit]);

  return (
    <CompareContext.Provider value={{ ids, count: ids.length, isComparing, toggle, remove, clear }}>
      {children}
    </CompareContext.Provider>
  );
}

export const useCompare = () => useContext(CompareContext);
