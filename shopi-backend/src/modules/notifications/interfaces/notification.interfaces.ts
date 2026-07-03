/* ============================================================
 * FICHIER : src/modules/notifications/interfaces/notification.interfaces.ts
 *
 * RÔLE : Contrat TypeScript central de tout le système de
 *        notifications (REST + WebSocket + Queue + Strategies).
 *
 * RÈGLE D'OR : Aucune duplication de types entre le gateway,
 *              les services et le processor. Tout est ici.
 * ============================================================ */

import type { Socket } from 'socket.io';
import type {
  NotificationActorType,
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from 'src/database/entities/notification/notification.entitiy';

// ═════════════════════════════════════════════════════════════
// SOCKET AUTHENTIFIÉ
// ═════════════════════════════════════════════════════════════

/**
 * Socket enrichi par handleConnection après vérification JWT.
 *
 * Les champs data.actorType / data.actorId sont résolus via
 * le mapping role → profil (company → companies.id, etc.).
 */
export interface NotificationSocket extends Socket {
  data: {
    /** UUID de la ligne users — clé de room `notif:user:{userId}` */
    userId:    string;
    /** Rôle JWT brut (company, client, delivery, partner…) */
    userRole:  string;
    /** Type d'acteur normalisé (company → NotificationActorType.COMPANY) */
    actorType: NotificationActorType;
    /** UUID du profil acteur (companies.id, clients.id…) */
    actorId:   string;
  };
}

// ═════════════════════════════════════════════════════════════
// PAYLOAD INTERNE — CRÉER UNE NOTIFICATION
// ═════════════════════════════════════════════════════════════

/**
 * Payload utilisé par tous les services internes pour créer
 * une notification via NotificationService.create().
 *
 * CE N'EST PAS un DTO HTTP. Les événements métier construisent
 * ce payload et l'injectent dans NotificationService.
 *
 * Exemples d'appelants (Phase 2) :
 *   - CommandeEventListener  → ORDER_CONFIRMED
 *   - MessagerieEventListener → MESSAGE_RECEIVED
 *   - SuivisModule           → FOLLOW_NEW
 */
export interface ICreateNotificationPayload {
  // ── Destinataire (obligatoire) ───────────────────────────
  /** Type de l'acteur destinataire */
  recipientType: NotificationActorType;
  /** UUID du profil destinataire (companies.id, clients.id…) */
  recipientId:   string;

  // ── Déclencheur (null = action système automatique) ──────
  actorType?: NotificationActorType | null;
  actorId?:   string | null;

  // ── Classification ───────────────────────────────────────
  type:      NotificationType;
  priority?: NotificationPriority;

  // ── Contenu affiché ─────────────────────────────────────
  title:      string;    // max 100 chars (contrainte mobile push)
  body:       string;    // max 255 chars
  imageUrl?:  string | null;
  actionUrl?: string | null;

  // ── Données contextuelles (pour le frontend) ─────────────
  /**
   * JSON libre contenant les données nécessaires au rendu.
   * Ex: { orderId, totalAmount, productCount } pour ORDER_CONFIRMED.
   * Le frontend lit ces champs pour afficher le bon template.
   */
  payload?: Record<string, unknown> | null;

  // ── Ressource principale concernée ───────────────────────
  /** 'order' | 'product' | 'conversation' | 'delivery' | 'promo' */
  resourceType?: string | null;
  /** UUID de la ressource (orderId, productId, conversationId…) */
  resourceId?:   string | null;

  // ── Agrégation ───────────────────────────────────────────
  /**
   * Clé de regroupement pour éviter le spam.
   * Format : "{type}:{resourceType}:{resourceId}"
   * Exemples :
   *   "product.liked:product:uuid-produit"
   *   "follow.new:company:uuid-boutique"
   *
   * null = notification isolée, pas d'agrégation.
   *
   * Si une notification non-lue avec le même groupKey existe
   * depuis moins de 24h → NotificationService incrémente count
   * au lieu de créer une nouvelle ligne.
   */
  groupKey?: string | null;

  // ── Expiration ───────────────────────────────────────────
  /**
   * Date d'expiration automatique.
   * null = notification persistante (conservée indéfiniment).
   * Ex: PROMO_ENDING_SOON → expiresAt = fin de la promo
   */
  expiresAt?: Date | null;

  // ── Override canaux ──────────────────────────────────────
  /**
   * Si défini, bypasse les préférences utilisateur et envoie
   * uniquement sur ce canal.
   * Usage : SMS OTP, alertes de sécurité critiques.
   */
  forceChannel?: NotificationChannel;
}

// ═════════════════════════════════════════════════════════════
// RÉSULTAT DE LIVRAISON PAR CANAL
// ═════════════════════════════════════════════════════════════

/**
 * Retourné par chaque IChannelStrategy.deliver().
 * Utilisé par NotificationDispatchService pour créer
 * le NotificationDeliveryLog correspondant.
 */
export interface IDeliveryResult {
  channel:              NotificationChannel;
  success:              boolean;
  providerMessageId?:   string | null;
  errorCode?:           string | null;
  errorMessage?:        string | null;
  /** true = pas de retry utile (token invalide, email bounced…) */
  isPermanentFailure?:  boolean;
  durationMs?:          number;
  /** Données traçables (token partiel, email, phone) */
  meta?: {
    tokenUsed?: string;   // 20 derniers chars du token
    emailUsed?: string;
    phoneUsed?: string;
  };
}

// ═════════════════════════════════════════════════════════════
// DTO NOTIFICATION (réponse API publique)
// ═════════════════════════════════════════════════════════════

/**
 * Représentation publique d'une notification exposée par l'API.
 *
 * N'expose PAS les champs internes de l'entité
 * (actorType, channel, isSent, delivery logs…).
 */
export interface INotificationDto {
  id:           string;
  type:         NotificationType;
  priority:     NotificationPriority;
  title:        string;
  body:         string;
  imageUrl:     string | null;
  actionUrl:    string | null;
  payload:      Record<string, unknown> | null;
  resourceType: string | null;
  resourceId:   string | null;
  isRead:       boolean;
  readAt:       string | null;  // ISO 8601
  count:        number;
  createdAt:    string;         // ISO 8601
  /** Données de l'acteur déclencheur enrichies côté API */
  actor?: {
    id:     string;
    type:   string;
    name:   string;
    avatar: string | null;
  } | null;
}

// ═════════════════════════════════════════════════════════════
// RÉSULTAT PAGINÉ DE LA LISTE
// ═════════════════════════════════════════════════════════════

/**
 * Réponse de GET /notifications.
 *
 * Pagination cursor-based (par createdAt) adaptée aux grandes
 * listes de notifications (>10 000 par acteur).
 *
 * Avantage sur la pagination par page/offset :
 *   → stable même si de nouvelles notifications arrivent
 *     pendant la pagination (pas de doublons ni de sauts).
 */
export interface INotificationListResult {
  data:       INotificationDto[];
  /** Total de notifications (toutes, pas seulement la page) */
  total:      number;
  /** Total non lues à ce moment */
  unread:     number;
  hasMore:    boolean;
  /** Cursor pour la prochaine page (createdAt ISO de la dernière notif) */
  nextCursor: string | null;
}

// ═════════════════════════════════════════════════════════════
// ÉVÉNEMENTS WEBSOCKET — Serveur → Client
// ═════════════════════════════════════════════════════════════

/**
 * Émis sur `notif:new` quand une notification IN_APP arrive
 * en temps réel pour un utilisateur connecté.
 *
 * Le frontend :
 *   1. Ajoute la notification en tête de liste
 *   2. Met à jour le badge (unreadCount)
 *   3. Affiche un toast (si préférence toast activée)
 */
export interface WsNewNotificationPayload {
  notification: INotificationDto;
  /** Nouveau compteur non lu mis à jour (incrémenté de +1) */
  unreadCount:  number;
}

/**
 * Émis sur `notif:unread_count` après markAsRead, markAllAsRead
 * ou à la connexion du socket.
 *
 * Permet au badge de se synchroniser sans recharger la liste.
 */
export interface WsUnreadCountPayload {
  unreadCount: number;
}

// ═════════════════════════════════════════════════════════════
// PAYLOAD JOB BULLMQ
// ═════════════════════════════════════════════════════════════

/**
 * Payload du job `notification-dispatch` dans BullMQ.
 *
 * Le processor recharge la notification depuis la DB avec
 * son notificationId, et envoie sur les canaux listés.
 *
 * On ne sérialise pas la notification entière dans le job
 * pour éviter les données stales si la notification est modifiée
 * entre l'enqueue et l'exécution du job.
 */
export interface INotificationDispatchJobPayload {
  /** UUID de la notification à dispatcher */
  notificationId: string;
  /** Canaux cibles (déjà filtrés selon préférences + DND) */
  channels:       NotificationChannel[];
}

/**
 * Payload du job `notification-reminder` dans BullMQ.
 *
 * Enqueué par NotificationScheduler (CRON quotidien 09h00)
 * pour les acteurs ayant des notifications non lues depuis > 24h.
 *
 * Le processor appelle NotificationReminderService.sendDigest()
 * qui crée une notification SYSTEM_ANNOUNCEMENT récapitulative.
 */
export interface IReminderJobPayload {
  actorType:   NotificationActorType;
  actorId:     string;
  unreadCount: number;
}
