/**
 * Groupes de discussion — mêmes adresses que le site (delivery-group.controller.ts) :
 *   GET    /delivery-groups                                  mes groupes (libres + groupes de commande)
 *   POST   /delivery-groups                                  créer un groupe libre { name, members[] }
 *   PATCH  /delivery-groups/:id                              description / photo
 *   GET    /delivery-groups/:id/members                      membres (+ en ligne)
 *   POST   /delivery-groups/:id/members                      ajouter des membres (admin)
 *   PATCH  /delivery-groups/:id/members/:memberId/admin      nommer / retirer un admin
 *   PATCH  /delivery-groups/:id/members/:memberId/permissions  droits d'un membre
 *   PATCH  /delivery-groups/:id/permissions                  droits de tous les non-admins
 *   GET    /delivery-groups/:id/messages?page=&limit=        messages (page 1 = les plus récents)
 *   POST   /delivery-groups/:id/messages                     envoyer
 *   DELETE /delivery-groups/:id/messages/:msgId              supprimer (pour moi / pour tous)
 *   PATCH  /delivery-groups/:id/read                         marquer lu
 * Deux sortes de groupes : « custom » (créé par un utilisateur, avec admins
 * et permissions) et « order » (créé automatiquement pour une commande :
 * client, boutique, livreur…).
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

import type { ActorType } from './api';

const permsSchema = z.object({
  canSendMessages: z.boolean().catch(true),
  canSendVoice: z.boolean().catch(true),
  canCall: z.boolean().catch(true),
});
export type GroupPermissions = z.infer<typeof permsSchema>;

export const groupSchema = z
  .object({
    id: z.string(),
    kind: z.string(),
    name: z.string().nullable().optional(),
    commandeNumero: z.string().nullable().optional(),
    companyName: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    photoUrl: z.string().nullable().optional(),
    status: z.string(),
    unreadCount: z.coerce.number().catch(0),
    memberCount: z.coerce.number().catch(0),
    myPermissions: permsSchema.extend({ isAdmin: z.boolean().catch(false) }).optional(),
    defaultPermissions: permsSchema.optional(),
    memberUserIds: z.array(z.string()).catch([]),
    onlineUserIds: z.array(z.string()).catch([]),
    lastMessage: z.string().nullable().optional(),
    lastMessageAt: z.string().nullable().optional(),
    createdAt: z.string().optional(),
  })
  .passthrough();
export type Group = z.infer<typeof groupSchema>;

/** Nom affiché : nom libre, sinon « Commande #… · Boutique » pour un groupe de commande. */
export function groupTitle(g: Pick<Group, 'name' | 'commandeNumero' | 'companyName'>): string {
  if (g.name) return g.name;
  if (g.commandeNumero) return `Commande ${g.commandeNumero}${g.companyName ? ` · ${g.companyName}` : ''}`;
  return 'Groupe';
}

export const fetchGroups = () => apiFetch('/delivery-groups', { schema: z.array(groupSchema).catch([]) });

export function createGroup(name: string, members: { type: ActorType | string; id: string }[]) {
  return apiFetch('/delivery-groups', { method: 'POST', body: { name, members }, schema: groupSchema });
}

export function updateGroup(groupId: string, patch: { description?: string; photoUrl?: string }) {
  return apiFetch(`/delivery-groups/${groupId}`, { method: 'PATCH', body: patch, schema: z.unknown() });
}

const memberSchema = z
  .object({
    id: z.string(),
    actorType: z.string(),
    actorId: z.string(),
    userId: z.string(),
    displayName: z.string(),
    isAdmin: z.boolean().catch(false),
    canSendMessages: z.boolean().catch(true),
    canSendVoice: z.boolean().catch(true),
    canCall: z.boolean().catch(true),
    online: z.boolean().catch(false),
    lastSeen: z.string().nullable().optional(),
  })
  .passthrough();
export type GroupMember = z.infer<typeof memberSchema>;

export const fetchGroupMembers = (groupId: string) =>
  apiFetch(`/delivery-groups/${groupId}/members`, { schema: z.array(memberSchema).catch([]) });

