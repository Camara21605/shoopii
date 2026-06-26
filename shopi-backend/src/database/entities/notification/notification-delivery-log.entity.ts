/* ============================================================
 * FICHIER : src/database/entities/notification/notification-delivery-log.entity.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Journal de livraison des notifications sur les canaux
 * externes : PUSH (FCM/APNs), EMAIL, SMS.
 *
 * Chaque ligne représente :
 *
 *    "UNE tentative d'envoi d'UNE notification sur UN canal"
 *
 * Les notifications IN_APP ne sont PAS loggées ici
 * (elles sont directement créées dans notifications).
 *
 * ------------------------------------------------------------
 * POURQUOI CETTE TABLE ?
 * ------------------------------------------------------------
 *
 * Pour chaque notification envoyée sur un canal externe :
 *
 *   1. AUDIT COMPLET
 *      → savoir exactement si la notification a été livrée
 *      → diagnostiquer les échecs (token expiré, email bounced…)
 *
 *   2. RETRY AUTOMATIQUE
 *      → si status = FAILED, le job notification-retry.job.ts
 *        tente de renvoyer (max 3 tentatives par défaut)
 *
 *   3. ANALYTICS
 *      → taux de livraison par canal
 *      → délai moyen d'envoi
 *      → types de notifications les plus envoyées
 *
 *   4. CONFORMITÉ RGPD
 *      → traçabilité complète des communications
 *      → preuve d'envoi (email légal, SMS important)
 *
 * ------------------------------------------------------------
 * EXEMPLES
 * ------------------------------------------------------------
 *
 * Notification ORDER_CONFIRMED envoyée à un CLIENT :
 *
 *   → Log 1 : channel = PUSH
 *              provider = 'fcm'
 *              status = SUCCESS
 *              providerMessageId = "fcm-msg-id-xxx"
 *              sentAt = "14:32:01"
 *              deliveredAt = "14:32:02"
 *
 *   → Log 2 : channel = EMAIL
 *              provider = 'sendgrid'
 *              status = SUCCESS
 *              providerMessageId = "sg-msg-id-yyy"
 *              sentAt = "14:32:03"
 *              deliveredAt = null (email: pas de confirmation)
 *
 * Notification PUSH échouée (token FCM invalide) :
 *
 *   → Log 3 : channel = PUSH
 *              provider = 'fcm'
 *              status = FAILED
 *              errorCode = "registration-token-not-registered"
 *              errorMessage = "Token FCM invalide ou expiré"
 *              attemptNumber = 1
 *              nextRetryAt = now + 5min
 *
 * ------------------------------------------------------------
 * RÈGLES MÉTIER
 * ------------------------------------------------------------
 *
 *  1. Créé par NotificationService.dispatch() après chaque
 *     tentative d'envoi sur un canal externe.
 *
 *  2. En cas d'ÉCHEC :
 *     → status = FAILED
 *     → errorCode + errorMessage renseignés
 *     → nextRetryAt calculé (backoff exponentiel)
 *     → notification-retry.job.ts tente à nouveau
 *       jusqu'à maxAttempts (défaut : 3)
 *
 *  3. Si token FCM invalide :
 *     → errorCode = "invalid-token"
 *     → le SERVICE nettoie le token de notification_preferences
 *
 *  4. Les logs > 90 jours sont archivés ou supprimés par CRON.
 *
 * ------------------------------------------------------------
 * RELATIONS
 * ------------------------------------------------------------
 *
 *  NotificationDeliveryLog ──(ManyToOne)──► Notification
 *    → Un log appartient à une seule notification
 *    → onDelete CASCADE : supprimé avec la notification
 *
 * ------------------------------------------------------------
 * INDEX
 * ------------------------------------------------------------
 *
 *  IDX_ndl_notification   → notificationId
 *    → tous les logs d'une notification (résultat par canal)
 *
 *  IDX_ndl_status_retry   → (status, nextRetryAt)
 *    → CRON de retry : WHERE status = 'failed' AND nextRetryAt <= NOW()
 *
 *  IDX_ndl_channel        → channel
 *    → analytics par canal
 *
 *  IDX_ndl_created        → createdAt
 *    → nettoyage des vieux logs
 *
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, Index,
} from 'typeorm';
import { Notification, NotificationChannel } from './notification.entitiy';

// ─── ENUMS ────────────────────────────────────────────────────

/**
 * Statut d'une tentative d'envoi sur un canal externe.
 *
 * PENDING   → en attente d'envoi (dans la queue)
 * SENT      → envoyé au fournisseur (pas encore confirmé livré)
 * DELIVERED → confirmé livré sur l'appareil (PUSH uniquement via FCM callback)
 * FAILED    → échec d'envoi (token invalide, bounced, réseau…)
 * SKIPPED   → ignoré (préférence désactivée, DND actif, token manquant)
 */
