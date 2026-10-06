/**
 * Retours & SAV (espace entreprise) — mêmes routes que le site
 * (dashboards/entreprise/pages/RetoursPage.tsx, hooks/useRetours.ts, hooks/useSav.ts) :
 *
 * RETOURS  (returns.view pour lire, returns.process pour agir)
 *   GET   /dashboard/entreprise/returns/stats
 *   GET   /dashboard/entreprise/returns?status&reason&priority&search&page&limit&sortBy&sortOrder
 *   GET   /dashboard/entreprise/returns/:id           détail + historique + preuves
 *   PATCH …/:id/accept    { montantAccorde, noteClient? }   seulement « en attente »
 *   PATCH …/:id/refuse    { noteClient? }                   seulement « en attente »
 *   PATCH …/:id/received                                    seulement « en transit »
 *   PATCH …/:id/refund    { montantAccorde? }               « accepté » ou « reçu »
 *   POST  …/:id/notes     { content }                       note interne (équipe)
 *   PATCH …/:id/priority  { priority }
 * « Marquer reçu » et « changer la priorité » existent côté serveur mais pas
 * sur le site : l'application les propose.
 *
 * SAV
 *   GET   /dashboard/entreprise/sav/stats
 *   GET   /dashboard/entreprise/sav?status&priority&search&page&limit
 *   GET   /dashboard/entreprise/sav/:id               conversation (marque les messages lus)
 *   POST  …/:id/reply     { content }   (impossible sur un ticket fermé)
 *   PATCH …/:id/resolve · …/:id/close · …/:id/priority { priority }
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const num = z.coerce.number().catch(0);
const str = z.string().nullable().optional().catch(null);

export type ReturnStatus = 'pending' | 'accepted' | 'refused' | 'in_transit' | 'received' | 'refunded' | 'exchanged' | 'closed';
export type ReturnReason = 'defective' | 'not_matching' | 'change_of_mind' | 'wrong_item' | 'damaged' | 'expired' | 'other';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type SavStatus = 'open' | 'in_progress' | 'waiting_client' | 'resolved' | 'closed';

const status = z.enum(['pending', 'accepted', 'refused', 'in_transit', 'received', 'refunded', 'exchanged', 'closed']).catch('pending');
const reason = z.enum(['defective', 'not_matching', 'change_of_mind', 'wrong_item', 'damaged', 'expired', 'other']).catch('other');
const priority = z.enum(['low', 'normal', 'high', 'urgent']).catch('normal');

/* ── Retours ── */

const statsSchema = z
  .object({
    total: num,
    today: num,
    thisWeek: num,
    thisMonth: num,
    pending: num,
    accepted: num,
    refused: num,
    refunded: num,
    totalMontantRembourse: num,
    tauxAcceptation: num,
    delaiMoyenHeures: num,
    topMotifs: z.array(z.object({ reason, count: num, percentage: num })).catch([]),
  })
  .passthrough();
export type ReturnStats = z.infer<typeof statsSchema>;
export const fetchReturnStats = () => apiFetch('/dashboard/entreprise/returns/stats', { schema: statsSchema });

const summarySchema = z
  .object({
    id: z.string(),
    reference: z.string().catch('—'),
    productName: z.string().catch('Produit'),
    productImage: str,
    productVariant: str,
    quantity: num,
    reason,
    returnType: z.string().catch('refund'),
    status,
    priority,
    montantDemande: num,
    montantAccorde: z.coerce.number().nullable().optional().catch(null),
    evidenceCount: num,
    clientName: z.string().catch('Client'),
    clientAvatar: str,
    createdAt: z.string().catch(''),
  })
  .passthrough();
export type ReturnSummary = z.infer<typeof summarySchema>;

export type ReturnFilters = { search: string; status?: ReturnStatus; reason?: ReturnReason; priority?: Priority; sort: string };
export const PAGE_SIZE = 20;
const pageSchema = z.object({ data: z.array(summarySchema).catch([]), total: num, page: num, pages: num });

export const fetchReturns = (f: ReturnFilters, page: number) => {
  const [sortBy, sortOrder] = f.sort.split('_');
  return apiFetch('/dashboard/entreprise/returns', {
    query: { search: f.search || undefined, status: f.status, reason: f.reason, priority: f.priority, sortBy, sortOrder, page, limit: PAGE_SIZE },
    schema: pageSchema,
  });
};

