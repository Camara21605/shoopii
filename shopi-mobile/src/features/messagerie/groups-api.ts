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
    /** Groupe de commande : la commande (suivi) et son numéro */
    commandeId: z.string().nullable().optional(),
    commandeNumero: z.string().nullable().optional(),
    companyName: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    photoUrl: z.string().nullable().optional(),
    /** active · completed (livrée, fermeture 72 h après) · expired · cancelled */
    status: z.string(),
    expiresAt: z.string().nullable().optional(),
    completedAt: z.string().nullable().optional(),
    /** Mon rôle dans le groupe : client, company, delivery, correspondent, partner */
    myRole: z.string().nullable().optional(),
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
    /** Photo de profil / logo de boutique (null : initiales) */
    avatar: z.string().nullable().optional().catch(null),
    isAdmin: z.boolean().catch(false),
    canSendMessages: z.boolean().catch(true),
    canSendVoice: z.boolean().catch(true),
    canCall: z.boolean().catch(true),
    online: z.boolean().catch(false),
    lastSeen: z.string().nullable().optional(),
    /** online · reachable (appli fermée, internet actif) · offline */
    presence: z.enum(['online', 'reachable', 'offline']).optional().catch(undefined),
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
    /** Réactions { emoji: [users.id…] } */
    reactions: z.record(z.string(), z.array(z.string())).optional().catch({}),
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

/** Ajoute ou retire MA réaction sur un message du groupe — renvoie toutes les réactions. */
export const toggleGroupReaction = (groupId: string, messageId: string, emoji: string) =>
  apiFetch(`/delivery-groups/${groupId}/messages/${messageId}/reactions`, {
    method: 'POST',
    body: { emoji },
    schema: z.object({ reactions: z.record(z.string(), z.array(z.string())).catch({}) }).passthrough(),
  });

export const markGroupRead = (groupId: string) =>
  apiFetch(`/delivery-groups/${groupId}/read`, { method: 'PATCH' });

/** Seuls les messages texte peuvent être modifiés, par leur auteur. */
export const editGroupMessage = (groupId: string, messageId: string, content: string) =>
  apiFetch(`/delivery-groups/${groupId}/messages/${messageId}`, { method: 'PATCH', body: { content }, schema: z.unknown() });

/** Un groupe expiré (commande livrée depuis 72 h) ou annulé n'accepte plus de messages. */
export const isGroupClosed = (g: Pick<Group, 'status'>) => g.status === 'expired' || g.status === 'cancelled';

/* ── Groupe de livraison d'une commande (créé automatiquement) ───────────── */

/** Statut lisible d'un groupe de commande (pastille de la liste, bandeau, infos). */
export function orderGroupStatus(g: Pick<Group, 'status' | 'expiresAt'>): { label: string; color: string; bg: string; icon: 'radio-button-on' | 'checkmark-circle' | 'lock-closed' | 'close-circle' } {
  switch (g.status) {
    case 'completed': return { label: 'Livrée', color: '#0E7490', bg: '#E0F2F7', icon: 'checkmark-circle' };
    case 'expired':   return { label: 'Archivé', color: '#6B7280', bg: '#F1F2F4', icon: 'lock-closed' };
    case 'cancelled': return { label: 'Annulée', color: '#DC2626', bg: '#FDECEA', icon: 'close-circle' };
    default:          return { label: 'En cours', color: '#16A34A', bg: '#E7F6EE', icon: 'radio-button-on' };
  }
}

/** Rôle d'un membre dans un groupe de commande (pastille). */
export const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  client:        { label: 'Client', color: '#2563EB' },
  company:       { label: 'Boutique', color: '#7C3AED' },
  delivery:      { label: 'Livreur', color: '#D97706' },
  correspondent: { label: 'Point relais', color: '#0E7490' },
  partner:       { label: 'Partenaire', color: '#6D28D9' },
};

/**
 * Écran de suivi de la commande selon MON rôle — le serveur vérifie de toute
 * façon que j'ai le droit de voir cette commande.
 */
export function orderRouteFor(myRole: string | null | undefined, commandeId: string | null | undefined) {
  if (!commandeId) return null;
  switch (myRole) {
    case 'client':        return { pathname: '/commandes/[id]', params: { id: commandeId } } as const;
    case 'company':       return { pathname: '/entreprise/commandes/[id]', params: { id: commandeId } } as const;
    case 'delivery':      return { pathname: '/livreur/missions/[id]', params: { id: commandeId } } as const;
    case 'correspondent': return { pathname: '/correspondant/colis/[id]', params: { id: commandeId } } as const;
    default:              return null;
  }
}

/** « jusqu'au 25 oct. » — fermeture d'un groupe livré */
export function closesOn(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
