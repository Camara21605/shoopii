/* ============================================================
 * FICHIER : src/database/entities/notification/notification.entity.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Table centrale du système de notifications Shopi.
 *
 * Chaque ligne représente une notification envoyée
 * à UN acteur pour UN événement précis du système.
 *
 * Fonctionne comme les notifications de :
 *
 *    - Instagram  (like, commentaire, follow, message)
 *    - WhatsApp   (message reçu, livraison confirmée)
 *    - Amazon     (commande expédiée, livrée, remboursée)
 *    - Uber       (chauffeur assigné, en route, arrivé)
 *
 * ------------------------------------------------------------
 * EXEMPLES DE NOTIFICATIONS PAR ACTEUR
 * ------------------------------------------------------------
 *
 * CLIENT :
 *   → "Votre commande #1234 a été confirmée ✅"
 *   → "Mamadou D. est en route pour votre livraison 🛵"
 *   → "TechStore vous a envoyé un message 💬"
 *   → "Votre code promo SHOPI20 expire dans 2 jours ⏰"
 *
 * ENTREPRISE :
 *   → "Nouvelle commande reçue — iPhone 15 Pro 💰"
 *   → "Fatoumata K. a liké votre produit ❤️"
 *   → "Stock critique — Sony WH-1000XM5 (2 restants) ⚠️"
 *   → "Votre promotion SOLDES20 a été utilisée 50 fois 🎉"
 *
 * LIVREUR :
 *   → "Nouvelle mission disponible dans votre zone 📦"
 *   → "Commande #567 vous a été assignée 🛵"
 *   → "Le client vous a noté 5 étoiles ⭐"
 *
 * CORRESPONDANT :
 *   → "3 colis TechStore en attente de récupération 📥"
 *   → "Colis COL-0241 non récupéré depuis 48h ⚠️"
 *   → "Nouvelle boutique partenaire : AppleZone GN 🏪"
 *
 * ADMIN / PARTENAIRE :
 *   → "Nouvelle entreprise en attente de validation 🏢"
 *   → "Livreur Ibrahima S. a été suspendu 🚫"
 *
 * ------------------------------------------------------------
 * ARCHITECTURE POLYMORPHIQUE
 * ------------------------------------------------------------
 *
 * On utilise :
 *
 *    recipientType + recipientId   → qui reçoit la notification
 *    actorType     + actorId       → qui a déclenché l'action
 *                                    (null si système automatique)
 *
 * au lieu de relations TypeORM polymorphiques complexes.
 * Les profils sont résolus dans les SERVICES.
 *
 * ------------------------------------------------------------
 * CANAUX DE LIVRAISON
 * ------------------------------------------------------------
 *
 * Chaque notification peut être envoyée sur plusieurs canaux :
 *
 *    IN_APP   → liste de notifications dans l'interface
 *    PUSH     → notification push mobile (FCM/APNs)
 *    EMAIL    → email (SendGrid / Nodemailer)
 *    SMS      → SMS (Twilio / opérateurs locaux +224)
 *
 * Les préférences par canal sont dans notification_preferences.
 *
 * ------------------------------------------------------------
 * GROUPEMENT ET AGRÉGATION
 * ------------------------------------------------------------
 *
 * Pour éviter le spam quand plusieurs événements identiques
 * arrivent rapidement (ex: 10 likes en 1 minute) :
 *
 *    groupKey = clé de regroupement (ex: "like:productId:xxx")
 *    count    = nombre d'événements agrégés
 *
 * Ex: "Fatoumata et 9 autres ont liké votre produit ❤️"
 * au lieu de 10 notifications séparées.
 *
 * ------------------------------------------------------------
 * RÈGLES MÉTIER
 * ------------------------------------------------------------
 *
 *  1. Une notification non lue = isRead: false
 *     Marquée lue au clic (NotificationService.markAsRead)
 *
 *  2. expiresAt → null = persistante
 *     Certaines notifications disparaissent après X jours
 *     (ex: "offre flash expire dans 2h" → expiresAt = now + 2h)
 *     Un CRON job nettoie les expirées toutes les heures.
 *
 *  3. actionUrl → deep link vers la ressource concernée
 *     Ex: "/commandes/1234", "/chat/conv-uuid", "/produit/slug"
 *
 *  4. payload → JSON libre pour stocker les données contextuelles
 *     Ex: { orderId, productName, amount, livreurName }
 *     Utilisé par le frontend pour afficher le bon template.
 *
 * ------------------------------------------------------------
 * RELATIONS
 * ------------------------------------------------------------
 *
 *  Notification ──(ManyToOne)──► NotificationTemplate (optionnel)
 *    → Template réutilisable pour le titre/corps de la notif
 *
 * ------------------------------------------------------------
 * INDEX
 * ------------------------------------------------------------
 *
 *  IDX_notif_recipient    → (recipientType, recipientId, isRead)
 *    → liste des notifications non lues d'un acteur
 *
 *  IDX_notif_recipient_dt → (recipientType, recipientId, createdAt)
 *    → liste paginée triée par date
 *
 *  IDX_notif_type         → type
 *    → filtrer par type de notification
 *
 *  IDX_notif_expires      → expiresAt
 *    → CRON de nettoyage des notifications expirées
 *
 *  IDX_notif_group        → (recipientId, groupKey)
 *    → regroupement / agrégation des notifications similaires
 *
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  Index,
} from 'typeorm';

// ─── ENUMS ────────────────────────────────────────────────────

/**
 * Types d'acteurs pouvant recevoir ou déclencher une notification.
 * Aligné sur ConversationActorType et FollowerActorType.
 */
