/**
 * Espace livreur — mêmes routes que le site (dashboards/livreur/services/*) :
 *   GET   /dashboard/livreur/parametres/me         nom + photo (en-tête)
 *   GET   /dashboard/livreur/stats                 livraisons, gains, note, statut, livraisons du mois, boutiques
 *   GET   /dashboard/livreur/missions              { active, recent, nbActives } (pastille « En cours »)
 *   GET   /dashboard/livreur/missions/disponibles  missions diffusées par SON entreprise (pas encore prises)
 *   PATCH /dashboard/livreur/missions/:id/accepter    (409 si un autre livreur l'a prise avant)
 *   GET   /dashboard/livreur/activite              15 dernières notifications
 *   GET   /dashboard/livreur/revenus               taux, total, ce mois, dernières transactions
 *   GET   /dashboard/livreur/revenus/chart?period  semaine | mois
 *   GET   /dashboard/livreur/boutiques             boutiques livrées + répartition
 *   GET   /dashboard/livreur/avis  ·  POST …/avis/:id/reponse { reponse }
 *   GET   /livreur/missions                        commandes qui lui sont assignées (new / prep / active)
 *   PATCH /livreur/missions/:uuid/accepter         génère SON code de validation
 *   PATCH /livreur/missions/:uuid/refuser          { reason } (motif obligatoire)
 *   GET   /livreur/encours                         mission active (étapes, client, échéance) ou null
 *   GET   /livreur/historique                      livrées / incidents / annulées
 *   GET   /commandes/:uuid  ·  POST /commandes/:uuid/valider { role: 'livreur', code }
 * Le serveur renvoie encore dist = « — », speed = « std », urgent = false pour
 * toutes les missions : les filtres du site « Express / Urgentes / Proches »
 * ne trient donc rien ; l'application filtre par étape (nouvelles, acceptées,
 * en route), ce que le serveur renseigne réellement.
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const num = z.coerce.number().catch(0);
const str = z.string().nullable().optional().catch(null);

/* ── Identité & chiffres ── */

export const fetchMe = () => apiFetch('/dashboard/livreur/parametres/me', { schema: z.object({ photoUrl: str, fullName: z.string().catch('') }).passthrough() });

const statsSchema = z
  .object({
    totalDeliveries: num,
    totalEarnings: num,
    averageRating: z.coerce.number().nullable().optional().catch(null),
    status: z.string().catch(''),
    verificationStatus: z.string().catch(''),
    deliveriesThisMonth: num,
    boutiquesAbonnees: num,
  })
  .passthrough();
export type LivreurStats = z.infer<typeof statsSchema>;
export const fetchStats = () => apiFetch('/dashboard/livreur/stats', { schema: statsSchema });

export const fetchActiveCount = () =>
  apiFetch('/dashboard/livreur/missions', { schema: z.object({ nbActives: num }).passthrough().catch({ nbActives: 0 }) }).then((r) => r.nbActives);

const revenusSchema = z.object({
  tauxCommission: num,
  totalRevenus: num,
  revenusThisMonth: num,
  transactions: z.array(z.object({ id: z.string(), source: z.string().catch('Livraison'), montant: num, date: z.string().catch(''), statut: z.string().catch('') })).catch([]),
});
export type Revenus = z.infer<typeof revenusSchema>;
export const fetchRevenus = () => apiFetch('/dashboard/livreur/revenus', { schema: revenusSchema });

export type ChartPeriod = 'semaine' | 'mois';
export const fetchRevenusChart = (period: ChartPeriod) =>
  apiFetch('/dashboard/livreur/revenus/chart', { query: { period }, schema: z.array(z.object({ j: z.string().catch(''), v: num, today: z.boolean().optional().catch(false) })).catch([]) });

const activitySchema = z.array(z.object({ id: z.string(), type: z.string().catch(''), title: z.string().catch(''), body: z.string().nullable().optional().catch(null), isRead: z.boolean().catch(true), createdAt: z.string().catch('') })).catch([]);
export type Activity = z.infer<typeof activitySchema>[number];
export const fetchActivity = () => apiFetch('/dashboard/livreur/activite', { schema: activitySchema });

/* ── Missions assignées ── */

