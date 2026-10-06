/**
 * Clients de la boutique (espace entreprise) — mêmes routes que le site
 * (dashboards/entreprise/pages/ClientsPage.tsx, ClientProfilModal.tsx, CrmCampaignModal.tsx) :
 *   GET  /dashboard/entreprise/clients                     liste paginée + stats
 *        ?search&segment&source&page&limit&sortBy&sortOrder
 *   GET  /dashboard/entreprise/clients/:id                 profil + 10 dernières commandes
 *   GET  /dashboard/entreprise/clients/crm/:type/preview   aperçu d'une campagne (n'envoie rien)
 *   POST /dashboard/entreprise/clients/crm/:type/send      { subject, message } — messaging.send,
 *                                                          5 envois / heure maximum
 *   GET  /dashboard/entreprise/clients/rapport/pdf         rapport PDF des segments
 *
 * Deux sources fusionnées côté serveur : les ACHETEURS (≥ 1 commande livrée
 * dans la boutique) et les ABONNÉS (suivent la boutique). Segments calculés par
 * le serveur : VIP (≥ 10 M GNF ou ≥ 10 commandes), Fidèle (≥ 5), Régulier (≥ 2),
 * Nouveau (1), Abonné (aucun achat).
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const num = z.coerce.number().catch(0);
const str = z.string().nullable().optional().catch(null);

export type Segment = 'VIP' | 'Fidèle' | 'Régulier' | 'Nouveau' | 'Abonné';
export type Source = 'all' | 'buyers' | 'abonnes';
export type SortKey = 'totalSpent' | 'totalOrders' | 'lastOrderAt' | 'createdAt';
export type CrmType = 'newsletter' | 'fidelite' | 'relance';

const segment = z.enum(['VIP', 'Fidèle', 'Régulier', 'Nouveau', 'Abonné']).catch('Abonné');

const clientSchema = z
  .object({
    id: z.string(),
    userId: z.string().catch(''),
    fullName: z.string().catch('Client'),
    email: z.string().catch('—'),
    profilePicture: str,
    totalOrders: num,
    totalSpent: num,
    lastOrderAt: str,
    isSuivi: z.boolean().catch(false),
    segment,
    createdAt: z.string().catch(''),
  })
  .passthrough();
export type ClientRow = z.infer<typeof clientSchema>;

const statsSchema = z.object({
  total: num,
  buyers: num,
  abonnes: num,
  vip: num,
  fideles: num,
  reguliers: num,
  nouveaux: num,
  caTotal: num,
  panierMoyen: num,
});
export type ClientsStats = z.infer<typeof statsSchema>;

const pageSchema = z.object({
  data: z.array(clientSchema).catch([]),
  total: num,
  page: num,
  pages: num,
  stats: statsSchema.catch({ total: 0, buyers: 0, abonnes: 0, vip: 0, fideles: 0, reguliers: 0, nouveaux: 0, caTotal: 0, panierMoyen: 0 }),
});
export type ClientsPage = z.infer<typeof pageSchema>;

export type ClientsFilters = { search: string; segment: Segment | 'all'; source: Source; sortBy: SortKey };
export const PAGE_SIZE = 20;

export const fetchClients = (f: ClientsFilters, page: number) =>
  apiFetch('/dashboard/entreprise/clients', {
    query: {
      search: f.search || undefined,
      segment: f.segment === 'all' ? undefined : f.segment,
      source: f.source === 'all' ? undefined : f.source,
      sortBy: f.sortBy,
      sortOrder: 'DESC',
      page,
      limit: PAGE_SIZE,
    },
    schema: pageSchema,
  });

const orderSchema = z
  .object({
    id: z.string(),
    numero: z.string().catch('—'),
    status: z.string().catch(''),
    total: num,
    sousTotal: num,
    fraisLivraison: num,
    modeLivraison: z.string().nullable().catch(''),
    createdAt: z.string().catch(''),
    livraisonEffective: str,
  })
  .passthrough();
export type ClientOrder = z.infer<typeof orderSchema>;

const detailSchema = z
  .object({
    id: z.string(),
    userId: z.string().catch(''),
    fullName: z.string().catch('Client'),
    email: z.string().catch('—'),
    phone: str,
    profilePicture: str,
    membreDepuis: z.string().catch(''),
    totalOrders: num,
    totalSpent: num,
    lastOrderAt: str,
    segment,
    isSuivi: z.boolean().catch(false),
    commandes: z.array(orderSchema).catch([]),
  })
  .passthrough();
export type ClientDetail = z.infer<typeof detailSchema>;
export const fetchClient = (id: string) => apiFetch(`/dashboard/entreprise/clients/${id}`, { schema: detailSchema });

/* ── Actions CRM ── */

