/**
 * Profil public d'une entreprise — mêmes adresses que la page /boutique/:id
 * du site (shopi-frontend/src/modules/home/components/boutique/pages/BoutiquePage.tsx) :
 *   GET  /public/boutiques/:id                  fiche (identité, horaires, livraison…)
 *   GET  /public/boutiques/:id/produits         catalogue produits (paginé → toutes les pages)
 *   GET  /public/boutiques/:id/services         catalogue services (boutique de services)
 *   GET  /public/boutiques/:id/livreurs         livreurs de la boutique
 *   GET  /public/boutiques/:id/correspondants   points relais de la boutique
 *   GET  /public/boutiques/:id/promotions       promotions actives
 *   GET  /public/boutiques/:id/avis             avis clients
 *   GET  /suivis/{entreprises|livreurs|correspondants}/:id/statut   suis-je abonné ?
 *   POST /messagerie/conversations              démarrer / reprendre une conversation
 *   POST /client/panier  ·  GET /client/favoris/ids  ·  POST /client/favoris/:id/toggle
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const num = z.coerce.number().catch(0);
const str = z.string().nullable().optional();

/* ── Fiche boutique ─────────────────────────────────────────────────── */

const hourSchema = z.object({ jour: z.string(), ouverture: str, fermeture: str, actif: z.boolean().catch(false) }).passthrough();
export type ShopHour = z.infer<typeof hourSchema>;

export const shopDetailSchema = z
  .object({
    id: z.string(),
    companyName: z.string().catch('Boutique'),
    description: str,
    slogan: str,
    logo: str,
    coverImage: str,
    businessPhone: str,
    businessEmail: str,
    whatsapp: str,
    website: str,
    averageRating: num,
    totalOrders: num,
    totalRatings: num,
    ville: str,
    commune: str,
    quartier: str,
    localisation: str,
    adresse: str,
    verified: z.boolean().catch(false),
    businessModel: z.enum(['products', 'services']).catch('products'),
    domaine: str,
    domaineIcon: str,
    membre: str,
    createdAt: str,
    totalAbonnes: num,
    online: z.boolean().catch(false),
    horaires: z.array(hourSchema).catch([]),
    livraison: z
      .object({
        standard: z.boolean().catch(false),
        livreursShopi: z.boolean().catch(false),
        correspondants: z.boolean().catch(false),
        clickCollect: z.boolean().catch(false),
        zones: z.array(z.string()).catch([]),
      })
      .nullable()
      .optional(),
  })
  .passthrough();
export type ShopDetail = z.infer<typeof shopDetailSchema>;

export const fetchShop = (id: string) => apiFetch(`/public/boutiques/${id}`, { auth: false, schema: shopDetailSchema });

/* ── Catalogue (toutes les pages, comme le site : plus de plafond à 50) ── */

const PAGE_LIMIT = 100; // MAX_PUBLIC_LIMIT côté serveur
const HARD_CAP = 1000; // filet de sécurité

async function fetchAllPages<T extends z.ZodTypeAny>(path: string, item: T): Promise<z.infer<T>[]> {
  const pageSchema = z.object({ data: z.array(item), pages: z.coerce.number().optional() }).passthrough();
  const all: z.infer<T>[] = [];
  for (let page = 1; ; page++) {
    const res = await apiFetch(path, { auth: false, schema: pageSchema, query: { page, limit: PAGE_LIMIT } });
    all.push(...res.data);
    if (page >= (res.pages ?? 1) || res.data.length === 0 || all.length >= HARD_CAP) break;
  }
  return all;
}

export const shopProductSchema = z
  .object({
    id: z.string(),
    nom: z.string().catch(''),
    description: str,
    prix: num,
    prixAncien: z.coerce.number().nullable().optional(),
    marque: str,
    stock: num,
    images: z.array(z.object({ url: z.string(), ordre: z.coerce.number().optional(), type: z.string().optional() }).passthrough()).catch([]),
    category: z.object({ id: z.string(), nom: z.string(), icone: str }).passthrough().nullable().optional(),
    createdAt: z.string().catch(''),
  })
  .passthrough();
export type ShopProduct = z.infer<typeof shopProductSchema>;

export const fetchShopProducts = (id: string) => fetchAllPages(`/public/boutiques/${id}/produits`, shopProductSchema);

export const shopServiceSchema = z
  .object({
    id: z.string(),
    nom: z.string().catch(''),
    description: str,
    pricingType: z.string().catch('fixe'),
    prix: z.coerce.number().nullable().optional(),
    prixAncien: z.coerce.number().nullable().optional(),
    dureeMinMinutes: z.coerce.number().nullable().optional(),
    dureeMaxMinutes: z.coerce.number().nullable().optional(),
    surPlaceEntreprise: z.boolean().catch(false),
    aDomicile: z.boolean().catch(false),
    aDistance: z.boolean().catch(false),
    zoneCouverture: str,
    reservationRequise: z.boolean().catch(false),
    delaiReponse: str,
    garantiePaiement: z.boolean().catch(false),
    garantieSatisfaction: z.boolean().catch(false),
    media: z.array(z.object({ url: z.string(), ordre: z.coerce.number().optional(), type: z.string().optional() }).passthrough()).catch([]),
    category: z.object({ id: z.string(), nom: z.string(), icone: str }).passthrough().nullable().optional(),
  })
  .passthrough();