export enum DeliveryLogStatus {
  PENDING   = 'pending',
  SENT      = 'sent',
  DELIVERED = 'delivered',
  FAILED    = 'failed',
  SKIPPED   = 'skipped',
}

/**
 * Fournisseur tiers utilisé pour l'envoi.
 *
 * FCM       → Firebase Cloud Messaging (Android push)
 * APNS      → Apple Push Notification Service (iOS push)
 * WEB_PUSH  → Web Push (navigateur)
 * SENDGRID  → SendGrid (email transactionnel)
 * NODEMAILER→ Nodemailer SMTP (email dev/local)
 * TWILIO    → Twilio (SMS international)
 * ORANGE_GN → Orange Guinée (SMS local +224)
 * MTN_GN    → MTN Guinée (SMS local +224)
 * INTERNAL  → envoi interne sans fournisseur tiers (IN_APP)
 */
export enum DeliveryProvider {
  FCM        = 'fcm',
  APNS       = 'apns',
  WEB_PUSH   = 'web_push',
  SENDGRID   = 'sendgrid',
  NODEMAILER = 'nodemailer',
  TWILIO     = 'twilio',
  ORANGE_GN  = 'orange_gn',
  MTN_GN     = 'mtn_gn',
  INTERNAL   = 'internal',
}

// ─────────────────────────────────────────────────────────────
// ENTITÉ
// ─────────────────────────────────────────────────────────────

@Index('IDX_ndl_notification', ['notificationId'])
@Index('IDX_ndl_status_retry', ['status', 'nextRetryAt'])
@Index('IDX_ndl_channel',      ['channel'])
@Index('IDX_ndl_created',      ['createdAt'])
@Entity('notification_delivery_logs')
export class NotificationDeliveryLog {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * NOTIFICATION PARENTE
   * ========================================================== */

