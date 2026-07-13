/* ============================================================
 * FICHIER  : src/modules/support/services/support.api.ts
 * MODULE   : Support
 * ROLE     : Couche d'accès aux données — API Support Client.
 *
 * RESPONSABILITES :
 *   - Typer les réponses de l'API backend (tickets, messages, attachments).
 *   - Exposer un objet `supportApi` avec toutes les méthodes HTTP.
 *   - Déléguer chaque requête à `apiFetch` (VITE_API_URL-aware, JWT auto).
 *   - Gérer l'upload multipart (pièces jointes) via FormData.
 *
 * DESIGN :
 *   Un objet singleton `supportApi` — pas de classe, pas de hook.
 *   Les hooks React (useSupport.ts) consomment ce service.
 *
 * SECURITE :
 *   - `uploadAttachment` utilise FormData → apiFetch détecte FormData
 *     et n'ajoute pas Content-Type application/json (boundary multipart).
 *   - Aucune URL construite avec des données non encodées.
 *
 * DEPENDANCES :
 *   - apiFetch  (src/shared/services/apiFetch.ts)
 *
 * AUTEUR : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-03
 * ============================================================ */

import { apiFetch } from '../../../shared/services/apiFetch';

/* ════════════════════════════════════════════════════════════════
 * TYPES
 * ════════════════════════════════════════════════════════════════ */

export interface SupportTicketSummary {
  id:           string;
  reference:    string;
  type:         string;
  subject:      string;
  status:       string;
  priority:     string;
  messageCount: number;
  unreadByUser: number;
  createdAt:    string;
  updatedAt:    string;
}

/** Métadonnées d'une pièce jointe support.
 *  Correspond à l'entité Attachment côté backend. */
export interface SupportAttachment {
  id:               string;
  messageId:        string;
  originalFilename: string;
  mimeType:         string;
  extension:        string;
  sizeBytes:        number;
  /* URL Cloudinary HTTPS — directement utilisable dans <a href> ou <img src>. */
  secureUrl:        string;
  uploadedByRole:   string;
  createdAt:        string;
}

/** Message individuel dans un thread de ticket.
 *  Les pièces jointes sont chargées côté backend via la relation TypeORM. */
export interface SupportMessage {
  id:           string;
  ticketId:     string;
  content:      string;
  senderType:   'user' | 'agent' | 'system';
  senderName:   string;
  senderAvatar: string | null;
  isInternal:   boolean;
  createdAt:    string;
  /** Tableau de pièces jointes associées à ce message.
   *  Chargé via relations: ['attachments'] dans TicketService.
   *  Peut être vide (cas le plus fréquent). */
  attachments:  SupportAttachment[];
}

export interface SupportTicketDetail {
  ticket: SupportTicketSummary & {
    firstMessage:      string;
    agentId:           string | null;
    relatedOrderId:    string | null;
    satisfactionScore: number | null;
    resolvedAt:        string | null;
    closedAt:          string | null;
  };
  messages: SupportMessage[];
}

export interface CreateTicketPayload {
  type:            string;
  subject:         string;
  firstMessage:    string;
  relatedOrderId?: string;
}

/* ════════════════════════════════════════════════════════════════
 * API CLIENT
 * ════════════════════════════════════════════════════════════════ */

export const supportApi = {

  /* ── Tickets ──────────────────────────────────────────────── */

  /** Crée un ticket de support. Retourne le ticket créé. */
  createTicket: (payload: CreateTicketPayload) =>
    apiFetch<SupportTicketSummary>('/support/client/tickets', {
      method: 'POST',
      body:   payload,
    }),

  /** Liste paginée des tickets de l'utilisateur connecté. */
  listTickets: (params?: { status?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.page)   qs.set('page',   String(params.page));
    return apiFetch<{ data: SupportTicketSummary[]; total: number }>(
      `/support/client/tickets?${qs}`,
    );
  },

  /** Détail complet d'un ticket avec ses messages et leurs pièces jointes. */
  getTicket: (id: string) =>
    apiFetch<SupportTicketDetail>(`/support/client/tickets/${id}`),

  /** Envoie un message texte au ticket. Retourne le message créé (avec son id). */
  reply: (id: string, content: string) =>
    apiFetch<SupportMessage>(`/support/client/tickets/${id}/reply`, {
      method: 'POST',
      body:   { content },
    }),

  /** Soumet une note CSAT (1–5) pour un ticket résolu ou fermé. */
  rate: (id: string, score: number) =>
    apiFetch<void>(`/support/client/tickets/${id}/rate`, {
      method: 'POST',
      body:   { score },
    }),

  /* ── Pièces jointes ───────────────────────────────────────── */

  /**
   * Upload une pièce jointe liée à un message existant.
   *
   * FLOW UX : on envoie d'abord le texte (reply → obtient messageId),
   * puis on appelle uploadAttachment avec ce messageId.
   *
   * FORMAT : multipart/form-data — le champ du fichier s'appelle "file".
   * apiFetch détecte FormData et n'ajoute pas Content-Type: application/json
   * (le navigateur gère le boundary multipart automatiquement).
   *
   * Types autorisés (validés côté serveur) : PDF, JPG, PNG, WebP, MP4, WebM
   * Taille max : 10 MB
   */
  uploadAttachment: (ticketId: string, messageId: string, file: File) => {
    const form = new FormData();
    /* Le nom du champ "file" doit correspondre au FileInterceptor('file') backend. */
    form.append('file', file);
    return apiFetch<SupportAttachment>(
      `/support/client/tickets/${ticketId}/messages/${messageId}/attachments`,
      { method: 'POST', body: form },
    );
  },

  /* ── Suggestions d'articles ───────────────────────────────── */

  /**
   * Retourne jusqu'à 3 articles du Help Center correspondant à la requête.
   * Utilisé dans NewTicketPage pendant la saisie du sujet.
   * Endpoint public (GET /support/suggest) — throttlé à 30 req/min.
   */
  suggest: (query: string) =>
    apiFetch<Array<{ slug: string; title: string; excerpt: string }>>(
      `/support/suggest?query=${encodeURIComponent(query)}`,
    ),
};
