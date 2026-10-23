/**
 * Analytics et SEO & Marketing de la boutique (espace entreprise) :
 *   GET /dashboard/entreprise/analytics → { caData, topProduits, categoryPerf, trafic }
 *   GET /dashboard/entreprise/marketing → score de visibilité, fiches, audience,
 *                                         plus vus, à améliorer, stories, promos, avis
 * Les deux exigent la permission statistics.view (403 sinon) et ne renvoient
 * que les données de la boutique connectée.
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const num = z.coerce.number().catch(0);
const numOrNull = z.coerce.number().nullable().optional().catch(null).transform((v) => v ?? null);

/* ── Analytics ─────────────────────────────────────────────── */

const analyticsSchema = z.object({
  caData: z.array(z.object({ m: z.string().catch(''), v: num })).catch([]),
  topProduits: z
    .array(z.object({ em: z.string().catch('📦'), nm: z.string().catch('—'), ventes: num, ca: z.string().catch(''), trend: z.enum(['up', 'dn', 'neu']).catch('neu') }))
    .catch([]),
  categoryPerf: z.array(z.object({ cat: z.string().catch('—'), ca: num, commandes: num })).catch([]),
  trafic: z
    .object({ vues: numOrNull, likes: num, favoris: numOrNull, commandes: num, conversion: numOrNull })
    .nullable()
    .optional()
    .catch(null),
});
export type Analytics = z.infer<typeof analyticsSchema>;

export const fetchAnalytics = () => apiFetch('/dashboard/entreprise/analytics', { schema: analyticsSchema });

/* ── SEO & Marketing ───────────────────────────────────────── */

export type FixTarget = 'boutique' | 'horaires' | 'catalogue' | 'avis';
export type FicheIssue = 'photo' | 'titreSeo' | 'descriptionSeo' | 'tags' | 'description';

const marketingSchema = z.object({
  businessModel: z.string().nullable().optional().catch(null),
  boutique: z.object({ id: z.string(), nom: z.string().catch('') }).nullable().optional().catch(null),
  visibilite: z
    .object({
      score: num,
      checks: z
        .array(z.object({ key: z.string(), label: z.string(), ok: z.boolean().catch(false), hint: z.string().catch(''), weight: num, fix: z.enum(['boutique', 'horaires', 'catalogue', 'avis']).catch('boutique') }))
        .catch([]),
    })
    .catch({ score: 0, checks: [] }),
  fiches: z
    .object({
      total: num, publics: num, brouillons: num, publicsSansPhoto: num, descriptionCourte: num,
      publicsSansTitreSeo: num, sansDescriptionSeo: num, sansTags: num, ruptures: numOrNull,
    })
    .catch({ total: 0, publics: 0, brouillons: 0, publicsSansPhoto: 0, descriptionCourte: 0, publicsSansTitreSeo: 0, sansDescriptionSeo: 0, sansTags: 0, ruptures: null }),
  audience: z
    .object({ vues: numOrNull, likes: num, favoris: numOrNull, abonnes: num })
    .catch({ vues: null, likes: 0, favoris: null, abonnes: 0 }),
  topVus: z.array(z.object({ id: z.string(), nom: z.string().catch('—'), vues: num, likes: num, image: z.string().nullable().catch(null) })).catch([]),
  aAmeliorer: z
    .array(z.object({ id: z.string(), nom: z.string().catch('—'), image: z.string().nullable().catch(null), issues: z.array(z.string()).catch([]) }))
    .catch([]),
  stories: z.object({ publiees: num, actives: num, vues: num, clics: num }).nullable().optional().catch(null),
  promotions: z.object({ actives: num, planifiees: num, utilisations: num, caGenere: num }).catch({ actives: 0, planifiees: 0, utilisations: 0, caGenere: 0 }),
  avis: z.object({ total: num, note: num, sansReponse: num }).catch({ total: 0, note: 0, sansReponse: 0 }),
});
export type Marketing = z.infer<typeof marketingSchema>;

export const fetchMarketing = () => apiFetch('/dashboard/entreprise/marketing', { schema: marketingSchema.nullable() });

export const ISSUE_LABEL: Record<FicheIssue, string> = {
  photo: 'Sans photo',
  titreSeo: 'Titre Google',
  descriptionSeo: 'Description Google',
  tags: 'Mots-clés',
  description: 'Description courte',
};

/** Couleur et appréciation du score de visibilité */
export function scoreTone(score: number): { color: string; bg: string; label: string } {
  if (score >= 80) return { color: '#15803D', bg: '#DCFCE7', label: 'Excellente visibilité' };
  if (score >= 55) return { color: '#B45309', bg: '#FEF3C7', label: 'Bonne base, à compléter' };
  return { color: '#B91C1C', bg: '#FEE2E2', label: 'Boutique peu visible' };
}

export const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');
