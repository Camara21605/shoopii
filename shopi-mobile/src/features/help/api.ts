/**
 * Centre d'aide & support — mêmes routes que le site :
 *   Aide (public)    GET /help/categories · /help/categories/:slug · /help/articles/:slug
 *                    GET /help/popular · /help/search?q= · /help/faq
 *                    POST /help/articles/:slug/feedback { helpful }
 *   Contact (public) POST /contact { name, email, subject, body, type }
 *   Support (compte connecté : client, entreprise, livreur, point relais)
 *                    GET/POST /support/client/tickets · GET /support/client/tickets/:id
 *                    POST …/:id/reply { content } · POST …/:id/rate { score }
 *                    POST …/:id/messages/:msgId/attachments (multipart « file »)
 *                    GET /support/suggest?query= (articles proposés pendant la saisie)
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const str = z.string().nullable().optional().catch(null);
const num = z.coerce.number().catch(0);

/* ── Aide ───────────────────────────────────────────────────────────── */

export const categorySchema = z
  .object({ id: z.string(), slug: z.string(), name: z.string().catch(''), description: str, icon: z.string().catch(''), articleCount: num })
  .passthrough();
export type HelpCategory = z.infer<typeof categorySchema>;

export const articleSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string().catch(''),
    excerpt: str,
    content: str,
    viewCount: num,
    publishedAt: z.string().catch(''),
    category: z.object({ name: z.string().catch(''), slug: z.string().catch(''), icon: z.string().catch('') }).nullable().optional().catch(null),
    helpfulCount: num,
    notHelpfulCount: num,
  })
  .passthrough();
export type HelpArticle = z.infer<typeof articleSchema>;

export const faqSchema = z.object({ id: z.string(), question: z.string().catch(''), answer: z.string().catch('') }).passthrough();
export type HelpFaq = z.infer<typeof faqSchema>;

export const fetchCategories = () => apiFetch('/help/categories', { auth: false, schema: z.array(categorySchema).catch([]) });
export const fetchCategory = (slug: string) =>
  apiFetch(`/help/categories/${encodeURIComponent(slug)}`, { auth: false, schema: categorySchema.extend({ articles: z.array(articleSchema).catch([]) }) });
export const fetchArticle = (slug: string) => apiFetch(`/help/articles/${encodeURIComponent(slug)}`, { auth: false, schema: articleSchema });
export const fetchPopular = () => apiFetch('/help/popular', { auth: false, query: { limit: 6 }, schema: z.array(articleSchema).catch([]) });
export const fetchFaq = () =>
  apiFetch('/help/faq', { auth: false, schema: z.array(z.object({ slug: z.string().catch(''), faqs: z.array(faqSchema).catch([]) })).catch([]) });
export const sendFeedback = (slug: string, helpful: boolean) =>
  apiFetch(`/help/articles/${encodeURIComponent(slug)}/feedback`, { method: 'POST', auth: false, body: { helpful } });

export const searchResultSchema = z
  .object({ id: z.string(), slug: z.string(), title: z.string().catch(''), excerpt: str, viewCount: num, categoryName: str, categorySlug: str })
  .passthrough();
export type HelpSearchResult = z.infer<typeof searchResultSchema>;
export const searchHelp = (q: string) =>
  apiFetch('/help/search', { auth: false, query: { q, page: 1, limit: 20 }, schema: z.object({ data: z.array(searchResultSchema).catch([]), total: num }) });

/* ── Contact ────────────────────────────────────────────────────────── */

export const CONTACT_TYPES = [
  { value: 'general', label: 'Question générale', desc: 'Toute autre demande', icon: 'help-circle-outline' },
  { value: 'billing', label: 'Facturation', desc: 'Paiements, factures', icon: 'card-outline' },
  { value: 'security', label: 'Sécurité', desc: 'Fraude, compte compromis', icon: 'shield-half-outline' },
  { value: 'partnership', label: 'Partenariat', desc: 'Collaboration, B2B', icon: 'people-outline' },
  { value: 'press', label: 'Presse', desc: 'Médias, relations presse', icon: 'newspaper-outline' },
  { value: 'other', label: 'Autre', desc: 'Autre demande', icon: 'ellipsis-horizontal' },
] as const;

export const sendContact = (body: { name: string; email: string; subject: string; body: string; type: string }) =>
  apiFetch('/contact', { method: 'POST', auth: false, body, schema: z.object({ id: z.string().optional(), reference: z.string().catch('') }).passthrough() });

/* ── Support (tickets) ──────────────────────────────────────────────── */

export const TICKET_TYPES = [
  { value: 'general', label: 'Question générale', desc: 'Toute question sur Shoneya', icon: 'help-circle-outline' },
  { value: 'billing', label: 'Facturation', desc: 'Paiements, factures, remboursements', icon: 'card-outline' },
  { value: 'order_platform', label: 'Commande', desc: 'Suivi, livraison, retour colis', icon: 'cube-outline' },
  { value: 'account', label: 'Compte / Accès', desc: 'Connexion, vérification, sécurité', icon: 'person-circle-outline' },
  { value: 'fraud', label: 'Fraude / Sécurité', desc: 'Signalement fraude, compte compromis', icon: 'shield-half-outline' },
  { value: 'technical', label: 'Problème technique', desc: 'Bug, erreur, fonctionnalité défaillante', icon: 'construct-outline' },
  { value: 'feedback', label: 'Suggestion', desc: 'Amélioration ou retour d’expérience', icon: 'bulb-outline' },
] as const;
export const TYPE_LABEL: Record<string, string> = {
  general: 'Question générale',
  billing: 'Facturation',
  order_platform: 'Commande / Livraison',
  account: 'Compte / Accès',
  fraud: 'Fraude / Sécurité',
  technical: 'Problème technique',
  feedback: 'Suggestion / Avis',
};