const detailSchema = summarySchema.extend({
  description: z.string().catch(''),
  noteInterne: str,
  noteClient: str,
  acceptedAt: str,
  refusedAt: str,
  receivedAt: str,
  refundedAt: str,
  evidences: z
    .array(z.object({ id: z.string(), url: z.string().catch(''), type: z.string().catch('image'), filename: str, createdAt: z.string().catch('') }).passthrough())
    .catch([]),
  history: z
    .array(
      z
        .object({
          id: z.string(),
          action: z.string().catch(''),
          metadata: z.record(z.string(), z.unknown()).nullable().optional().catch(null),
          actorName: str,
          actorRole: z.string().catch(''),
          createdAt: z.string().catch(''),
        })
        .passthrough(),
    )
    .catch([]),
  commande: z.object({ id: z.string(), numero: z.string().catch('—'), total: num, createdAt: z.string().catch('') }).nullable().optional().catch(null),
});
export type ReturnDetail = z.infer<typeof detailSchema>;
export const fetchReturn = (id: string) => apiFetch(`/dashboard/entreprise/returns/${id}`, { schema: detailSchema });

const R = (id: string) => `/dashboard/entreprise/returns/${id}`;
export const acceptReturn = (id: string, montantAccorde: number, noteClient?: string) => apiFetch(`${R(id)}/accept`, { method: 'PATCH', body: { montantAccorde, ...(noteClient ? { noteClient } : {}) } });
export const refuseReturn = (id: string, noteClient?: string) => apiFetch(`${R(id)}/refuse`, { method: 'PATCH', body: noteClient ? { noteClient } : {} });
export const markReceived = (id: string) => apiFetch(`${R(id)}/received`, { method: 'PATCH' });
export const refundReturn = (id: string) => apiFetch(`${R(id)}/refund`, { method: 'PATCH', body: {} });
export const addReturnNote = (id: string, content: string) => apiFetch(`${R(id)}/notes`, { method: 'POST', body: { content } });
export const setReturnPriority = (id: string, p: Priority) => apiFetch(`${R(id)}/priority`, { method: 'PATCH', body: { priority: p } });

/* ── SAV ── */

const savStatsSchema = z.object({ total: num, open: num, inProgress: num, waitingClient: num, resolved: num, closed: num, avgResponseMinutes: num }).passthrough();
export type SavStats = z.infer<typeof savStatsSchema>;
export const fetchSavStats = () => apiFetch('/dashboard/entreprise/sav/stats', { schema: savStatsSchema });

const savStatus = z.enum(['open', 'in_progress', 'waiting_client', 'resolved', 'closed']).catch('open');
const ticketSchema = z
  .object({
    id: z.string(),
    reference: z.string().catch('—'),
    subject: z.string().catch(''),
    status: savStatus,
    priority,
    messageCount: num,
    unreadCount: num,
    productName: str,
    clientName: z.string().catch('Client'),
    createdAt: z.string().catch(''),
    updatedAt: z.string().catch(''),
  })
  .passthrough();
export type SavTicket = z.infer<typeof ticketSchema>;
export type SavFilters = { search: string; status?: SavStatus; priority?: Priority };
export const fetchTickets = (f: SavFilters, page: number) =>
  apiFetch('/dashboard/entreprise/sav', {
    query: { search: f.search || undefined, status: f.status, priority: f.priority, page, limit: PAGE_SIZE },
    schema: z.object({ data: z.array(ticketSchema).catch([]), total: num, page: num, pages: num }),
  });

const messageSchema = z
  .object({
    id: z.string(),
    content: z.string().catch(''),
    senderRole: z.string().catch('client'),
    senderName: z.string().catch(''),
    senderAvatar: str,
    createdAt: z.string().catch(''),
  })
  .passthrough();
export type SavMessage = z.infer<typeof messageSchema>;
const ticketDetailSchema = ticketSchema.extend({
  firstMessage: z.string().catch(''),
  commandeId: str,
  commandeNumero: str,
  clientAvatar: str,
  messages: z.array(messageSchema).catch([]),
  resolvedAt: str,
  closedAt: str,
});
export type SavTicketDetail = z.infer<typeof ticketDetailSchema>;
export const fetchTicket = (id: string) => apiFetch(`/dashboard/entreprise/sav/${id}`, { schema: ticketDetailSchema });

const S = (id: string) => `/dashboard/entreprise/sav/${id}`;
export const replyTicket = (id: string, content: string) => apiFetch(`${S(id)}/reply`, { method: 'POST', body: { content }, schema: messageSchema });
export const resolveTicket = (id: string) => apiFetch(`${S(id)}/resolve`, { method: 'PATCH' });
export const closeTicket = (id: string) => apiFetch(`${S(id)}/close`, { method: 'PATCH' });
export const setTicketPriority = (id: string, p: Priority) => apiFetch(`${S(id)}/priority`, { method: 'PATCH', body: { priority: p } });

/* ── Libellés (mêmes textes que le site, locales/fr/entreprise/retours.json) ── */