export const addGroupMembers = (groupId: string, members: { type: string; id: string }[]) =>
  apiFetch(`/delivery-groups/${groupId}/members`, { method: 'POST', body: { members }, schema: z.unknown() });

export const setMemberAdmin = (groupId: string, memberId: string, isAdmin: boolean) =>
  apiFetch(`/delivery-groups/${groupId}/members/${memberId}/admin`, { method: 'PATCH', body: { isAdmin }, schema: z.unknown() });

export const setMemberPermissions = (groupId: string, memberId: string, p: Partial<GroupPermissions>) =>
  apiFetch(`/delivery-groups/${groupId}/members/${memberId}/permissions`, { method: 'PATCH', body: p, schema: z.unknown() });

export const setGroupPermissions = (groupId: string, p: Partial<GroupPermissions>) =>
  apiFetch(`/delivery-groups/${groupId}/permissions`, { method: 'PATCH', body: p, schema: z.unknown() });

/* ── Messages ── */

export const groupMessageSchema = z
  .object({
    id: z.string(),
    groupId: z.string(),
    /** null pour un message système (création, ajout de membres…) — ramené à '' pour rester une chaîne. */
    senderUserId: z.string().nullable().transform((v) => v ?? ''),
    senderName: z.string().nullable().optional(),
    senderType: z.string().nullable().optional(),
    contentType: z.string(),
    content: z.string().nullable(),
    mediaUrl: z.string().nullable().optional(),
    mediaName: z.string().nullable().optional(),
    mediaMimeType: z.string().nullable().optional(),
    mediaDuration: z.coerce.number().nullable().optional(),
    isEdited: z.boolean().catch(false),
    deleted: z.boolean().catch(false),
    replyToId: z.string().nullable().optional(),
    replyTo: z
      .object({ id: z.string(), content: z.string().nullable(), contentType: z.string(), senderName: z.string().nullable().optional(), deleted: z.boolean().catch(false) })
      .nullable()
      .optional(),
    createdAt: z.string(),
  })
  .passthrough();
/**
 * `fromMe` n'est PAS lu depuis le serveur : l'événement temps réel
 * group_new_message est sérialisé UNE fois pour tous les membres, du point
 * de vue de l'expéditeur (il vaudrait `true` chez tout le monde). On le
 * recalcule toujours avec senderUserId === mon id.
 */
export type GroupMessage = z.infer<typeof groupMessageSchema>;

const groupPageSchema = z.object({
  messages: z.array(groupMessageSchema),
  total: z.coerce.number(),
  page: z.coerce.number(),
  pages: z.coerce.number(),
});
export type GroupMessagePage = z.infer<typeof groupPageSchema>;

export const fetchGroupMessages = (groupId: string, page: number) =>
  apiFetch(`/delivery-groups/${groupId}/messages`, { schema: groupPageSchema, query: { page, limit: 30 } });

export interface OutgoingGroupMessage {
  contentType: 'text' | 'image' | 'video' | 'audio' | 'file';
  content?: string;
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: number;
  mediaMimeType?: string;
  mediaDuration?: number;
  replyToId?: string;
}

export const sendGroupMessage = (groupId: string, payload: OutgoingGroupMessage) =>
  apiFetch(`/delivery-groups/${groupId}/messages`, { method: 'POST', body: payload, schema: groupMessageSchema });

export const deleteGroupMessage = (groupId: string, messageId: string, mode: 'me' | 'everyone') =>
  apiFetch(`/delivery-groups/${groupId}/messages/${messageId}`, { method: 'DELETE', body: { mode } });

export const markGroupRead = (groupId: string) =>
  apiFetch(`/delivery-groups/${groupId}/read`, { method: 'PATCH' });

/** Seuls les messages texte peuvent être modifiés, par leur auteur. */
export const editGroupMessage = (groupId: string, messageId: string, content: string) =>
  apiFetch(`/delivery-groups/${groupId}/messages/${messageId}`, { method: 'PATCH', body: { content }, schema: z.unknown() });

/** Un groupe expiré (commande livrée depuis 72 h) ou annulé n'accepte plus de messages. */
export const isGroupClosed = (g: Pick<Group, 'status'>) => g.status === 'expired' || g.status === 'cancelled';
