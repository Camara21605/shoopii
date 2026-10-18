/**
 * Messagerie — mêmes adresses que le site (messagerie.controller.ts) :
 *   GET   /messagerie/conversations                    (pagination cursor : ?cursor=&limit=)
 *   GET   /messagerie/conversations/:id/messages        (pagination cursor, ordre chronologique)
 *   POST  /messagerie/conversations/:id/messages        (envoyer — texte, image, vidéo, audio, fichier, position)
 *   PATCH /messagerie/conversations/:id/read            (marquer lu)
 *   PATCH /messagerie/messages/:id · DELETE /messagerie/messages/:id { mode }
 *   GET   /messagerie/conversations/:id/media-summary   (infos de la discussion)
 *   PATCH /messagerie/conversations/:id/mute | /block · DELETE /messagerie/conversations/:id
 * Les réactions restent sur le site pour l'instant. Appels : features/calls/.
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

export const conversationSchema = z
  .object({
    id: z.string(),
    contactId: z.string(),
    contactType: z.string(),
    contactName: z.string(),
    contactLogo: z.string().nullable().optional(),
    contactOnline: z.boolean().optional().default(false),
    contactLastSeen: z.string().nullable().optional(),
    /** online · reachable (appli fermée, internet actif) · offline */
    contactPresence: z.enum(['online', 'reachable', 'offline']).optional().catch(undefined),
    contactReachableUntil: z.string().nullable().optional().catch(null),
    contactUserId: z.string().nullable().optional(),
    contactSubtitle: z.string().nullable().optional(),
    unreadCount: z.coerce.number().default(0),
    lastMessage: z.string().nullable().optional(),
    lastMessageAt: z.string().nullable().optional(),
    pinned: z.boolean().optional().default(false),
    muted: z.boolean().optional().default(false),
  })
  .passthrough();
export type Conversation = z.infer<typeof conversationSchema>;

const conversationPageSchema = z
  .object({
    data: z.array(conversationSchema),
    nextCursor: z.string().nullable().optional(),
    hasMore: z.boolean().optional().default(false),
  })
  .passthrough();
export type ConversationPage = z.infer<typeof conversationPageSchema>;

export function fetchConversationPage(opts: { cursor?: string | null }) {
  return apiFetch('/messagerie/conversations', {
    schema: conversationPageSchema,
    query: { limit: 20, cursor: opts.cursor ?? undefined },
  });
}

const replyPreviewSchema = z
  .object({
    id: z.string(),
    fromMe: z.boolean(),
    contentType: z.string(),
    content: z.string().nullable(),
    deletedAt: z.string().nullable().optional(),
  })
  .passthrough();

export const chatMessageSchema = z
  .object({
    id: z.string(),
    fromMe: z.boolean(),
    senderId: z.string(),
    senderType: z.string(),
    contentType: z.string(),
    content: z.string().nullable(),
    mediaUrl: z.string().nullable().optional(),
    mediaName: z.string().nullable().optional(),
    mediaMimeType: z.string().nullable().optional(),
    mediaDuration: z.coerce.number().nullable().optional(),
    latitude: z.coerce.number().nullable().optional(),
    longitude: z.coerce.number().nullable().optional(),
    locationLabel: z.string().nullable().optional(),
    createdAt: z.string(),
    readAt: z.string().nullable().optional(),
    replyToId: z.string().nullable().optional(),
    /** Fourni directement par GET .../messages (getMessagesWithReplies) — jamais reconstruit côté client. */
    replyToMessage: replyPreviewSchema.nullable().optional(),
    isEdited: z.boolean().optional().default(false),
    deletedAt: z.string().nullable().optional(),
  })
  .passthrough();
export type ChatMessage = z.infer<typeof chatMessageSchema>;

const messagePageSchema = z
  .object({
    data: z.array(chatMessageSchema),
    nextCursor: z.string().nullable().optional(),
    hasMore: z.boolean().optional().default(false),
  })
  .passthrough();
export type MessagePage = z.infer<typeof messagePageSchema>;

export function fetchMessagePage(conversationId: string, opts: { cursor?: string | null }) {
  return apiFetch(`/messagerie/conversations/${conversationId}/messages`, {
    schema: messagePageSchema,
    query: { limit: 30, cursor: opts.cursor ?? undefined },
  });
}

export interface OutgoingMessage {
  content?: string;
  contentType?: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location';
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: number;
  mediaMimeType?: string;
  mediaDuration?: number;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
  replyToId?: string;
}