const previewSchema = z.object({
  count: num,
  sample: z.array(z.object({ fullName: z.string().catch(''), email: z.string().catch('') })).catch([]),
  suggestedSubject: z.string().catch(''),
  suggestedMessage: z.string().catch(''),
});
export type CrmPreview = z.infer<typeof previewSchema>;
export const fetchCrmPreview = (type: CrmType) => apiFetch(`/dashboard/entreprise/clients/crm/${type}/preview`, { schema: previewSchema });
export const sendCrm = (type: CrmType, subject: string, message: string) =>
  apiFetch(`/dashboard/entreprise/clients/crm/${type}/send`, {
    method: 'POST',
    body: { subject, message },
    schema: z.object({ sent: num, failed: num, total: num }),
  });

export const CRM: Record<CrmType, { title: string; icon: 'mail-outline' | 'gift-outline' | 'notifications-outline'; text: string }> = {
  newsletter: { title: 'Envoyer newsletter VIP', icon: 'mail-outline', text: 'Un message à vos meilleurs clients' },
  fidelite: { title: 'Offre fidélité automatique', icon: 'gift-outline', text: 'Récompensez vos clients fidèles' },
  relance: { title: 'Relance clients inactifs', icon: 'notifications-outline', text: 'Faites revenir ceux qui n’achètent plus' },
};

/* ── Libellés (mêmes textes que le site, locales/fr/entreprise/clients.json, clientProfil.json) ── */

export const SEGMENTS: Record<Segment, { label: string; emoji: string; color: string; bg: string }> = {
  VIP: { label: 'VIP', emoji: '👑', color: '#6D28D9', bg: '#F1EBFE' },
  Fidèle: { label: 'Fidèle', emoji: '⭐', color: '#B45309', bg: '#FEF3E2' },
  Régulier: { label: 'Régulier', emoji: '🔄', color: '#0F766E', bg: '#E6F6F4' },
  Nouveau: { label: 'Nouveau', emoji: '🆕', color: '#0F7B45', bg: '#E7F6EE' },
  Abonné: { label: 'Abonné', emoji: '👁️', color: '#4B5563', bg: '#F1F2F4' },
};

export const SEGMENT_FILTERS: { value: Segment | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous segments' },
  { value: 'VIP', label: '👑 VIP' },
  { value: 'Fidèle', label: '⭐ Fidèles' },
  { value: 'Régulier', label: '🔄 Réguliers' },
  { value: 'Nouveau', label: '🆕 Nouveaux' },
  { value: 'Abonné', label: '👁️ Abonnés' },
];

export const SOURCE_FILTERS: { value: Source; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'buyers', label: '🛒 Acheteurs' },
  { value: 'abonnes', label: '👁️ Abonnés' },
];

export const SORTS: { value: SortKey; label: string }[] = [
  { value: 'totalSpent', label: 'Plus dépensé' },
  { value: 'totalOrders', label: 'Plus de commandes' },
  { value: 'lastOrderAt', label: 'Dernière commande' },
  { value: 'createdAt', label: 'Plus récents' },
];

export const ORDER_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'En attente', color: '#6B6B6B', bg: '#F2F2F2' },
  paid: { label: 'Payée', color: '#0F766E', bg: '#E6F6F4' },
  in_progress: { label: 'En cours', color: '#B45309', bg: '#FEF3E2' },
  awaiting_client: { label: 'À confirmer', color: '#B45309', bg: '#FEF3E2' },
  delivered: { label: 'Livrée', color: '#0F7B45', bg: '#E7F6EE' },
  auto_delivered: { label: 'Livrée (auto)', color: '#0F7B45', bg: '#E7F6EE' },
  cancelled: { label: 'Annulée', color: '#B42318', bg: '#FDECEC' },
  refunded: { label: 'Remboursée', color: '#4B5563', bg: '#F1F2F4' },
  disputed: { label: 'Litige', color: '#B42318', bg: '#FDECEC' },
};
export const orderStatus = (s: string) => ORDER_STATUS[s] ?? { label: s || '—', color: '#6B6B6B', bg: '#F2F2F2' };

const MODES: Record<string, string> = {
  livreur: '🛵 Livreur',
  correspondant: '🤝 Correspondant',
  partenaire: '🤝 Partenaire',
  pickup: '🏪 Retrait boutique',
  mixte: '🔀 Mixte',
};
export const modeLabel = (m?: string | null) => (m ? (MODES[m] ?? m) : '—');

/* ── Formats ── */

/** Montant court comme le site : 1,2M · 350k · 900. */
export function short(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return n.toLocaleString('fr-FR');
}
export const gnf = (n: number) => `${short(n)} GNF`;
export const fullGnf = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} GNF`;

export function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** « Aujourd’hui », « Hier », « Il y a 3 j », « Il y a 2 sem », « Il y a 4 mois », sinon la date. */
export function relative(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (Number.isNaN(days)) return '—';
  if (days <= 0) return 'Aujourd’hui';
  if (days === 1) return 'Hier';
  if (days < 7) return `Il y a ${days} j`;
  if (days < 31) return `Il y a ${Math.floor(days / 7)} sem`;
  if (days < 365) return `Il y a ${Math.floor(days / 30)} mois`;
  return d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
}

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase() || '?';

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
