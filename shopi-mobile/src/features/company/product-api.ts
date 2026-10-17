/**
 * Ajout d'un produit — mêmes adresses que la page du site (AjouterPage.tsx) :
 *   GET  /produits/categories                    catégories CHOISIES par l'entreprise (+ sous-catégories)
 *   GET  /produits/check-slug?slug=              adresse (slug) libre ?
 *   GET  /dashboard/entreprise/commission-rate   commission réelle pour un prix donné (?montant=)
 *   GET  /dashboard/entreprise/parametres        publication auto + modes de livraison par défaut
 *   POST /upload/image/product · /upload/video   médias (réponse { url })
 *   POST /produits                               création (CreateProductDto)
 * Le serveur reste la source de vérité (mêmes contrôles côté produits.service.ts) ;
 * les contrôles de l'application évitent seulement un aller-retour inutile.
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

export const productCategorySchema = z
  .object({
    id: z.string(),
    nom: z.string(),
    icone: z.string().nullable().optional(),
    subCategories: z.array(z.object({ id: z.string(), nom: z.string() })).catch([]),
  })
  .passthrough();
export type ProductCategory = z.infer<typeof productCategorySchema>;

export const fetchProductCategories = () =>
  apiFetch('/produits/categories', { schema: z.array(productCategorySchema) });

export const checkSlug = (slug: string, signal?: AbortSignal) =>
  apiFetch('/produits/check-slug', {
    query: { slug },
    signal,
    schema: z.object({ available: z.boolean(), slug: z.string() }),
  });

/** Taux EFFECTIF de la boutique (plan + réglages de commission) — `montant` donne le montant exact. */
export const fetchCommission = (montant: number | null, signal?: AbortSignal) =>
  apiFetch('/dashboard/entreprise/commission-rate', {
    query: { montant: montant && montant > 0 ? montant : undefined },
    signal,
    schema: z
      .object({
        percentage: z.coerce.number().catch(0),
        commissionAmount: z.coerce.number().optional(),
        revenuNet: z.coerce.number().optional(),
      })
      .passthrough(),
  });

/** Réglages de la boutique utilisés comme valeurs de départ du formulaire. */
export const fetchShopDefaults = () =>
  apiFetch('/dashboard/entreprise/parametres', {
    schema: z
      .object({
        autoPublish: z.boolean().optional(),
        livraisonStandard: z.boolean().optional(),
        livraisonShopi: z.boolean().optional(),
        livraisonCorresp: z.boolean().optional(),
      })
      .passthrough(),
  });

export async function uploadProductMedia(kind: 'image' | 'video', file: { uri: string; name: string; mimeType: string }): Promise<string> {
  const formData = new FormData();
  // RN FormData : objet {uri, name, type} — envoyé par XMLHttpRequest dans apiFetch (le fetch d'Expo ne lit pas ce format).
  formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  const res = await apiFetch(kind === 'video' ? '/upload/video' : '/upload/image/product', {
    method: 'POST',
    formData,
    schema: z.object({ url: z.string() }).passthrough(),
  });
  return res.url;
}

export const createProduct = (dto: Record<string, unknown>) =>
  apiFetch('/produits', {
    method: 'POST',
    body: dto,
    schema: z.object({ id: z.string(), nom: z.string().optional(), visibilite: z.string().optional() }).passthrough(),
  });