export enum NotificationActorType {
  CLIENT        = 'client',
  COMPANY       = 'company',
  DELIVERY      = 'delivery',
  CORRESPONDENT = 'correspondent',
  PARTNER       = 'partner',
  ADMIN         = 'admin',
  SUPER_ADMIN   = 'super_admin',
  SYSTEM        = 'system',   // notification déclenchée automatiquement (CRON, règle métier)
}

/**
 * Types de notifications — couvre tous les événements du système Shopi.
 *
 * Préfixe du type = domaine métier :
 *   ORDER_*       → commandes
 *   DELIVERY_*    → livraisons
 *   MESSAGE_*     → messagerie
 *   FOLLOW_*      → abonnements
 *   PRODUCT_*     → catalogue produits
 *   PROMO_*       → promotions
 *   PAYMENT_*     → paiements
 *   REVIEW_*      → avis et notes
 *   STOCK_*       → gestion des stocks
 *   STORY_*       → stories éphémères
 *   COLIS_*       → relais correspondant
 *   ACCOUNT_*     → gestion de compte
 *   SYSTEM_*      → notifications système
 */
export enum NotificationType {

  // ── COMMANDES ──────────────────────────────────────────────
  ORDER_PLACED          = 'order.placed',          // client passe une commande
  ORDER_CONFIRMED       = 'order.confirmed',        // entreprise confirme
  ORDER_CANCELLED       = 'order.cancelled',        // annulation
  ORDER_REFUNDED        = 'order.refunded',         // remboursement
  ORDER_STATUS_CHANGED  = 'order.status_changed',   // changement de statut générique

  // ── LIVRAISONS ─────────────────────────────────────────────
  DELIVERY_ASSIGNED     = 'delivery.assigned',      // livreur assigné à une commande
  DELIVERY_PICKED_UP    = 'delivery.picked_up',     // colis récupéré en boutique
  DELIVERY_EN_ROUTE     = 'delivery.en_route',      // livreur en route vers client
  DELIVERY_ARRIVED      = 'delivery.arrived',       // livreur arrivé chez le client
  DELIVERY_COMPLETED    = 'delivery.completed',     // livraison réussie
  DELIVERY_FAILED       = 'delivery.failed',        // tentative de livraison échouée
  DELIVERY_RETURNED     = 'delivery.returned',      // colis retourné à la boutique

  // ── MESSAGERIE ─────────────────────────────────────────────
  MESSAGE_RECEIVED      = 'message.received',       // nouveau message dans une conversation
  MESSAGE_UNREAD        = 'message.unread',         // rappel : messages non lus depuis Xh
  CONVERSATION_OPENED   = 'conversation.opened',    // quelqu'un initie une conversation

  // ── FOLLOW SYSTEM ──────────────────────────────────────────
  FOLLOW_NEW            = 'follow.new',             // quelqu'un s'abonne
  FOLLOW_ACCEPTED       = 'follow.accepted',        // demande acceptée (compte privé)
  FOLLOW_MUTUAL         = 'follow.mutual',          // suivi devenu mutuel

  // ── PRODUITS ───────────────────────────────────────────────
  PRODUCT_LIKED         = 'product.liked',          // quelqu'un like un produit
  PRODUCT_LIKED_AGG     = 'product.liked_agg',      // X personnes ont liké (agrégé)
  PRODUCT_OUT_OF_STOCK  = 'product.out_of_stock',   // rupture de stock
  PRODUCT_BACK_IN_STOCK = 'product.back_in_stock',  // retour en stock (abonnés alertes)
  PRODUCT_PRICE_DROP    = 'product.price_drop',     // baisse de prix
  PRODUCT_APPROVED      = 'product.approved',       // produit validé par l'admin
  PRODUCT_REJECTED      = 'product.rejected',       // produit refusé par l'admin