export type MissionStatus = 'new' | 'prep' | 'active' | 'done';
const missionSchema = z
  .object({
    id: z.string().catch(''),
    uuid: z.string(),
    nm: z.string().catch('—'),
    shop: z.string().catch('Boutique'),
    client: z.string().catch('—'),
    from: z.string().catch(''),
    to: z.string().catch(''),
    dist: z.string().catch('—'),
    fee: num,
    speed: z.string().catch('std'),
    status: z.enum(['new', 'prep', 'active', 'done']).catch('new'),
    urgent: z.boolean().catch(false),
    date: z.string().catch(''),
    companyAdresse: str,
    companyRepere: str,
    companyTelephone: str,
    companyVille: str,
    companyQuartier: str,
    clientVille: str,
    clientCommune: str,
    /* Adresse de livraison figée dans la commande (référentiel + repère + consignes) */
    clientQuartier: str,
    clientAdresse: str,
    clientInstructions: str,
    clientTelephone: str,
    clientGpsExact: z.boolean().catch(false),
    /* Carte « Ma zone de livraison » : position réelle de la boutique et du client (adresse GPS par défaut) */
    companyLat: z.coerce.number().nullable().optional().catch(null),
    companyLng: z.coerce.number().nullable().optional().catch(null),
    clientLat: z.coerce.number().nullable().optional().catch(null),
    clientLng: z.coerce.number().nullable().optional().catch(null),
    companyPays: str,
  })
  .passthrough();
export type Mission = z.infer<typeof missionSchema>;
export const fetchMissions = () => apiFetch('/livreur/missions', { schema: z.array(missionSchema).catch([]) });
export const acceptMission = (uuid: string) => apiFetch(`/livreur/missions/${uuid}/accepter`, { method: 'PATCH' });
export const refuseMission = (uuid: string, reason: string) => apiFetch(`/livreur/missions/${uuid}/refuser`, { method: 'PATCH', body: { reason } });

/* ── Missions diffusées par l'entreprise ── */

const dispoSchema = z.array(z.object({ id: z.string(), title: z.string().catch('Mission'), description: str, zone: str, reward: z.coerce.number().nullable().optional().catch(null), urgent: z.boolean().catch(false), createdAt: z.string().catch('') })).catch([]);
export type Dispo = z.infer<typeof dispoSchema>[number];
export const fetchDispos = () => apiFetch('/dashboard/livreur/missions/disponibles', { schema: dispoSchema });
export const acceptDispo = (id: string) => apiFetch(`/dashboard/livreur/missions/${id}/accepter`, { method: 'PATCH' });

/* ── Mission en cours ── */

const stepSchema = z.object({ role: z.string().catch(''), label: z.string().catch(''), sub: z.string().catch(''), status: z.enum(['done', 'active', 'next']).catch('next'), time: str });
const encoursSchema = z
  .object({
    id: z.string().catch(''),
    uuid: z.string(),
    nm: z.string().catch('—'),
    shop: z.string().catch('Boutique'),
    fee: num,
    client: z.object({
      nom: z.string().catch('Client'),
      telephone: str,
      adresse: z.string().catch('—'),
      instructions: str,
      rue: str,
      quartier: str,
      commune: str,
      ville: str,
      latitude: z.coerce.number().nullable().optional().catch(null),
      longitude: z.coerce.number().nullable().optional().catch(null),
    }),
    steps: z.array(stepSchema).catch([]),
    etaAt: str,
  })
  .passthrough();
export type EnCours = z.infer<typeof encoursSchema>;
export const fetchEnCours = () => apiFetch('/livreur/encours', { schema: encoursSchema.nullable().catch(null) });

/* ── Historique ── */

const histSchema = z.array(z.object({ id: z.string().catch(''), uuid: z.string(), nm: z.string().catch('—'), shop: z.string().catch(''), fee: num, status: z.enum(['done', 'iss', 'can']).catch('done'), date: z.string().catch(''), earn: z.boolean().catch(false) }).passthrough()).catch([]);
export type HistItem = z.infer<typeof histSchema>[number];
export const fetchHistory = () => apiFetch('/livreur/historique', { schema: histSchema });

/* ── Boutiques ── */

