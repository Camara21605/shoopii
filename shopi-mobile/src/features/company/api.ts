/**
 * Espace entreprise — mêmes adresses que le tableau de bord du site
 * (shopi-frontend/src/dashboards/entreprise) :
 *   GET /dashboard/entreprise/overview             Vue d'ensemble (KPIs, CA, top produits, alertes, activité)
 *   GET /dashboard/entreprise/parametres           identité de la boutique (nom, logo, statut, modèle)
 *   GET /dashboard/entreprise/parametres/apercu    position GPS de la boutique (bandeau « position non définie »)
 *   GET /company-team/my-permissions               propriétaire ou collaborateur + permissions
 *   GET /notifications/unread-by-type              pastilles du menu (commandes, avis, stock…)
 * Un collaborateur passe par actorId côté serveur : mêmes données que le propriétaire,
 * filtrées par ses permissions (403 sinon).
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const num = z.coerce.number().catch(0);

/* ── Vue d'ensemble ─────────────────────────────────────────────────── */

export const overviewSchema = z
  .object({
    zoneNom: z.string().catch('Boutique'),
    kpis: z
      .object({
        caCeMois: num,
        croissanceCA: num,
        commandesCeMois: num,
        commandesCroissance: num,
        enAttente: num,
        enCours: num,
        livrees: num,
        noteMoyenne: num,
        totalAvis: num,
        abonnes: num,
        retoursCeMois: num,
        retoursEnTraitement: num,
        retoursRembourses: num,
        beneficeNet: num,
        margePct: num,
        commissionCeMois: num,
      })
      .passthrough(),
    /** v = chiffre d'affaires du mois en MILLIONS de GNF (arrondi côté serveur). */
    caData: z.array(z.object({ m: z.string(), v: num })).catch([]),
    topProduits: z.array(z.object({ em: z.string().catch('📦'), nm: z.string().catch(''), ventes: num, ca: z.string().catch(''), trend: z.string().catch('neu') })).catch([]),
    categoryBreakdown: z.array(z.object({ label: z.string(), pct: num })).catch([]),
    dernieresCommandes: z
      .array(
        z.object({
          id: z.string(),
          uuid: z.string().optional(),
          em: z.string().catch('📦'),
          nm: z.string().catch(''),
          vt: z.string().catch(''),
          client: z.string().catch(''),
          price: num,
          status: z.string().catch('new'),
          date: z.string().catch(''),
        }),
      )
      .catch([]),
    stockAlertes: z.array(z.object({ em: z.string().catch('📦'), nm: z.string().catch(''), qty: num, min: num, type: z.string().catch('amber') })).catch([]),
    activite: z.array(z.object({ icon: z.string().catch('fa-box'), txt: z.string().catch(''), highlight: z.string().optional(), time: z.string().catch('') })).catch([]),
  })
  .passthrough();
export type Overview = z.infer<typeof overviewSchema>;

export const fetchOverview = () => apiFetch('/dashboard/entreprise/overview', { schema: overviewSchema });

/* ── Identité de la boutique ────────────────────────────────────────── */

export const identitySchema = z
  .object({
    id: z.string(),
    companyName: z.string().catch('Ma boutique'),
    logo: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    ville: z.string().nullable().optional(),
    businessModel: z.string().catch('products'),
  })
  .passthrough();
export type CompanyIdentity = z.infer<typeof identitySchema>;

export const fetchIdentity = () => apiFetch('/dashboard/entreprise/parametres', { schema: identitySchema });

/** true = la boutique n'a pas de position GPS (distance approximative pour les clients). */
export async function fetchMissingPosition() {
  const d = await apiFetch('/dashboard/entreprise/parametres/apercu', {
    schema: z.object({ latitude: z.unknown().optional(), longitude: z.unknown().optional() }).passthrough().nullable(),
  });
  return !!d && (d.latitude == null || d.longitude == null);
}

/* ── Permissions (équipe) ───────────────────────────────────────────── */

export const fetchPermissions = () =>
  apiFetch('/company-team/my-permissions', {
    schema: z.object({ isOwner: z.boolean().catch(false), permissions: z.record(z.string(), z.record(z.string(), z.boolean())).nullable().catch(null) }).passthrough(),
  });
export type Permissions = Awaited<ReturnType<typeof fetchPermissions>>;

/** Même règle que le site (useTeamPermissions) : le propriétaire peut tout ; sinon permission explicite. */
export function can(p: Permissions | undefined, group: string, action: string) {
  if (!p) return false;
  if (p.isOwner) return true;
  return !!p.permissions?.[group]?.[action];
}

/* ── Pastilles du menu ──────────────────────────────────────────────── */

/** Section du menu → types de notification réellement créés par le serveur (comme le site). */
export const BADGE_TYPES: Record<string, string[]> = {
  commandes: ['order.placed', 'order.cancelled', 'order.refunded', 'order.status_changed'],
  produits: ['product.liked'],
  inventaire: ['stock.low', 'stock.critical'],
  promotions: ['promo.active', 'promo.ending_soon', 'promo.ended', 'promo.used', 'promo.limit_reached'],
  finances: ['payment.received', 'payment.failed', 'payment.refund_done'],
  avis: ['review.received', 'review.replied'],
  retours: ['return.requested'],
  services: ['service.liked'],
};

export const fetchUnreadByType = () => apiFetch('/notifications/unread-by-type', { schema: z.record(z.string(), num).catch({}) });

export const badgeOf = (counts: Record<string, number> | undefined, section: string) =>
  (BADGE_TYPES[section] ?? []).reduce((s, t) => s + (counts?.[t] ?? 0), 0);