  // ── PROMOTIONS ─────────────────────────────────────────────
  PROMO_ACTIVE          = 'promo.active',           // promo planifiée → active
  PROMO_ENDING_SOON     = 'promo.ending_soon',      // promo expire dans 24h
  PROMO_ENDED           = 'promo.ended',            // promo terminée
  PROMO_USED            = 'promo.used',             // un client a utilisé un code promo
  PROMO_LIMIT_REACHED   = 'promo.limit_reached',    // limite d'utilisations atteinte

  // ── PAIEMENTS ──────────────────────────────────────────────
  PAYMENT_RECEIVED      = 'payment.received',       // paiement reçu (entreprise)
  PAYMENT_SENT          = 'payment.sent',           // commission versée (livreur/correspondant)
  PAYMENT_FAILED        = 'payment.failed',         // échec de paiement
  PAYMENT_REFUND_DONE   = 'payment.refund_done',    // remboursement effectué

  // ── AVIS & NOTES ───────────────────────────────────────────
  REVIEW_RECEIVED       = 'review.received',        // avis reçu (entreprise/livreur/correspondant)
  REVIEW_REPLIED        = 'review.replied',         // réponse à un avis

  // ── STOCKS ─────────────────────────────────────────────────
  STOCK_LOW             = 'stock.low',              // stock sous le seuil d'alerte
  STOCK_CRITICAL        = 'stock.critical',         // stock = 0

  // ── STORIES ────────────────────────────────────────────────
  STORY_PUBLISHED       = 'story.published',        // nouvelle story d'une boutique suivie
  STORY_EXPIRING_SOON   = 'story.expiring_soon',    // story expire dans 1h (pour l'entreprise)

  // ── COLIS CORRESPONDANT ────────────────────────────────────
  COLIS_DEPOSITED       = 'colis.deposited',        // colis déposé au relais
  COLIS_AWAITING        = 'colis.awaiting',         // colis en attente de récupération
  COLIS_URGENT          = 'colis.urgent',           // colis non récupéré depuis 48h
  COLIS_TRANSFERRED     = 'colis.transferred',      // transfert vers livreur confirmé
  COLIS_RETURN          = 'colis.return',           // retour initié

  // ── COMPTE & ADMIN ─────────────────────────────────────────
  ACCOUNT_APPROVED      = 'account.approved',       // compte validé par admin
  ACCOUNT_SUSPENDED     = 'account.suspended',      // compte suspendu
  ACCOUNT_BANNED        = 'account.banned',         // compte banni
  ACCOUNT_VERIFIED      = 'account.verified',       // vérification identité OK
  INVITATION_CODE_USED  = 'invitation.code_used',   // code d'invitation utilisé

  // ── SYSTÈME ────────────────────────────────────────────────
  SYSTEM_MAINTENANCE    = 'system.maintenance',     // maintenance planifiée
  SYSTEM_ANNOUNCEMENT   = 'system.announcement',    // annonce globale Shopi
}

/**
 * Canaux de livraison disponibles pour une notification.
 */
export enum NotificationChannel {
  IN_APP = 'in_app', // liste de notifications dans l'interface (défaut)
  PUSH   = 'push',   // notification push mobile (FCM pour Android, APNs pour iOS)
  EMAIL  = 'email',  // email HTML (SendGrid)
  SMS    = 'sms',    // SMS (opérateurs locaux +224)
}

/**
 * Niveaux de priorité d'une notification.
 *
 * LOW    → information (badge silencieux, pas de son)
 * NORMAL → standard (son par défaut)
 * HIGH   → urgent (son fort, vibration)
 * URGENT → critique (alerte même en mode silencieux, ex: paiement échoué)
 */
export enum NotificationPriority {
  LOW    = 'low',
  NORMAL = 'normal',
  HIGH   = 'high',
  URGENT = 'urgent',
}

// ─────────────────────────────────────────────────────────────
// ENTITÉ
// ─────────────────────────────────────────────────────────────

@Index('IDX_notif_recipient',    ['recipientType', 'recipientId', 'isRead'])
@Index('IDX_notif_recipient_dt', ['recipientType', 'recipientId', 'createdAt'])
@Index('IDX_notif_type',         ['type'])
@Index('IDX_notif_expires',      ['expiresAt'])
@Index('IDX_notif_group',        ['recipientId', 'groupKey'])
@Entity('notifications')
export class Notification {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * DESTINATAIRE  (polymorphique)
   * ========================================================== */

