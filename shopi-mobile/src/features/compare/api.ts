/**
 * Comparaison de produits — point d'entrée public du domaine.
 *   GET /public/produits/comparables?ids=&scope=sub|cat&search=&limit=
 *     produits de la MÊME catégorie que ceux comparés (même sous-catégorie par
 *     défaut, `scope=cat` pour élargir), classés par pertinence côté serveur.
 *   GET /public/produits/:id   fiche de chaque produit comparé (features/product/api,
 *     même cache que la fiche produit : l'écran Comparer s'ouvre déjà rempli).
 * La liste elle-même est locale : voir store.ts.
 */
import { z } from 'zod';

import { productDetailSchema, type ProductDetail } from '@/features/product/api';
import { apiFetch } from '@/lib/api/client';

export { MAX_COMPARE, useCompareCount, useCompareStore, useIsComparing, type CompareMeta, type ToggleResult } from './store';

const ref = z.object({ id: z.string(), nom: z.string() }).passthrough().nullable().catch(null);

const comparablesSchema = z
  .object({
    categorie: ref,
    sousCategorie: ref,
    scope: z.enum(['sub', 'cat']).catch('sub'),
    /** true si la sous-catégorie était vide et que le serveur a élargi à la catégorie */
    fallback: z.boolean().catch(false),
    data: z.array(productDetailSchema).catch([]),
  })
  .passthrough();
export type Comparables = z.infer<typeof comparablesSchema>;

export const fetchComparables = (ids: string[], scope: 'sub' | 'cat', search = '', limit = 12) =>
  apiFetch('/public/produits/comparables', {
    auth: false,
    query: { ids: ids.join(','), scope, limit, search: search.trim() || undefined },
    schema: comparablesSchema,
  });

/** Catégorie d'un produit, telle que la liste de comparaison la retient. */
export const metaOf = (p: Pick<ProductDetail, 'category' | 'subCategory'>) => ({
  categoryId: p.category?.id ?? null,
  categoryNom: p.category?.nom ?? null,
  subCategoryId: p.subCategory?.id ?? null,
  subCategoryNom: p.subCategory?.nom ?? null,
});

/** Première image (par ordre) d'un produit. */
export const firstImageOf = (p: Pick<ProductDetail, 'images'>) =>
  [...p.images].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)).find((i) => (i.type ?? 'image') === 'image')?.url ?? null;