  /**
   * Notification concernée par ce log de livraison.
   *
   * onDelete CASCADE :
   *   si la notification est supprimée, ses logs le sont aussi.
   */
  @ManyToOne(() => Notification, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'notificationId' })
  notification: Notification;

  @Column({ name: 'notificationId', type: 'varchar', length: 36 })
  notificationId: string;

  /* ==========================================================
   * CANAL ET FOURNISSEUR
   * ========================================================== */

  /**
   * Canal sur lequel la tentative d'envoi a été faite.
   *
   * PUSH  → push mobile (FCM ou APNs)
   * EMAIL → email HTML (SendGrid)
   * SMS   → SMS (Twilio, Orange GN, MTN GN)
   *
   * Les IN_APP ne génèrent PAS de delivery log.
   *
   * ✅ FIX TYPEORM : enum: NotificationChannel obligatoire.
   */
  @Column({
    type: 'enum',
    enum: NotificationChannel,
  })
  channel: NotificationChannel;

  /**
   * Fournisseur tiers utilisé pour cet envoi.
   *
   * Permet de savoir exactement quel service a été contacté
   * et facilite le diagnostic des erreurs.
   *
   * ✅ FIX TYPEORM : enum: DeliveryProvider obligatoire.
   */
  @Column({
    type: 'enum',
    enum: DeliveryProvider,
  })
  provider: DeliveryProvider;

  /* ==========================================================
   * STATUT DE LA TENTATIVE
   * ========================================================== */

  /**
   * Résultat de cette tentative d'envoi.
   *
   * PENDING   → en attente dans la queue (BullMQ)
   * SENT      → envoyé au fournisseur avec succès
   * DELIVERED → confirmation de livraison reçue (FCM uniquement)
   * FAILED    → erreur retournée par le fournisseur
   * SKIPPED   → ignoré (préférence off, DND, token manquant)
   *
   * ✅ FIX TYPEORM : enum: DeliveryLogStatus obligatoire.
   */
  @Index()
  @Column({
    type:    'enum',
    enum:    DeliveryLogStatus,
    default: DeliveryLogStatus.PENDING,
  })
  status: DeliveryLogStatus;

  /* ==========================================================
   * IDENTIFIANTS FOURNISSEUR  (pour le suivi)
   * ========================================================== */

  /**
   * Identifiant du message retourné par le fournisseur.
   *
   * Permet de tracer le message chez le fournisseur en cas
   * de litige ou d'audit.
   *
   * Ex FCM      : "projects/shopi/messages/0:1234567890"
   * Ex SendGrid : "sg-msg-id-abc123"
   * Ex Twilio   : "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   * null si FAILED ou PENDING.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  providerMessageId: string | null;

  /**
   * Token push utilisé pour cet envoi (PUSH uniquement).
   *
   * Stocké pour pouvoir identifier quel token a échoué
   * et le nettoyer dans notification_preferences.
   * Partiel pour la sécurité (les 20 derniers caractères).
   *
   * null pour EMAIL et SMS.
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  tokenUsed: string | null;

  /**
   * Adresse email utilisée pour cet envoi (EMAIL uniquement).
   * null pour PUSH et SMS.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  emailUsed: string | null;

  /**
   * Numéro de téléphone utilisé pour cet envoi (SMS uniquement).
   * Format E.164 : "+224622345678"
   * null pour PUSH et EMAIL.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  phoneUsed: string | null;

  /* ==========================================================
   * GESTION DES ERREURS
   * ========================================================== */

  /**
   * Code d'erreur retourné par le fournisseur en cas d'échec.
   *
   * Exemples FCM :
   *   "registration-token-not-registered" → token expiré → nettoyer
   *   "message-rate-exceeded"             → rate limit → retry
   *   "invalid-argument"                  → payload invalide → pas de retry
   *
   * Exemples SendGrid :
   *   "invalid_email"     → email invalide
   *   "bounce"            → email bounced
   *
   * null si succès.
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  errorCode: string | null;

  /**
   * Message d'erreur lisible retourné par le fournisseur.
   * null si succès.
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  errorMessage: string | null;

  /**
   * true si l'erreur est permanente et qu'un retry est inutile.
   *
   * Ex: token FCM "registration-token-not-registered" = définitif
   * Ex: rate limit FCM = temporaire → retry OK
   *
   * Calculé par NotificationService selon errorCode.
   */
  @Column({ type: 'boolean', default: false })
  isPermanentFailure: boolean;

  /* ==========================================================
   * RETRY  (tentatives automatiques)
   * ========================================================== */

  /**
   * Numéro de la tentative actuelle.
   *
   * 1 = première tentative
   * 2 = premier retry
   * 3 = deuxième retry (dernier par défaut)
   */
  @Column({ type: 'int', default: 1 })
  attemptNumber: number;

  /**
   * Nombre maximum de tentatives autorisées.
   * Défaut : 3.
   * Configurable par type de notification (URGENT peut avoir plus).
   */
  @Column({ type: 'int', default: 3 })
  maxAttempts: number;

  /**
   * Date de la prochaine tentative (backoff exponentiel).
   *
   * Calculé par le job notification-retry.job.ts :
   *   attempt 1 → now + 5min
   *   attempt 2 → now + 15min
   *   attempt 3 → now + 30min
   *
   * null si succès ou si isPermanentFailure = true.
   *
   * Le CRON query : WHERE status = 'failed' AND nextRetryAt <= NOW()
   *                 AND attemptNumber < maxAttempts
   *                 AND isPermanentFailure = false
   */
  @Index()
  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt: Date | null;

  /* ==========================================================
   * TIMESTAMPS D'ENVOI
   * ========================================================== */

  /**
   * Date à laquelle la tentative d'envoi a été lancée.
   * Différent de createdAt (le log peut être créé en avance).
   */
  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date | null;

  /**
   * Date à laquelle le fournisseur a confirmé la livraison.
   *
   * Disponible UNIQUEMENT pour PUSH via FCM (callback de livraison).
   * Toujours null pour EMAIL et SMS (pas de confirmation de lecture).
   */
  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date | null;

  /**
   * Durée de l'appel API au fournisseur en millisecondes.
   *
   * Ex: 234 ms pour FCM, 1200 ms pour SendGrid.
   * Utilisé pour les analytics de performance des fournisseurs.
   */
  @Column({ type: 'int', nullable: true })
  durationMs: number | null;

  /* ==========================================================
   * TIMESTAMP DE CRÉATION DU LOG
   * ========================================================== */

  @CreateDateColumn()
  createdAt: Date;
}