  /**
   * Type de l'acteur qui reçoit cette notification.
   *
   * ✅ FIX TYPEORM : enum: NotificationActorType obligatoire.
   */
  @Column({
    type: 'enum',
    enum: NotificationActorType,
  })
  recipientType: NotificationActorType;

  /**
   * UUID du profil destinataire.
   *
   * Pointe dynamiquement vers :
   *   client        → clients.id
   *   company       → companies.id
   *   delivery      → deliveries.id
   *   correspondent → correspondants.id
   *   partner       → partners.id
   *   admin         → admins.id
   *   super_admin   → super_admins.id
   *
   * Pas de FK TypeORM — résolu dans les SERVICES.
   */
  @Column({ type: 'uuid' })
  recipientId: string;

  /* ==========================================================
   * ACTEUR DÉCLENCHEUR  (polymorphique — optionnel)
   * ========================================================== */

  /**
   * Type de l'acteur qui a déclenché l'événement.
   *
   * null = notification automatique (CRON, règle métier, système).
   *
   * Ex: FOLLOW_NEW → actorType = CLIENT (qui s'est abonné)
   * Ex: STOCK_LOW  → actorType = null   (déclenché par CRON)
   *
   * ✅ FIX TYPEORM : enum: NotificationActorType obligatoire.
   */
  @Column({
    type:     'enum',
    enum:     NotificationActorType,
    nullable: true,
  })
  actorType: NotificationActorType | null;

  /**
   * UUID du profil de l'acteur déclencheur.
   * null si notification automatique système.
   */
  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  /* ==========================================================
   * TYPE ET CANAL
   * ========================================================== */

  /**
   * Type de l'événement qui a déclenché cette notification.
   *
   * Utilisé par le frontend pour afficher le bon template,
   * la bonne icône et la bonne couleur.
   *
   * ✅ FIX TYPEORM : enum: NotificationType obligatoire.
   */
  @Index()
  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  /**
   * Canal par lequel cette notification a été envoyée.
   *
   * IN_APP → toujours créé (liste des notifications)
   * PUSH   → si l'acteur a un token FCM/APNs enregistré
   * EMAIL  → si l'acteur a activé les emails
   * SMS    → si l'acteur a activé les SMS
   *
   * ✅ FIX TYPEORM : enum: NotificationChannel obligatoire.
   */
  @Column({
    type:    'enum',
    enum:    NotificationChannel,
    default: NotificationChannel.IN_APP,
  })
  channel: NotificationChannel;

  /**
   * Niveau de priorité de la notification.
   *
   * Influence : son, vibration, wake-screen sur mobile.
   *
   * ✅ FIX TYPEORM : enum: NotificationPriority obligatoire.
   */
  @Column({
    type:    'enum',
    enum:    NotificationPriority,
    default: NotificationPriority.NORMAL,
  })
  priority: NotificationPriority;

  /* ==========================================================
   * CONTENU
   * ========================================================== */

  /**
   * Titre affiché dans la notification.
   *
   * Ex: "Nouvelle commande reçue 💰"
   * Ex: "Mamadou D. est en route 🛵"
   *
   * Limité à 100 caractères (contrainte mobile push).
   */
  @Column({ type: 'varchar', length: 100 })
  title: string;

  /**
   * Corps de la notification — texte principal.
   *
   * Ex: "iPhone 15 Pro · 12 500 000 GNF · Kaloum, Conakry"
   * Ex: "Votre code SHOPI20 expire dans 24 heures."
   *
   * Limité à 255 caractères (contrainte mobile push).
   */
  @Column({ type: 'varchar', length: 255 })
  body: string;

  /**
   * URL ou deep link vers la ressource concernée.
   *
   * Utilisé quand l'acteur clique sur la notification.
   *
   * Exemples :
   *   /commandes/uuid-commande
   *   /chat/uuid-conversation
   *   /produit/iphone-15-pro-256gb
   *   /dashboard/colis
   *
   * null = notification sans action (ex: annonce système).
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  actionUrl: string | null;

  /**
   * Données contextuelles JSON de la notification.
   *
   * Permet au frontend d'afficher le bon template sans
   * recharger la ressource depuis l'API.
   *
   * Structure suggérée (varie selon le type) :
   *   ORDER_CONFIRMED  → { orderId, orderRef, totalAmount, productCount }
   *   DELIVERY_EN_ROUTE→ { deliveryId, livreurName, eta, latitude, longitude }
   *   MESSAGE_RECEIVED → { conversationId, senderName, senderAvatar, preview }
   *   PRODUCT_LIKED    → { productId, productName, likerName, likerAvatar }
   *   PROMO_ENDING_SOON→ { promoId, promoCode, expiresAt, usesLeft }
   *   STOCK_LOW        → { productId, productName, currentStock, threshold }
   *
   * Non exposé directement — enveloppé dans la réponse API.
   */
  @Column({ type: 'json', nullable: true })
  payload: Record<string, unknown> | null;

