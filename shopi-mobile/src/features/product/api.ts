/**
 * Fiche produit — mêmes adresses que la page /produit/:id du site
 * (shopi-frontend/src/modules/home/components/produit) :
 *   GET /public/produits/:id                       le produit (images, specs, variantes, gros, livraison…)
 *   GET /public/produits/:id/similaires            produits de la même catégorie
 *   GET /public/explore/:id/souvent-achete-avec    souvent achetés ensemble
 *   GET /public/boutiques/:companyId               vendeur (note, abonnés, ventes)
 *   GET /geo/frais-livraison?ville=                tarif de la zone de livraison (fixé par l'admin)
 * Panier / favoris / abonnement / message : voir features/shop/api.ts.
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const num = z.coerce.number().catch(0);
const str = z.string().nullable().optional();

export const productDetailSchema = z
  .object({
    id: z.string(),
    nom: z.string().catch('Produit'),
    description: str,
    prix: num,
    prixAncien: z.coerce.number().nullable().optional(),
    marque: str,
    stock: num,
    condition: str,
    garantie: str,
    urlSlug: str,
    images: z
      .array(z.object({ id: z.string().optional(), url: z.string(), ordre: z.coerce.number().optional(), alt: str, type: z.string().catch('image') }).passthrough())
      .catch([]),
    category: z.object({ id: z.string(), nom: z.string(), icone: str }).passthrough().nullable().optional(),
    subCategory: z.object({ id: z.string(), nom: z.string() }).passthrough().nullable().optional(),
    specs: z.array(z.object({ cle: z.string(), valeur: z.string(), ordre: z.coerce.number().optional() }).passthrough()).catch([]),
    variantes: z.array(z.object({ id: z.string(), type: z.string(), vals: z.string() }).passthrough()).catch([]),
    companyId: z.string(),
    companyName: z.string().catch(''),
    companyLogo: str,
    companyVerified: z.boolean().catch(false),
    companyVille: str,
    companyPays: z.string().catch('GN'),
    venteEnGros: z.boolean().catch(false),
    moq: z.coerce.number().nullable().optional(),
    wholesaleTiers: z
      .array(z.object({ quantiteMin: num, quantiteMax: z.coerce.number().nullable().optional(), prixUnitaire: num, ordre: z.coerce.number().optional() }).passthrough())
      .catch([]),
    livraisonStandard: z.boolean().catch(false),
    livraisonLivreur: z.boolean().catch(false),
    livraisonCorrespondant: z.boolean().catch(false),
    fraisLivraisonLocal: z.coerce.number().nullable().optional(),
    delaiLivraison: str,
    returnPolicy: str,
    createdAt: z.string().catch(''),
  })
  .passthrough();
export type ProductDetail = z.infer<typeof productDetailSchema>;

export const fetchProduct = (id: string) => apiFetch(`/public/produits/${id}`, { auth: false, schema: productDetailSchema });

export const similarSchema = z
  .object({
    id: z.string(),
    nom: z.string().catch(''),
    prix: num,
    prixAncien: z.coerce.number().nullable().optional(),
    imageUrl: str,
    emoji: str,
    shopNom: z.string().catch(''),
    shopId: z.string().catch(''),
    badge: str,
  })
  .passthrough();
export type SimilarProduct = z.infer<typeof similarSchema>;

export const fetchSimilar = (id: string) =>
  apiFetch(`/public/produits/${id}/similaires`, { auth: false, query: { limit: 10 }, schema: z.array(similarSchema).catch([]) });

/** Format des produits Explorer (même que le catalogue public). */
const boughtTogetherSchema = z
  .object({
    id: z.string(),
    nom: z.string().catch(''),
    prix: num,
    prixAncien: z.coerce.number().nullable().optional(),
    images: z.array(z.object({ url: z.string(), ordre: z.coerce.number().optional(), type: z.string().optional() }).passthrough()).catch([]),
    category: z.object({ icone: str }).passthrough().nullable().optional(),
    companyId: z.string().catch(''),
    companyName: z.string().catch(''),
  })
  .passthrough();

/** Ramené au format « similaire » pour partager la même carte. */
export async function fetchBoughtTogether(id: string): Promise<SimilarProduct[]> {
  const list = await apiFetch(`/public/explore/${id}/souvent-achete-avec`, { auth: false, query: { limit: 10 }, schema: z.array(boughtTogetherSchema).catch([]) });
  return list.map((p) => {
    const img = [...p.images].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)).find((i) => (i.type ?? 'image') === 'image');
    return { id: p.id, nom: p.nom, prix: p.prix, prixAncien: p.prixAncien, imageUrl: img?.url ?? null, emoji: p.category?.icone ?? null, shopNom: p.companyName, shopId: p.companyId, badge: null };
  });
}

/** Tarif de livraison de la zone couvrant cette ville (0 / null = zone non tarifée). */
export const fetchDeliveryFee = (ville: string) =>
  apiFetch('/geo/frais-livraison', {
    auth: false,
    query: { ville },
    schema: z.object({ fraisLivraison: num, zoneNom: str }).passthrough(),
  });
