/**
 * Espace entreprise › Promotions — mêmes adresses que la page du site
 * (PromotionsPage.tsx, promotions.api.ts) :
 *   GET    /promotions/stats            chiffres du haut (total, actives, planifiées, brouillons, utilisations, CA)
 *   GET    /promotions?limit=100&search= liste (recherche côté serveur)
 *   POST   /promotions                  création (toujours en brouillon côté serveur)
 *   PATCH  /promotions/:id              modification
 *   DELETE /promotions/:id              suppression (refusée si active)
 *   PATCH  /promotions/:id/activate     brouillon / en pause → active (refusé si terminée ou date dépassée)
 *   PATCH  /promotions/:id/pause        active → en pause
 *   PATCH  /promotions/:id/end          terminer définitivement
 * Produits ciblés : catalogue de la boutique (GET /produits, voir company-products).
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const num = z.coerce.number().catch(0);
const numOrNull = z.coerce.number().nullable().catch(null);

export type PromoStatus = 'active' | 'scheduled' | 'draft' | 'paused' | 'ended';
export type PromoType = 'discount' | 'free-ship' | 'bundle' | 'flash';
export type PromoScope = 'global' | 'products';
export type ValueType = 'percent' | 'fixed' | 'free';

export const promoSchema = z
  .object({
    id: z.string(),
    nom: z.string().catch(''),
    code: z.string().catch(''),
    type: z.enum(['discount', 'free-ship', 'bundle', 'flash']).catch('discount'),
    typeL: z.string().catch(''),
    scope: z.enum(['global', 'products']).catch('global'),
    status: z.enum(['active', 'scheduled', 'draft', 'paused', 'ended']).catch('draft'),
    valueType: z.string().nullable().catch(null),
    valeur: numOrNull,
    montantMinimum: numOrNull,
    plafondReduction: numOrNull,
    maxUtilisations: numOrNull,
    maxParClient: z.coerce.number().catch(1),
    uses: num,
    max: num,
    revenue: z.string().catch('0'),
    caGenere: num,
    startDate: z.string().nullable().catch(null),
    endDate: z.string().nullable().catch(null),
    expire: z.string().catch(''),
    flashStock: numOrNull,
    bundleQuantiteMin: numOrNull,
    bundleQuantiteOfferte: numOrNull,
    freeShipSeuil: numOrNull,
    description: z.string().nullable().catch(null),
    productIds: z.array(z.string()).catch([]),
    createdAt: z.string().catch(''),
  })
  .passthrough();
export type Promo = z.infer<typeof promoSchema>;

export const statsSchema = z.object({ total: num, actives: num, planifiees: num, brouillons: num, totalUses: num, totalCa: num }).passthrough();
export type PromoStats = z.infer<typeof statsSchema>;

export const fetchStats = () => apiFetch('/promotions/stats', { schema: statsSchema });
export const fetchPromos = (search: string, signal?: AbortSignal) =>
  apiFetch('/promotions', {
    signal,
    query: { limit: 100, search: search.trim() || undefined },
    schema: z.object({ data: z.array(promoSchema).catch([]), total: num }).passthrough(),
  }).then((r) => r.data);
export const fetchPromo = (id: string) => apiFetch(`/promotions/${id}`, { schema: promoSchema });

export const createPromo = (dto: Record<string, unknown>) => apiFetch('/promotions', { method: 'POST', body: dto, schema: promoSchema });
export const updatePromo = (id: string, dto: Record<string, unknown>) => apiFetch(`/promotions/${id}`, { method: 'PATCH', body: dto, schema: promoSchema });
export const deletePromo = (id: string) => apiFetch(`/promotions/${id}`, { method: 'DELETE' });
export const activatePromo = (id: string) => apiFetch(`/promotions/${id}/activate`, { method: 'PATCH' });
export const pausePromo = (id: string) => apiFetch(`/promotions/${id}/pause`, { method: 'PATCH' });
export const endPromo = (id: string) => apiFetch(`/promotions/${id}/end`, { method: 'PATCH' });

/* ── Libellés ─────────────────────────────────────────────────────── */

export const TYPE: Record<PromoType, { icon: string; label: string; sub: string }> = {
  discount: { icon: '🏷️', label: 'Réduction', sub: 'Pourcentage ou montant sur le panier' },
  'free-ship': { icon: '🚚', label: 'Livraison offerte', sub: 'Frais de livraison offerts' },
  bundle: { icon: '🎁', label: 'Lot / bundle', sub: 'Ex. 2 achetés = 1 offert' },
  flash: { icon: '⚡', label: 'Vente flash', sub: 'Durée et stock limités' },
};

export const STATUS: Record<PromoStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: '#0F9D58' },
  scheduled: { label: 'Planifiée', color: '#2F6FDB' },
  draft: { label: 'Brouillon', color: '#8A8A8A' },
  paused: { label: 'En pause', color: '#B45309' },
  ended: { label: 'Terminée', color: '#8A8A8A' },
};

/** « -20 % », « -5 000 GNF », « Livraison offerte » */
export function valueLabel(p: Pick<Promo, 'type' | 'valueType' | 'valeur'>): string {
  if (p.type === 'free-ship' || p.valueType === 'free') return 'Livraison offerte';
  if (p.valeur == null) return '—';
  return p.valueType === 'percent' ? `-${p.valeur} %` : `-${Math.round(p.valeur).toLocaleString('fr-FR')} GNF`;
}

/** « 1,5 M » / « 250 K » — comme le site. */
export function shortGnf(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} K`;
  return String(Math.round(n));
}