export function sendMessage(conversationId: string, payload: OutgoingMessage) {
  return apiFetch(`/messagerie/conversations/${conversationId}/messages`, {
    method: 'POST',
    schema: chatMessageSchema,
    body: payload,
  });
}

export function sendTextMessage(conversationId: string, content: string, replyToId?: string) {
  return sendMessage(conversationId, { content, contentType: 'text', replyToId });
}

export const markConversationRead = (conversationId: string) =>
  apiFetch(`/messagerie/conversations/${conversationId}/read`, { method: 'PATCH' });

/* ── Personnes & nouvelle discussion ─────────────────────────────── */

/** Type d'acteur côté messagerie (ConversationActorType du serveur). */
export type ActorType = 'client' | 'company' | 'delivery' | 'correspondent' | 'partner';

const searchUserSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    name: z.string(),
    logo: z.string().nullable().optional(),
    subtitle: z.string().nullable().optional(),
    online: z.boolean().optional().default(false),
  })
  .passthrough();
export type SearchUser = z.infer<typeof searchUserSchema>;

/**
 * GET /messagerie/users/search — sans terme : les contacts liés (commande,
 * abonnement, répertoire) ; avec un terme (≥ 2 caractères ou un numéro) :
 * tout l'annuaire de la plateforme.
 */
export function searchUsers(q: string, signal?: AbortSignal) {
  return apiFetch('/messagerie/users/search', { schema: z.array(searchUserSchema).catch([]), query: { q }, signal });
}

/** Démarre (ou reprend) la discussion avec cet acteur — renvoie la conversation complète. */
export function openConversationWith(targetType: ActorType, targetId: string) {
  return apiFetch('/messagerie/conversations', {
    method: 'POST',
    body: { targetType, targetId },
    schema: conversationSchema,
  });
}

/* ── Actions sur un message (appui long) ─────────────────────────── */

/** Modifier un de MES messages texte (24 h au plus, règle du serveur). */
export function editMessage(messageId: string, content: string) {
  return apiFetch(`/messagerie/messages/${messageId}`, { method: 'PATCH', body: { content } });
}

/** 'me' : caché pour moi · 'everyone' : supprimé pour tous (mes messages uniquement). */
export function deleteMessage(messageId: string, mode: 'me' | 'everyone') {
  return apiFetch(`/messagerie/messages/${messageId}`, { method: 'DELETE', body: { mode } });
}

/* ── Infos d'une discussion (toucher la photo en haut) ───────────── */

const mediaSummarySchema = z
  .object({
    totalMessages: z.coerce.number().catch(0),
    media: z.array(z.object({
      id: z.string(),
      contentType: z.string(),
      mediaUrl: z.string().nullable(),
      mediaName: z.string().nullable().optional(),
      createdAt: z.string(),
    }).passthrough()).catch([]),
    isBlockedByMe: z.boolean().catch(false),
    /** Absent sur un ancien serveur */
    contact: z.object({ type: z.string(), id: z.string(), userId: z.string().nullable().optional() }).optional().catch(undefined),
  })
  .passthrough();
export type MediaSummary = z.infer<typeof mediaSummarySchema>;

export function fetchMediaSummary(conversationId: string) {
  return apiFetch(`/messagerie/conversations/${conversationId}/media-summary`, { schema: mediaSummarySchema });
}

export const setConversationMuted = (conversationId: string, muted: boolean) =>
  apiFetch(`/messagerie/conversations/${conversationId}/mute`, { method: 'PATCH', body: { muted } });

export const setContactBlocked = (conversationId: string, blocked: boolean) =>
  apiFetch(`/messagerie/conversations/${conversationId}/block`, { method: 'PATCH', body: { blocked } });

export const deleteConversation = (conversationId: string) =>
  apiFetch(`/messagerie/conversations/${conversationId}`, { method: 'DELETE' });

/** Profil public d'un CLIENT (GET /client/profils/:id — respecte sa confidentialité). */
const clientPublicSchema = z
  .object({
    id: z.string(),
    nom: z.string(),
    avatar: z.string().nullable().optional(),
    bio: z.string().nullable().optional(),
    membreDepuis: z.string().nullable().optional(),
    commandesCount: z.coerce.number().optional(),
  })
  .passthrough();
export type ClientPublicProfile = z.infer<typeof clientPublicSchema>;

export function fetchClientPublicProfile(clientId: string) {
  return apiFetch(`/client/profils/${clientId}`, { schema: clientPublicSchema });
}
