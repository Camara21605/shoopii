/**
 * ============================================================
 * FICHIER : src/modules/messagerie/interfaces/messaging.interfaces.ts
 *
 * RÔLE : Contrat TypeScript de tous les objets échangés dans
 *        la messagerie (REST + WebSocket).
 *
 * POURQUOI : Centraliser les types évite la duplication et
 *            rend impossible toute incohérence entre le gateway,
 *            le service et le frontend.
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
// SOCKET AUTHENTIFIÉ
// Étend Socket de socket.io avec les données injectées après
// vérification JWT (userId, actorType, actorId).
// ─────────────────────────────────────────────────────────────

import type { Socket } from 'socket.io';

export interface AuthenticatedSocket extends Socket {
  data: {
    userId:    string;  // UUID utilisateur JWT (users.id)
    userRole?: string;  // rôle JWT (company, client, delivery…)
    actorType?: string; // résolu après lookup profil (optionnel)
    actorId?:   string; // UUID du profil (optionnel)
  };
}

// ─────────────────────────────────────────────────────────────
// PRÉSENCE UTILISATEUR (Redis)
// Clé : presence:{userId}
// ─────────────────────────────────────────────────────────────

export interface UserPresence {
  online:   boolean;
  lastSeen: string;   // ISO 8601
  sockets:  number;   // nombre de connexions simultanées
}

// ─────────────────────────────────────────────────────────────
// INDICATEURS D'ACTIVITÉ
// Émis côté client, broadcastés aux participants
// ─────────────────────────────────────────────────────────────

/** Type d'activité visible pour l'interlocuteur */
export type TypingActivity = 'typing' | 'recording' | 'uploading' | 'stopped';

// ─────────────────────────────────────────────────────────────
// ÉVÉNEMENTS SOCKET — Client → Serveur
// ─────────────────────────────────────────────────────────────

/** Rejoindre/quitter une conversation (pour les événements temps réel) */
export interface WsJoinConvPayload {
  conversationId: string;
}

/** Indicateur de frappe */
export interface WsTypingPayload {
  conversationId: string;
  activity:       TypingActivity;
}

/** Marquer une conversation lue */
export interface WsMarkReadPayload {
  conversationId: string;
}

// ─────────────────────────────────────────────────────────────
// ÉVÉNEMENTS SOCKET — Serveur → Client
// ─────────────────────────────────────────────────────────────

/** Nouveau message reçu */
export interface WsNewMessagePayload {
  conversationId: string;
  message: {
    id:            string;
    fromMe:        boolean;   // toujours false côté destinataire
    senderId:      string;
    senderType:    string;
    senderName:    string;
    contentType:   string;
    content:       string | null;
    mediaUrl:      string | null;
    mediaName:     string | null;
    mediaMimeType: string | null;
    mediaSize:     number | null;
    createdAt:     string;
    replyToId:     string | null;
  };
  /** Mise à jour aperçu conversation (pour la liste gauche) */
  convPreview: {
    lastMessage:   string;
    lastMessageAt: string;
    unreadCount:   number;
  };
}

/** Accusé de livraison (message bien reçu par le destinataire) */
export interface WsMessageDeliveredPayload {
  conversationId: string;
  messageId:      string;
  deliveredAt:    string;
}

/** Accusé de lecture */
export interface WsMessageReadPayload {
  conversationId: string;
  readAt:         string;
  readerId:       string;
}

/** Indicateur d'activité reçu par le destinataire */
export interface WsTypingBroadcast {
  conversationId: string;
  senderId:       string;
  senderName:     string;
  activity:       TypingActivity;
}

/** Changement de statut en ligne */
export interface WsPresencePayload {
  userId:   string;
  online:   boolean;
  lastSeen: string;
}

/** Message modifié */
export interface WsMessageEditedPayload {
  conversationId: string;
  messageId:      string;
  newContent:     string;
  editedAt:       string;
}

/** Message supprimé */
export interface WsMessageDeletedPayload {
  conversationId: string;
  messageId:      string;
  deletedForAll:  boolean;
}

/** Réaction ajoutée/supprimée */
export interface WsReactionPayload {
  conversationId: string;
  messageId:      string;
  emoji:          string;
  actorId:        string;
  added:          boolean;   // true = ajout, false = suppression
}

// ─────────────────────────────────────────────────────────────
// GROUPES DE LIVRAISON (delivery-group)
// ─────────────────────────────────────────────────────────────

/** Nouveau message dans un groupe de livraison */
export interface WsGroupNewMessagePayload {
  groupId:        string;
  commandeNumero: string;
  message:        object;
}

/** Message édité dans un groupe */
export interface WsGroupMessageEditedPayload {
  groupId:    string;
  messageId:  string;
  newContent: string;
  editedAt:   string;
}

/** Message supprimé dans un groupe */
export interface WsGroupMessageDeletedPayload {
  groupId:      string;
  messageId:    string;
  deletedForAll: boolean;
}

/** Réaction dans un groupe */
export interface WsGroupReactionPayload {
  groupId:   string;
  messageId: string;
  reactions: Record<string, string[]>;
}

/** Changement de statut du groupe (créé / complété / expiré / annulé / membre changé) */
export interface WsGroupStatusPayload {
  event:          string;
  groupId:        string;
  commandeNumero?: string;
  companyName?:   string;
  memberCount?:   number;
  expiresAt?:     string;
  description?:   string;
  newMember?:     { type: string; name: string };
}