type Tone = { label: string; color: string; bg: string };
export const STATUS: Record<ReturnStatus, Tone> = {
  pending: { label: '⏳ En attente', color: '#B45309', bg: '#FEF3E2' },
  accepted: { label: '✓ Accepté', color: '#0F7B45', bg: '#E7F6EE' },
  refused: { label: '✕ Refusé', color: '#B42318', bg: '#FDECEC' },
  in_transit: { label: '🚚 En transit', color: '#0F766E', bg: '#E6F6F4' },
  received: { label: '📦 Reçu', color: '#4B5563', bg: '#F1F2F4' },
  refunded: { label: '💸 Remboursé', color: '#6D28D9', bg: '#F1EBFE' },
  exchanged: { label: '🔁 Échangé', color: '#0F766E', bg: '#E6F6F4' },
  closed: { label: 'Fermé', color: '#6B6B6B', bg: '#F2F2F2' },
};
export const REASONS: Record<ReturnReason, string> = {
  defective: 'Produit défectueux',
  not_matching: 'Ne correspond pas',
  change_of_mind: 'Changement d’avis',
  wrong_item: 'Mauvais article reçu',
  damaged: 'Endommagé',
  expired: 'Produit périmé',
  other: 'Autre motif',
};
export const RETURN_TYPES: Record<string, string> = { refund: 'Remboursement', exchange: 'Échange', repair: 'Réparation', credit: 'Avoir' };
export const PRIORITIES: Record<Priority, Tone> = {
  low: { label: 'Basse', color: '#4B5563', bg: '#F1F2F4' },
  normal: { label: 'Normal', color: '#0F766E', bg: '#E6F6F4' },
  high: { label: 'Haute', color: '#B45309', bg: '#FEF3E2' },
  urgent: { label: '🔴 Urgent', color: '#B42318', bg: '#FDECEC' },
};
export const SAV_STATUS: Record<SavStatus, Tone> = {
  open: { label: '🟢 Ouvert', color: '#0F7B45', bg: '#E7F6EE' },
  in_progress: { label: '🔵 En cours', color: '#0F766E', bg: '#E6F6F4' },
  waiting_client: { label: '🟡 Attente client', color: '#B45309', bg: '#FEF3E2' },
  resolved: { label: '✓ Résolu', color: '#6D28D9', bg: '#F1EBFE' },
  closed: { label: 'Fermé', color: '#6B6B6B', bg: '#F2F2F2' },
};
export const SORTS = [
  { value: 'createdAt_DESC', label: 'Plus récents' },
  { value: 'createdAt_ASC', label: 'Plus anciens' },
  { value: 'montantDemande_DESC', label: 'Montant ↓' },
  { value: 'montantDemande_ASC', label: 'Montant ↑' },
  { value: 'status_ASC', label: 'Statut A→Z' },
];

const ACTIONS: Record<string, string> = {
  created: 'Demande de retour créée',
  accepted: 'Retour accepté',
  refused: 'Retour refusé',
  refunded: 'Remboursement effectué',
  received: 'Retour reçu',
  note_added: 'Note interne ajoutée',
  evidence_uploaded: 'Preuve ajoutée',
  priority_changed: 'Priorité modifiée',
};
export const actionLabel = (a: string) => ACTIONS[a] ?? a;

/** Détail lisible d'une entrée d'historique (le site affiche le JSON brut). */
export function describeMetadata(m?: Record<string, unknown> | null) {
  if (!m) return null;
  const parts: string[] = [];
  const money = (v: unknown) => `${Math.round(Number(v)).toLocaleString('fr-FR')} GNF`;
  if (m.montantAccorde != null) parts.push(`Montant accordé : ${money(m.montantAccorde)}`);
  if (m.montant != null) parts.push(`Montant : ${money(m.montant)}`);
  if (typeof m.priority === 'string') parts.push(`Priorité : ${PRIORITIES[m.priority as Priority]?.label ?? m.priority}`);
  if (typeof m.from === 'string' && typeof m.to === 'string') parts.push(`${PRIORITIES[m.from as Priority]?.label ?? m.from} → ${PRIORITIES[m.to as Priority]?.label ?? m.to}`);
  if (typeof m.noteClient === 'string' && m.noteClient) parts.push(`Message au client : « ${m.noteClient} »`);
  if (typeof m.content === 'string' && m.content) parts.push(`« ${m.content} »`);
  return parts.length ? parts.join('\n') : null;
}

export const ROLE_LABELS: Record<string, string> = { enterprise: 'Boutique', client: 'Client', admin: 'Shoneya', system: 'Système' };

/* ── Formats ── */
export const gnf = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} GNF`;
export function short(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}
export const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
};
export const formatDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
};
export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
/** Délai moyen de réponse SAV : « 45 min », « 3 h 10 », « 2 j ». */
export function duration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${String(minutes % 60).padStart(2, '0')}` : ''}`;
  return `${Math.round(minutes / 1440)} j`;
}
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
