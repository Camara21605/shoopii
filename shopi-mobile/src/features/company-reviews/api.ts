/**
 * Avis clients de la boutique (espace entreprise) — mêmes routes que le site
 * (dashboards/entreprise/pages/AvisPage.tsx, services/avisApi.ts) :
 *   GET  /dashboard/entreprise/avis               { avis, stats: { moyenne, total, distribution (%), tauxReponse } }
 *   POST /dashboard/entreprise/avis/:id/reponse   { reponse } (2 à 1000 caractères) — répondre ou
 *                                                 modifier sa réponse ; messaging.send ; le client est notifié
 * Signaler un avis : le site affiche seulement « Avis signalé » sans rien
 * envoyer. Ici, le signalement part VRAIMENT à la modération, sous forme de
 * ticket du centre d'aide (POST /support/client/tickets, type « fraud »,
 * relié à la commande de l'avis).
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const reviewSchema = z
  .object({
    id: z.string(),
    clientNom: z.string().catch('Client'),
    clientInitiales: z.string().nullable().optional().catch(null),
    produitNom: z.string().catch('—'),
    note: z.coerce.number().catch(0),
    commentaire: z.string().nullable().catch('').transform((v) => v ?? ''),
    date: z.string().catch(''),
    reponse: z.string().nullable().optional().catch(null),
    commandeId: z.string().nullable().optional().catch(null),
  })
  .passthrough();
export type Review = z.infer<typeof reviewSchema>;

const responseSchema = z.object({
  avis: z.array(reviewSchema).catch([]),
  stats: z
    .object({
      moyenne: z.coerce.number().catch(0),
      total: z.coerce.number().catch(0),
      distribution: z.record(z.string(), z.coerce.number()).catch({}),
      tauxReponse: z.coerce.number().optional().catch(undefined),
    })
    .catch({ moyenne: 0, total: 0, distribution: {} }),
});
export type ReviewsData = z.infer<typeof responseSchema>;

export const fetchReviews = () => apiFetch('/dashboard/entreprise/avis', { schema: responseSchema });

export const replyToReview = (id: string, reponse: string) =>
  apiFetch(`/dashboard/entreprise/avis/${id}/reponse`, { method: 'POST', body: { reponse } });

export const REPORT_REASONS = [
  { value: 'faux', label: 'Faux avis' },
  { value: 'injurieux', label: 'Propos injurieux' },
  { value: 'hors-sujet', label: 'Hors sujet' },
  { value: 'autre', label: 'Autre' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['value'];

/** Envoie le signalement à la modération (ticket support relié à la commande). */
export function reportReview(r: Review, reason: ReportReason, details: string) {
  const label = REPORT_REASONS.find((x) => x.value === reason)?.label ?? reason;
  const lines = [
    `Signalement d'un avis client — motif : ${label}.`,
    '',
    `Avis de ${r.clientNom} (${r.note}/5) du ${r.date} sur « ${r.produitNom} » :`,
    r.commentaire ? `« ${r.commentaire} »` : '(sans commentaire)',
    `Identifiant de l'avis : ${r.id}`,
  ];
  if (details.trim()) lines.push('', `Précisions de la boutique : ${details.trim()}`);
  return apiFetch('/support/client/tickets', {
    method: 'POST',
    body: {
      type: 'fraud',
      subject: `Signalement d'un avis client (${label})`,
      firstMessage: lines.join('\n').slice(0, 5000),
      ...(r.commandeId ? { relatedOrderId: r.commandeId } : {}),
    },
  });
}

export const initialsOf = (r: Review) =>
  r.clientInitiales ||
  r.clientNom
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') ||
  '?';
