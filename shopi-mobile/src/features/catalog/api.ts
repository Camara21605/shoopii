/**
 * Catalogue public — mêmes adresses que l'accueil du site
 * (shopi-frontend/src/modules/home/components/sections/RandomBloc.tsx) :
 *   GET /public/produits?type=detail|gros&search=&categoryId=&companyTypeId=
 *   GET /public/boutiques        GET /company-types        GET /categories
 * Schémas volontairement tolérants (.passthrough, champs facultatifs) : un
 * champ ajouté côté serveur ne casse pas l'app ; un champ essentiel absent
 * produit une erreur claire (voir lib/api/client.ts).
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const imageSchema = z.object({ url: z.string(), type: z.string().optional(), ordre: z.number().optional() }).passthrough();

export const productSchema = z
  .object({
    id: z.string(),
    nom: z.string(),
    prix: z.coerce.number(),
    prixAncien: z.coerce.number().nullable().optional(),
    stock: z.coerce.number().optional(),
    images: z.array(imageSchema).optional().default([]),
    category: z.object({ id: z.string(), nom: z.string(), icone: z.string().nullable().optional() }).nullable().optional(),
    companyId: z.string().optional(),
    companyName: z.string().nullable().optional(),
    companyLogo: z.string().nullable().optional(),
    companyVerified: z.boolean().optional(),
    venteEnGros: z.boolean().optional(),
    moq: z.coerce.number().nullable().optional(),
  })
  .passthrough();
export type Product = z.infer<typeof productSchema>;

export const shopSchema = z
  .object({
    id: z.string(),
    companyName: z.string(),
    logo: z.string().nullable().optional(),
    coverImage: z.string().nullable().optional(),
    verified: z.boolean().optional(),
    averageRating: z.coerce.number().optional(),
    totalRatings: z.coerce.number().optional(),
    localisation: z.string().nullable().optional(),
    domaine: z.string().nullable().optional(),
    domaineIcon: z.string().nullable().optional(),
    online: z.boolean().optional(),
    totalAbonnes: z.coerce.number().optional(),
  })
  .passthrough();
export type Shop = z.infer<typeof shopSchema>;

export const companyTypeSchema = z
  .object({
    id: z.string(),
    nom: z.string(),
    icone: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    couleur: z.string().nullable().optional(),
    ordre: z.coerce.number().optional(),
    actif: z.boolean().optional(),
  })
  .passthrough();
export type CompanyType = z.infer<typeof companyTypeSchema>;

export const categorySchema = z
  .object({
    id: z.string(),
    nom: z.string(),
    icone: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    ordre: z.coerce.number().optional(),
    actif: z.boolean().optional(),
    companyTypeId: z.string().nullable().optional(),
  })
  .passthrough();
export type Category = z.infer<typeof categorySchema>;

const page = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ data: z.array(item), total: z.coerce.number().optional(), pages: z.coerce.number().optional() }).passthrough();

export type ProductFilters = {
  type?: 'detail' | 'gros';
  search?: string;
  categoryId?: string;
  companyTypeId?: string;
  limit?: number;
};

export async function fetchProducts(f: ProductFilters = {}) {
  const res = await apiFetch('/public/produits', {
    auth: false,
    schema: page(productSchema),
    query: {
      limit: f.limit ?? 20,
      type: f.type,
      search: f.search?.trim() || undefined,
      categoryId: f.categoryId,
      companyTypeId: f.companyTypeId,
    },
  });
  return res.data;
}

export async function fetchShops(limit = 10) {
  const res = await apiFetch('/public/boutiques', { auth: false, schema: page(shopSchema), query: { limit } });
  return res.data;
}

const byOrder = <T extends { ordre?: number; nom: string }>(a: T, b: T) =>
  (a.ordre ?? 999) - (b.ordre ?? 999) || a.nom.localeCompare(b.nom, 'fr');

export async function fetchCompanyTypes() {
  const list = await apiFetch('/company-types', { auth: false, schema: z.array(companyTypeSchema) });
  return list.filter((t) => t.actif !== false).sort(byOrder);
}

export async function fetchCategories() {
  const list = await apiFetch('/categories', { auth: false, schema: z.array(categorySchema) });
  return list.filter((c) => c.actif !== false).sort(byOrder);
}
