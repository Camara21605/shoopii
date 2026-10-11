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
 *   - UNE SEULE CATÉGORIE par comparaison : chaque entrée garde la
 *     catégorie / sous-catégorie du produit. Ajouter un produit d'une
 *     autre catégorie est refusé (`mismatch`) — l'appelant propose
 *     alors de démarrer une nouvelle comparaison (replaceWith()).
 *     Comparer un jus avec un détergent n'a aucun sens.
 * ============================================================ */

import React, {
  createContext, useContext, useState, useCallback, useRef, useMemo,
} from 'react';

const STORAGE_KEY = 'shopi_compare_items';
const LEGACY_KEY  = 'shopi_compare_ids';      // ancien format : string[]
export const MAX_COMPARE = 4;

/** Catégorie d'un produit — connue dès l'ajout depuis la fiche produit,
 *  complétée par la page /comparer pour les anciennes entrées. */
export interface CompareMeta {
  categoryId?:     string | null;
  categoryNom?:    string | null;
  subCategoryId?:  string | null;
  subCategoryNom?: string | null;
}
export interface CompareItem extends CompareMeta { id: string }

export interface ToggleResult {
  added: boolean;
  full:  boolean;
  /** Nom de la catégorie en cours si le produit est d'une autre catégorie */
  mismatch?: string | null;
}

interface CompareContextValue {
  ids:         string[];
  items:       CompareItem[];
  count:       number;
  /** Catégorie de la comparaison en cours (celle du 1er produit qui en a une) */
  category:    { id: string; nom: string | null } | null;
  isComparing: (productId: string) => boolean;
  /** Ajoute/retire le produit. `full` si déjà à MAX_COMPARE, `mismatch` si autre catégorie. */
  toggle:      (productId: string, meta?: CompareMeta) => ToggleResult;
  /** Ajoute seulement (jamais de retrait) — utilisé par le sélecteur de /comparer. */
  add:         (productId: string, meta?: CompareMeta) => ToggleResult;
  /** Vide la comparaison et repart de ce produit. */
  replaceWith: (productId: string, meta?: CompareMeta) => void;
  /** Complète la catégorie d'entrées existantes (sans changer l'ordre). */
  setMeta:     (productId: string, meta: CompareMeta) => void;
  remove:      (productId: string) => void;
  removeMany:  (productIds: string[]) => void;
  clear:       () => void;
}

const noop = () => {};
const CompareContext = createContext<CompareContextValue>({
  ids: [], items: [], count: 0, category: null,
  isComparing: () => false,
  toggle:      () => ({ added: false, full: false }),
  add:         () => ({ added: false, full: false }),
  replaceWith: noop, setMeta: noop, remove: noop, removeMany: noop, clear: noop,
});

function sanitize(raw: unknown): CompareItem[] {
  if (!Array.isArray(raw)) return [];
  const out: CompareItem[] = [];
  for (const x of raw) {
    if (typeof x === 'string') out.push({ id: x });
    else if (x && typeof x === 'object' && typeof (x as CompareItem).id === 'string') out.push(x as CompareItem);
  }
  /* dédoublonne + plafonne */
  return out.filter((it, i) => out.findIndex(o => o.id === it.id) === i).slice(0, MAX_COMPARE);
}

function loadInitial(): CompareItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    return raw ? sanitize(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function persist(items: CompareItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    localStorage.removeItem(LEGACY_KEY);
  } catch { /* stockage indisponible — état reste en mémoire pour la session */ }
}

function currentCategory(items: CompareItem[]): { id: string; nom: string | null } | null {
  const first = items.find(it => it.categoryId);
  return first?.categoryId ? { id: first.categoryId, nom: first.categoryNom ?? null } : null;
}

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CompareItem[]>(loadInitial);
  /* Copie synchrone de `items` : toggle() doit RETOURNER le résultat
   * (ajouté / retiré / plein) au moment du clic. Calculé dans l'updater
   * de setState, React pourrait l'exécuter plus tard (au rendu suivant)
   * et toggle() renverrait {added:false} même quand le produit est ajouté. */
  const itemsRef = useRef(items);
  const commit = useCallback((next: CompareItem[]) => {
    itemsRef.current = next;
    persist(next);
    setItems(next);
  }, []);

  const ids = useMemo(() => items.map(it => it.id), [items]);
  const category = useMemo(() => currentCategory(items), [items]);

  const isComparing = useCallback((productId: string) => ids.includes(productId), [ids]);

  const add = useCallback((productId: string, meta?: CompareMeta): ToggleResult => {
    const prev = itemsRef.current;
    if (prev.some(it => it.id === productId)) return { added: false, full: false };
    if (prev.length >= MAX_COMPARE) return { added: false, full: true };
    const cat = currentCategory(prev);
    if (cat && meta?.categoryId && meta.categoryId !== cat.id) {
      return { added: false, full: false, mismatch: cat.nom ?? '' };
    }
    commit([...prev, { id: productId, ...meta }]);
    return { added: true, full: false };
  }, [commit]);

  const toggle = useCallback((productId: string, meta?: CompareMeta): ToggleResult => {
    const prev = itemsRef.current;
    if (prev.some(it => it.id === productId)) {
      commit(prev.filter(it => it.id !== productId));
      return { added: false, full: false };
    }
    return add(productId, meta);
  }, [add, commit]);

  const replaceWith = useCallback((productId: string, meta?: CompareMeta) => {
    commit([{ id: productId, ...meta }]);
  }, [commit]);

  const setMeta = useCallback((productId: string, meta: CompareMeta) => {
    const prev = itemsRef.current;
    if (!prev.some(it => it.id === productId)) return;
    commit(prev.map(it => (it.id === productId ? { ...it, ...meta } : it)));
  }, [commit]);

  const remove = useCallback((productId: string) => {
    commit(itemsRef.current.filter(it => it.id !== productId));
  }, [commit]);

  const removeMany = useCallback((productIds: string[]) => {
    if (productIds.length === 0) return;
    commit(itemsRef.current.filter(it => !productIds.includes(it.id)));
  }, [commit]);

  const clear = useCallback(() => commit([]), [commit]);

  const value = useMemo<CompareContextValue>(() => ({
    ids, items, count: items.length, category,
    isComparing, toggle, add, replaceWith, setMeta, remove, removeMany, clear,
  }), [ids, items, category, isComparing, toggle, add, replaceWith, setMeta, remove, removeMany, clear]);

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export const useCompare = () => useContext(CompareContext);