export type ShopService = z.infer<typeof shopServiceSchema>;

export const fetchShopServices = (id: string) => fetchAllPages(`/public/boutiques/${id}/services`, shopServiceSchema);

/* ── Équipe : livreurs et points relais ─────────────────────────────── */

const listOf = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => (Array.isArray(v) ? v : ((v as { data?: unknown })?.data ?? [])), z.array(item));

export const shopDriverSchema = z
  .object({
    id: z.string(),
    fullName: z.string().catch('Livreur'),
    zone: str,
    ville: str,
    commune: str,
    quartier: str,
    localisation: str,
    availability: z.string().catch('offline'),
    phone: str,
    emoji: z.string().catch('🛵'),
    note: num,
    trips: num,
  })
  .passthrough();
export type ShopDriver = z.infer<typeof shopDriverSchema>;

export const fetchShopDrivers = (id: string) => apiFetch(`/public/boutiques/${id}/livreurs`, { auth: false, schema: listOf(shopDriverSchema) });

export const shopRelaySchema = z
  .object({
    id: z.string(),
    fullName: z.string().catch('Point relais'),
    ville: str,
    commune: str,
    quartier: str,
    localisation: str,
    note: num,
    missions: num,
    verified: z.boolean().catch(false),
    langues: z.array(z.string()).catch([]),
    bio: str,
    phone: str,
    horaireAujourdhui: str,
  })
  .passthrough();
export type ShopRelay = z.infer<typeof shopRelaySchema>;

export const fetchShopRelays = (id: string) => apiFetch(`/public/boutiques/${id}/correspondants`, { auth: false, schema: listOf(shopRelaySchema) });

/* ── Promotions et avis ─────────────────────────────────────────────── */

export const promoSchema = z
  .object({
    id: z.string(),
    nom: z.string().catch(''),
    code: z.string().catch(''),
    type: z.string().catch('discount'), // discount · free-ship · bundle · flash
    valueType: z.string().catch('percent'), // percent · fixed · free
    valeur: z.coerce.number().nullable().optional(),
    montantMinimum: z.coerce.number().nullable().optional(),
    endDate: str,
    usesCount: num,
    maxUtilisations: z.coerce.number().nullable().optional(),
    flashStock: z.coerce.number().nullable().optional(),
  })
  .passthrough();
export type Promo = z.infer<typeof promoSchema>;

export const fetchShopPromos = (id: string) => apiFetch(`/public/boutiques/${id}/promotions`, { auth: false, schema: listOf(promoSchema) });

export const reviewSchema = z
  .object({
    id: z.string(),
    clientNom: z.string().catch('Client'),
    clientInitiales: z.string().catch(''),
    note: num,
    commentaire: str,
    date: z.string().catch(''),
    reponse: str,
  })
  .passthrough();
export type Review = z.infer<typeof reviewSchema>;

export const fetchShopReviews = (id: string) =>
  apiFetch(`/public/boutiques/${id}/avis`, {
    auth: false,
    schema: z.object({ averageRating: num, totalRatings: num, avis: z.array(reviewSchema).catch([]) }).passthrough(),
  });

/* ── Actions du visiteur connecté ───────────────────────────────────── */

export async function fetchFollowStatus(kind: 'entreprises' | 'livreurs' | 'correspondants', id: string) {
  const res = await apiFetch(`/suivis/${kind}/${id}/statut`, { schema: z.object({ isSuivi: z.boolean().catch(false) }).passthrough() });
  return res.isSuivi;
}

export type ActorType = 'company' | 'delivery' | 'correspondent' | 'partner' | 'client';

/** Démarre (ou reprend) la conversation avec cet acteur — renvoie son id. */
export async function startConversation(targetType: ActorType, targetId: string) {
  const res = await apiFetch('/messagerie/conversations', {
    method: 'POST',
    body: { targetType, targetId },
    schema: z.object({ id: z.string() }).passthrough(),
  });
  return res.id;
}

export const addToCart = (produitId: string, qty = 1, variante?: string) =>
  apiFetch('/client/panier', { method: 'POST', body: { produitId, qty, variante }, schema: z.unknown() });

export async function fetchFavoriteIds(): Promise<Set<string>> {
  const ids = await apiFetch('/client/favoris/ids', { schema: z.array(z.string()).catch([]) });
  return new Set(ids);
}

export const toggleFavorite = (productId: string) =>
  apiFetch(`/client/favoris/${productId}/toggle`, { method: 'POST', schema: z.object({ liked: z.boolean() }).passthrough() });