export const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Ouvert', color: '#1F1F1F', bg: 'rgba(0,0,0,0.06)' },
  in_progress: { label: 'En cours', color: '#B45309', bg: '#FFF7E6' },
  waiting_user: { label: 'Votre réponse attendue', color: '#B91C1C', bg: '#FEF2F2' },
  resolved: { label: 'Résolu', color: '#047857', bg: '#ECFDF5' },
  closed: { label: 'Fermé', color: '#6B6B6B', bg: '#F5F5F5' },
};
export const TICKET_FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'open', label: 'Ouverts' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'waiting_user', label: 'En attente' },
  { value: 'resolved', label: 'Résolus' },
  { value: 'closed', label: 'Fermés' },
] as const;

export const ticketSchema = z
  .object({
    id: z.string(),
    reference: z.string().catch(''),
    type: z.string().catch('general'),
    subject: z.string().catch(''),
    status: z.string().catch('open'),
    priority: z.string().catch('normal'),
    messageCount: num,
    unreadByUser: num,
    createdAt: z.string().catch(''),
    updatedAt: z.string().catch(''),
  })
  .passthrough();
export type Ticket = z.infer<typeof ticketSchema>;

export const attachmentSchema = z
  .object({ id: z.string(), originalFilename: z.string().catch('Fichier'), mimeType: z.string().catch(''), sizeBytes: num, secureUrl: z.string().catch('') })
  .passthrough();
export type Attachment = z.infer<typeof attachmentSchema>;

export const messageSchema = z
  .object({
    id: z.string(),
    content: z.string().catch(''),
    senderType: z.string().catch('user'),
    senderName: z.string().catch(''),
    isInternal: z.boolean().catch(false),
    createdAt: z.string().catch(''),
    attachments: z.array(attachmentSchema).catch([]),
  })
  .passthrough();
export type TicketMessage = z.infer<typeof messageSchema>;

export const ticketDetailSchema = z.object({
  ticket: ticketSchema.extend({ satisfactionScore: z.coerce.number().nullable().optional().catch(null), relatedOrderId: str }),
  messages: z.array(messageSchema).catch([]),
});
export type TicketDetail = z.infer<typeof ticketDetailSchema>;

export const fetchTickets = (status: string) =>
  apiFetch('/support/client/tickets', { query: status ? { status } : undefined, schema: z.object({ data: z.array(ticketSchema).catch([]), total: num }) });
export const fetchTicket = (id: string) => apiFetch(`/support/client/tickets/${id}`, { schema: ticketDetailSchema });
export const createTicket = (body: { type: string; subject: string; firstMessage: string; relatedOrderId?: string }) =>
  apiFetch('/support/client/tickets', { method: 'POST', body, schema: z.object({ ticket: ticketSchema, firstMessageId: z.string().optional().catch(undefined) }).passthrough() });
export const replyTicket = (id: string, content: string) => apiFetch(`/support/client/tickets/${id}/reply`, { method: 'POST', body: { content }, schema: messageSchema });
export const rateTicket = (id: string, score: number) => apiFetch(`/support/client/tickets/${id}/rate`, { method: 'POST', body: { score } });
export const suggestArticles = (query: string) =>
  apiFetch('/support/suggest', { auth: false, query: { query }, schema: z.array(z.object({ slug: z.string(), title: z.string().catch(''), excerpt: str })).catch([]) });

export type LocalFile = { uri: string; name: string; mimeType: string; size?: number };
export async function uploadAttachment(ticketId: string, messageId: string, file: LocalFile) {
  const formData = new FormData();
  formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  return apiFetch(`/support/client/tickets/${ticketId}/messages/${messageId}/attachments`, { method: 'POST', formData, schema: attachmentSchema });
}

/* ── Règles partagées ───────────────────────────────────────────────── */

export const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];
export const MAX_FILE = 10 * 1024 * 1024;
export const MIN_MESSAGE = 20;

export const fmtBytes = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} Ko` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`);
export const normalize = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** « il y a 5 min », « hier », « 3 oct. ». */
export function ago(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'à l’instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  if (h < 48) return 'hier';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Icône Font Awesome (« fa-truck ») du serveur → icône Ionicons proche. */
export function ionOf(fa: string): string {
  const k = (fa.trim().split(/\s+/).pop() ?? '').replace(/^fa-/, '');
  const MAP: Record<string, string> = {
    'box': 'cube-outline', 'boxes-stacked': 'cube-outline', 'truck': 'car-outline', 'truck-fast': 'car-outline', 'credit-card': 'card-outline',
    'wallet': 'wallet-outline', 'user': 'person-outline', 'user-shield': 'shield-checkmark-outline', 'shield-halved': 'shield-half-outline',
    'rotate-left': 'refresh-outline', 'store': 'storefront-outline', 'motorcycle': 'bicycle-outline', 'gear': 'settings-outline',
    'circle-question': 'help-circle-outline', 'lock': 'lock-closed-outline', 'money-bill': 'cash-outline', 'tag': 'pricetag-outline',
  };
  return MAP[k] ?? 'folder-open-outline';
}