  /**
   * URL de l'image/avatar à afficher dans la notification.
   *
   * Exemples :
   *   → avatar de l'acteur déclencheur (abonné, acheteur…)
   *   → image principale du produit liké
   *   → logo de l'entreprise expéditrice
   *
   * null = icône par défaut selon le type.
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  /* ==========================================================
   * ÉTAT DE LECTURE
   * ========================================================== */

  /**
   * true si la notification a été lue par le destinataire.
   *
   * Mis à jour par NotificationService.markAsRead()
   * quand l'acteur clique sur la notification ou ouvre
   * la liste des notifications.
   */
  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  /**
   * Date à laquelle la notification a été lue.
   * null = non lue.
   */
  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;

  /**
   * true si la notification a été envoyée avec succès
   * sur le canal sélectionné (PUSH, EMAIL, SMS).
   *
   * false = échec d'envoi (token FCM invalide, email bounced…)
   * Loggé dans notification_delivery_logs.
   */
  @Column({ type: 'boolean', default: false })
  isSent: boolean;

  /**
   * Date d'envoi effectif sur le canal de livraison.
   * null = pas encore envoyé ou IN_APP uniquement.
   */
  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date | null;

  /* ==========================================================
   * AGRÉGATION  (évite le spam de notifications)
   * ========================================================== */

  /**
   * Clé de regroupement pour agréger les notifications similaires.
   *
   * Format suggéré : "{type}:{resourceType}:{resourceId}"
   *
   * Exemples :
   *   "product.liked:product:uuid-produit"
   *   "follow.new:company:uuid-boutique"
   *   "message.received:conversation:uuid-conv"
   *
   * null = notification isolée (pas d'agrégation).
   *
   * Utilisé par le NotificationService pour :
   *   1. Vérifier si une notification similaire existe déjà
   *   2. Si oui → incrémenter count plutôt que créer une nouvelle ligne
   *   3. Mettre à jour body : "Fatoumata et 9 autres ont liké ❤️"
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  groupKey: string | null;

  /**
   * Nombre d'événements agrégés dans cette notification.
   *
   * 1    = notification simple
   * 2+   = notification agrégée
   *
   * Ex: count = 10 → "Fatoumata et 9 autres ont liké votre produit ❤️"
   */
  @Column({ type: 'int', default: 1 })
  count: number;

  /* ==========================================================
   * EXPIRATION
   * ========================================================== */

  /**
   * Date d'expiration automatique de la notification.
   *
   * null = notification persistante (gardée indéfiniment).
   *
   * Exemples d'utilisation :
   *   PROMO_ENDING_SOON → expiresAt = expiresAt de la promo
   *   STORY_EXPIRING    → expiresAt = expiresAt de la story
   *   DELIVERY_EN_ROUTE → expiresAt = now + 4h (devient obsolète)
   *
   * Un CRON job (notification-expiry.job.ts) supprime
   * ou archive les notifications expirées toutes les heures.
   */
  @Index()
  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  /* ==========================================================
   * RÉFÉRENCE À LA RESSOURCE CONCERNÉE
   * ========================================================== */

  /**
   * Type de la ressource principale concernée par la notification.
   *
   * Ex: 'order', 'product', 'conversation', 'delivery', 'promo'
   *
   * Permet au frontend de naviguer vers la bonne ressource
   * sans parser l'actionUrl.
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  resourceType: string | null;

  /**
   * UUID de la ressource principale concernée.
   *
   * Ex: orderId, productId, conversationId, deliveryId, promoId
   *
   * Pas de FK TypeORM — résolu dans les SERVICES.
   */
  @Column({ type: 'uuid', nullable: true })
  resourceId: string | null;

  /* ==========================================================
   * TIMESTAMPS
   * ========================================================== */

  @CreateDateColumn()
  createdAt: Date;

  /**
   * Mis à jour quand :
   *   - la notification est lue (isRead → true)
   *   - la notification est agrégée (count++)
   *   - l'envoi est confirmé (isSent → true)
   */
  @UpdateDateColumn()
  updatedAt: Date;
}