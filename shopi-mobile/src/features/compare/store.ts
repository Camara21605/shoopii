/**
 * Liste de comparaison produits (⚖️) — même règles que CompareContext du site :
 *   · purement locale (pas de compte requis, pas de serveur) : comparer est un
 *     usage ponctuel, pas une donnée à synchroniser entre appareils ;
 *   · MAX_COMPARE produits au plus (au-delà, le tableau devient illisible) ;
 *   · UNE SEULE CATÉGORIE par comparaison : ajouter un produit d'une autre
 *     catégorie est refusé (`mismatch`), l'écran propose alors de démarrer une
 *     nouvelle comparaison (replaceWith). Comparer un jus et un détergent n'a
 *     aucun sens.
 * Gardée dans un petit fichier JSON du téléphone (pas le stockage chiffré :
 * rien de sensible), relue au démarrage pour survivre à la fermeture de l'app.
 */
import { File, Paths } from 'expo-file-system';
import { create } from 'zustand';

export const MAX_COMPARE = 4;
const FILE_NAME = 'shoneya-compare.json';

/** Catégorie d'un produit — connue dès l'ajout depuis la fiche produit. */
export interface CompareMeta {
  categoryId?: string | null;
  categoryNom?: string | null;
  subCategoryId?: string | null;
  subCategoryNom?: string | null;
}
export interface CompareItem extends CompareMeta {
  id: string;
}
export interface ToggleResult {
  added: boolean;
  full: boolean;
  /** Nom de la catégorie en cours si le produit est d'une autre catégorie */
  mismatch?: string | null;
}

function sanitize(raw: unknown): CompareItem[] {
  if (!Array.isArray(raw)) return [];
  const out: CompareItem[] = [];
  for (const x of raw) {
    if (x && typeof x === 'object' && typeof (x as CompareItem).id === 'string') out.push(x as CompareItem);
  }
  return out.filter((it, i) => out.findIndex((o) => o.id === it.id) === i).slice(0, MAX_COMPARE);
}

/* Fichier indisponible (aperçu web, disque plein…) : la liste reste en mémoire pour la session. */
function file() {
  try {
    return new File(Paths.document, FILE_NAME);
  } catch {
    return null;
  }
}

function load(): CompareItem[] {
  try {
    const f = file();
    return f?.exists ? sanitize(JSON.parse(f.textSync())) : [];
  } catch {
    return [];
  }
}

function persist(items: CompareItem[]) {
  try {
    const f = file();
    if (!f) return;
    if (!f.exists) f.create();
    f.write(JSON.stringify(items));
  } catch {
    /* voir file() */
  }
}

export function currentCategory(items: CompareItem[]): { id: string; nom: string | null } | null {
  const first = items.find((it) => it.categoryId);
  return first?.categoryId ? { id: first.categoryId, nom: first.categoryNom ?? null } : null;
}

interface CompareState {
  items: CompareItem[];
  /** Ajoute seulement (jamais de retrait). */
  add: (id: string, meta?: CompareMeta) => ToggleResult;
  /** Ajoute ou retire le produit. */
  toggle: (id: string, meta?: CompareMeta) => ToggleResult;
  /** Vide la comparaison et repart de ce produit. */
  replaceWith: (id: string, meta?: CompareMeta) => void;
  /** Complète la catégorie d'une entrée existante (sans changer l'ordre). */
  setMeta: (id: string, meta: CompareMeta) => void;
  remove: (id: string) => void;
  removeMany: (ids: string[]) => void;
  clear: () => void;
}

export const useCompareStore = create<CompareState>((set, get) => {
  /* Le résultat (ajouté / plein / autre catégorie) est calculé sur l'état courant,
   * de façon synchrone : l'écran peut réagir tout de suite au toucher. */
  const commit = (items: CompareItem[]) => {
    persist(items);
    set({ items });
  };

  const add = (id: string, meta?: CompareMeta): ToggleResult => {
    const prev = get().items;
    if (prev.some((it) => it.id === id)) return { added: false, full: false };
    if (prev.length >= MAX_COMPARE) return { added: false, full: true };
    const cat = currentCategory(prev);
    if (cat && meta?.categoryId && meta.categoryId !== cat.id) return { added: false, full: false, mismatch: cat.nom ?? '' };
    commit([...prev, { id, ...meta }]);
    return { added: true, full: false };
  };

  return {
    items: load(),
    add,
    toggle: (id, meta) => {
      const prev = get().items;
      if (prev.some((it) => it.id === id)) {
        commit(prev.filter((it) => it.id !== id));
        return { added: false, full: false };
      }
      return add(id, meta);
    },
    replaceWith: (id, meta) => commit([{ id, ...meta }]),
    setMeta: (id, meta) => {
      const prev = get().items;
      if (prev.some((it) => it.id === id)) commit(prev.map((it) => (it.id === id ? { ...it, ...meta } : it)));
    },
    remove: (id) => commit(get().items.filter((it) => it.id !== id)),
    removeMany: (ids) => {
      if (ids.length) commit(get().items.filter((it) => !ids.includes(it.id)));
    },
    clear: () => commit([]),
  };
});

/** Nombre de produits dans la comparaison (pour les pastilles). */
export const useCompareCount = () => useCompareStore((s) => s.items.length);
/** Ce produit est-il dans la comparaison ? */
export const useIsComparing = (id: string | undefined) => useCompareStore((s) => !!id && s.items.some((it) => it.id === id));