const boutiquesSchema = z.object({
  items: z.array(z.object({ id: z.string(), nm: z.string().catch('Boutique'), em: z.string().catch('🏪'), logo: str, cat: z.string().catch(''), rat: num, delivs: num, pending: num, since: z.string().catch('') }).passthrough()).catch([]),
  totalDeliveries: num,
});
export type Boutiques = z.infer<typeof boutiquesSchema>;
export const fetchBoutiques = () => apiFetch('/dashboard/livreur/boutiques', { schema: boutiquesSchema });

/* ── Avis ── */

const avisSchema = z.object({
  avis: z.array(z.object({ id: z.string(), clientNom: z.string().catch('Client'), clientInitiales: str, commandeRef: z.string().catch(''), note: num, commentaire: z.string().nullable().catch('').transform((v) => v ?? ''), date: z.string().catch(''), reponse: str, commandeId: str }).passthrough()).catch([]),
  /* tauxReponse : % d'avis ayant une réponse (calculé par le serveur, non affiché par le site) */
  stats: z.object({ moyenne: num, total: num, distribution: z.record(z.string(), z.coerce.number()).catch({}), tauxReponse: z.coerce.number().optional().catch(undefined) }).catch({ moyenne: 0, total: 0, distribution: {}, tauxReponse: undefined }),
});
export type AvisData = z.infer<typeof avisSchema>;
export type Avis = AvisData['avis'][number];
export const fetchAvis = () => apiFetch('/dashboard/livreur/avis', { schema: avisSchema });
export const replyAvis = (id: string, reponse: string) => apiFetch(`/dashboard/livreur/avis/${id}/reponse`, { method: 'POST', body: { reponse } });

/* ── Validation de SON étape (code livreur) ── */

export const validateLivreurStep = (uuid: string, code: string) => apiFetch(`/commandes/${uuid}/valider`, { method: 'POST', body: { role: 'livreur', code: code.trim().toUpperCase() } });

/* ── Formats & libellés ── */

export const gnf = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} GNF`;
export function short(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}
export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '🛵';

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'À l’instant';
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h} h`;
  return `Il y a ${Math.floor(h / 24)} j`;
}

export const MISSION_STATUS: Record<MissionStatus, { label: string; color: string; bg: string }> = {
  new: { label: 'Nouvelle', color: '#B45309', bg: '#FEF3E2' },
  prep: { label: 'Acceptée — à récupérer', color: '#0F766E', bg: '#E6F6F4' },
  active: { label: 'En route', color: '#6D28D9', bg: '#F1EBFE' },
  done: { label: 'Livrée', color: '#0F7B45', bg: '#E7F6EE' },
};

export const HIST_STATUS: Record<HistItem['status'], { label: string; color: string; bg: string }> = {
  done: { label: 'Livrée', color: '#0F7B45', bg: '#E7F6EE' },
  iss: { label: 'Incident', color: '#B45309', bg: '#FEF3E2' },
  can: { label: 'Annulée', color: '#B42318', bg: '#FDECEC' },
};

export const REFUSE_REASONS = ['Trop loin', 'Indisponible', 'Hors de ma zone', 'Autre'] as const;

export const REVENUE_STATUS: Record<string, { label: string; color: string }> = {
  released: { label: 'Versé', color: '#0F7B45' },
  escrow: { label: 'En attente de livraison', color: '#B45309' },
  cancelled: { label: 'Annulé', color: '#B42318' },
  refunded: { label: 'Remboursé', color: '#4B5563' },
};

/** Icône d'une notification d'activité (même logique que le site). */
export function activityIcon(type: string): 'bicycle-outline' | 'cash-outline' | 'star-outline' | 'cube-outline' | 'chatbubble-outline' | 'person-outline' | 'notifications-outline' {
  if (type.startsWith('delivery.') || type.startsWith('colis.')) return 'bicycle-outline';
  if (type.startsWith('payment.')) return 'cash-outline';
  if (type.startsWith('review.')) return 'star-outline';
  if (type.startsWith('order.')) return 'cube-outline';
  if (type.startsWith('message.')) return 'chatbubble-outline';
  if (type.startsWith('account.') || type.startsWith('follow.')) return 'person-outline';
  return 'notifications-outline';
}
