/**
 * Produits de la boutique (espace entreprise) — mêmes routes que ProduitsPage du site :
 *   GET    /produits?page=&limit=                catalogue de la boutique (paginé)
 *   GET    /produits/:id                         détail complet
 *   PATCH  /produits/:id                         modification rapide { stock, seuil, visibilite } (products.edit)
 *   PATCH  /produits/:id/archive                 archiver (public → privé) (products.edit)
 *   DELETE /produits/:id                         supprimer (products.delete)
 *   GET    /produits/stories                     stories de la boutique (tous produits)
 *   GET    /produits/:id/stories                 stories d'un produit
 *   POST   /produits/:id/stories { mediaUrl }    publier une image en story 24 h (products.edit)
 *   DELETE /produits/:id/stories/:storyId        retirer une story
 *   GET    /public/stories/:id/viewers           qui a vu la story
 *   GET    /dashboard/entreprise/commission-rate taux de commission réel de la boutique
 *
 * Le site ne charge que la première page (20 produits) : ici TOUT le catalogue est
 * chargé (pages de 100) pour que statistiques, filtres et recherche soient justes.
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const num = z.coerce.number().catch(0);
const str = z.string().nullable().optional().catch(null);

export type Visibility = 'public' | 'draft' | 'private';

export const productSchema = z
  .object({
    id: z.string(),
    nom: z.string().catch(''),
    description: str,
    prix: num,
    prixAncien: z.coerce.number().nullable().optional().catch(null),
    stock: num,
    seuil: z.coerce.number().nullable().optional().catch(null),
    visibilite: z.enum(['public', 'draft', 'private']).catch('draft'),
    condition: z.string().catch(''),
    garantie: z.string().catch(''),
    marque: str,
    tags: str,
    reference: str,
    paysOrigine: z.string().catch(''),
    urlSlug: str,
    category: z.object({ id: z.string().catch(''), nom: z.string().catch(''), icone: str }).nullable().catch(null),
    subCategory: z.object({ id: z.string(), nom: z.string() }).nullable().optional().catch(null),
    images: z.array(z.object({ id: z.string(), url: z.string(), ordre: num, alt: str, type: str })).catch([]),
    specs: z.array(z.object({ id: z.string(), cle: z.string().catch(''), valeur: z.string().catch('') })).catch([]),
    variantes: z.array(z.object({ id: z.string(), type: z.string().catch(''), vals: z.string().catch('') })).catch([]),
    createdAt: z.string().catch(''),
  })
  .passthrough();
export type Product = z.infer<typeof productSchema>;

const pageSchema = z.object({ data: z.array(productSchema).catch([]), total: num, pages: num }).passthrough();

/** Tout le catalogue, page après page (100 par page, 30 pages au plus). */
export async function fetchAllProducts(): Promise<Product[]> {
  const all: Product[] = [];
  for (let page = 1; page <= 30; page++) {
    const res = await apiFetch('/produits', { query: { page, limit: 100 }, schema: pageSchema });
    all.push(...res.data);
    if (page >= res.pages || res.data.length === 0) break;
  }
  return all;
}

export const fetchProduct = (id: string) => apiFetch(`/produits/${id}`, { schema: productSchema });

export const quickUpdate = (id: string, body: { stock: number; seuil: number | null; visibilite: Visibility }) =>
  apiFetch(`/produits/${id}`, { method: 'PATCH', body, schema: productSchema });

export const archiveProduct = (id: string) => apiFetch(`/produits/${id}/archive`, { method: 'PATCH' });
export const deleteProduct = (id: string) => apiFetch(`/produits/${id}`, { method: 'DELETE' });

/* ── Commission ─────────────────────────────────────────────────────── */

export const fetchCommissionRate = () =>
  apiFetch('/dashboard/entreprise/commission-rate', { schema: z.object({ percentage: num }).passthrough() }).then((r) => r.percentage);

/* ── Stories ────────────────────────────────────────────────────────── */

export const storySchema = z
  .object({
    id: z.string(),
    productId: z.string().optional().catch(undefined),
    productNom: z.string().optional().catch(undefined),
    mediaUrl: z.string(),
    mediaType: z.string().catch('image'),
    caption: str,
    status: z.string().catch('published'),
    expiresAt: z.string().catch(''),
    createdAt: z.string().catch(''),
    viewsCount: num,
  })
  .passthrough();
export type Story = z.infer<typeof storySchema>;

export const fetchMyStories = () => apiFetch('/produits/stories', { schema: z.array(storySchema).catch([]) });
export const fetchProductStories = (id: string) => apiFetch(`/produits/${id}/stories`, { schema: z.array(storySchema).catch([]) });
export const addStory = (id: string, mediaUrl: string) => apiFetch(`/produits/${id}/stories`, { method: 'POST', body: { mediaUrl } });
export const deleteStory = (id: string, storyId: string) => apiFetch(`/produits/${id}/stories/${storyId}`, { method: 'DELETE' });

export const viewerSchema = z.object({ id: z.string(), name: z.string().catch(''), avatar: str, viewedAt: z.string().catch(''), liked: z.boolean().catch(false) });
export type StoryViewer = z.infer<typeof viewerSchema>;
export const fetchStoryViewers = (storyId: string) => apiFetch(`/public/stories/${storyId}/viewers`, { schema: z.array(viewerSchema).catch([]) });

/** Le serveur dérive le statut de expiresAt ; on revérifie ici (une story expirée disparaît). */
export const isStoryActive = (s: Story, now: number) => s.status === 'published' && new Date(s.expiresAt).getTime() > now;

/** « 23h45 » / « 45 min » jusqu'à l'expiration. */
export function expiresIn(expiresAt: string, now: number) {
  const minutes = Math.max(1, Math.ceil((new Date(expiresAt).getTime() - now) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

/* ── Présentation partagée ──────────────────────────────────────────── */

export const VISIBILITY: Record<Visibility, { label: string; long: string; color: string; bg: string }> = {
  public: { label: 'Public', long: 'Public — visible sur la boutique', color: '#047857', bg: '#ECFDF5' },
  draft: { label: 'Brouillon', long: 'Brouillon — non publié', color: '#B45309', bg: '#FFF7E6' },
  private: { label: 'Privé', long: 'Privé — lien direct uniquement', color: '#B91C1C', bg: '#FEF2F2' },
};

export type StockLevel = 'out' | 'low' | 'ok';
export const stockLevel = (p: Pick<Product, 'stock' | 'seuil'>): StockLevel => (p.stock === 0 ? 'out' : p.seuil && p.stock <= p.seuil ? 'low' : 'ok');
export const STOCK_COLOR: Record<StockLevel, string> = { out: '#DC2626', low: '#D97706', ok: '#059669' };
export const stockText = (p: Pick<Product, 'stock' | 'seuil'>) => {
  const l = stockLevel(p);
  return l === 'out' ? 'Rupture de stock' : l === 'low' ? `Stock faible — ${p.stock} restant${p.stock > 1 ? 's' : ''}` : `${p.stock} en stock`;
};

export const gnf = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} GNF`;
export const normalize = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
