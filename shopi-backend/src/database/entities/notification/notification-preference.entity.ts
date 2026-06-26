/* ============================================================
 * FICHIER : src/database/entities/notification/notification-preference.entity.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Préférences de notification de chaque acteur Shopi.
 *
 * Chaque ligne représente :
 *
 *    "Pour UN acteur, quels TYPES de notifs sur quels CANAUX ?"
 *
 * Fonctionne comme les paramètres de notification de :
 *
 *    - Instagram  (paramètres > notifications > likes, messages…)
 *    - WhatsApp   (notifications > sons, prévisualisation…)
 *    - Amazon     (communication > emails, SMS, push…)
 *
 * ------------------------------------------------------------
 * ARCHITECTURE
 * ------------------------------------------------------------
 *
 * UNE ligne par acteur = préférences globales.
 *
 * Structure des préférences :
 *
 *    preferences (JSON) :
 *    {
 *      "order.confirmed":    { in_app: true, push: true,  email: true,  sms: false },
 *      "delivery.en_route":  { in_app: true, push: true,  email: false, sms: true  },
 *      "message.received":   { in_app: true, push: true,  email: false, sms: false },
 *      "product.liked":      { in_app: true, push: false, email: false, sms: false },
 *      "promo.ending_soon":  { in_app: true, push: true,  email: true,  sms: false },
 *      ...
 *    }
 *
 * Clé = NotificationType (ex: "order.confirmed")
 * Valeur = objet booléen par canal (in_app, push, email, sms)
 *
 * Si une clé est absente du JSON → valeurs par défaut du type.
 * Les defaults sont définis dans NotificationService.getDefaults(type).
 *
 * ------------------------------------------------------------
 * PARAMÈTRES GLOBAUX (overrides)
 * ------------------------------------------------------------
 *
 * En plus des préférences par type, des switches globaux
 * permettent de tout couper d'un coup :
 *
 *    globalPushEnabled  → false = aucun push, quelles que soient
 *                          les préférences par type
 *    globalEmailEnabled → false = aucun email
 *    globalSmsEnabled   → false = aucun SMS
 *
 * Mode "Ne pas déranger" (DNDMode) :
 *    dndEnabled         → true = mode silencieux
 *    dndStartTime       → ex: "22:00" (heure locale)
 *    dndEndTime         → ex: "08:00" (heure locale)
 *
 * En mode DND : seules les notifs URGENT sont envoyées.
 *
 * ------------------------------------------------------------
 * TOKENS DE LIVRAISON
 * ------------------------------------------------------------
 *
 * Les tokens FCM/APNs (push mobile) sont stockés ici pour
 * éviter une table séparée notification_tokens.
 *
 * Un acteur peut avoir plusieurs appareils → tableau JSON.
 *
 *    pushTokens = [
 *      { token: "fcm-token-xxx", platform: "android", updatedAt: "..." },
 *      { token: "apns-token-yyy", platform: "ios",     updatedAt: "..." }
 *    ]
 *
 * Mis à jour par le client mobile à chaque démarrage de l'app.
 *
 * ------------------------------------------------------------
 * RÈGLES MÉTIER
 * ------------------------------------------------------------
 *
 *  1. Créée automatiquement à la création du profil acteur
 *     avec les valeurs par défaut (NotificationService.createDefaults)
 *
 *  2. UNIQUE sur (actorType, actorId)
 *     → un seul profil de préférences par acteur
 *
 *  3. L'acteur peut modifier ses préférences depuis :
 *     → Dashboard > Paramètres > Notifications
 *     → PATCH /notifications/preferences
 *
 * ------------------------------------------------------------
 * INDEX
 * ------------------------------------------------------------
 *
 *  UNIQUE : (actorType, actorId)
 *    → un seul enregistrement par acteur
 *
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Unique, Index,
} from 'typeorm';
import { NotificationActorType } from './notification.entitiy';

// ─── TYPE HELPER ──────────────────────────────────────────────

/**
 * Structure d'une préférence par type de notification.
 * Chaque canal peut être activé ou désactivé indépendamment.
 */
export interface NotificationChannelPreference {
  in_app: boolean;
  push:   boolean;
  email:  boolean;
  sms:    boolean;
}

/**
 * Structure d'un token de push mobile.
 */
export interface PushToken {
  token:     string;
  platform:  'android' | 'ios' | 'web';
  deviceId?: string;    // identifiant unique de l'appareil
  updatedAt: string;    // ISO string
}

// ─────────────────────────────────────────────────────────────
// ENTITÉ
// ─────────────────────────────────────────────────────────────

@Unique('UQ_notif_pref_actor', ['actorType', 'actorId'])
@Entity('notification_preferences')
export class NotificationPreference {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * ACTEUR PROPRIÉTAIRE
   * ========================================================== */

  /**
   * Type de l'acteur propriétaire de ces préférences.
   *
   * ✅ FIX TYPEORM : enum: NotificationActorType obligatoire.
   */
  @Index()
  @Column({
    type: 'enum',
    enum: NotificationActorType,
  })
  actorType: NotificationActorType;

  /**
   * UUID du profil acteur.
   *
   * Pointe dynamiquement selon actorType :
   *   client → clients.id · company → companies.id …
   *
   * Pas de FK TypeORM — résolu dans les SERVICES.
   */
  @Index()
  @Column({ type: 'uuid' })
  actorId: string;

  /* ==========================================================
   * SWITCHES GLOBAUX  (overrides tout le reste)
   * ========================================================== */

  /**
   * false → aucun push envoyé, quelle que soit la préférence
   * par type. L'acteur ne reçoit que les IN_APP.
   */
  @Column({ type: 'boolean', default: true })
  globalPushEnabled: boolean;

  /**
   * false → aucun email envoyé.
   * Utile si l'acteur change d'email et veut pauser les envois.
   */
  @Column({ type: 'boolean', default: true })
  globalEmailEnabled: boolean;

  /**
   * false → aucun SMS envoyé.
   * Requis légalement dans certains pays (opt-out SMS).
   */
  @Column({ type: 'boolean', default: false })
  globalSmsEnabled: boolean;

  /* ==========================================================
   * MODE NE PAS DÉRANGER  (DND — Do Not Disturb)
   * ========================================================== */

  /**
   * true → mode silencieux activé.
   *
   * En DND : seules les notifications URGENT sont envoyées
   * (paiement échoué, compte suspendu, colis urgent).
   * Les autres sont créées en base (IN_APP) mais sans push/SMS.
   */
  @Column({ type: 'boolean', default: false })
  dndEnabled: boolean;

  /**
   * Heure de début du mode DND.
   * Format : "HH:MM" en heure locale de l'acteur.
   * Ex: "22:00"
   * null = DND permanent si dndEnabled = true.
   */
  @Column({ type: 'varchar', length: 5, nullable: true })
  dndStartTime: string | null;

  /**
   * Heure de fin du mode DND.
   * Format : "HH:MM" en heure locale de l'acteur.
   * Ex: "08:00"
   * null = DND permanent si dndEnabled = true.
   */
  @Column({ type: 'varchar', length: 5, nullable: true })
  dndEndTime: string | null;

  /**
   * Fuseau horaire de l'acteur pour le calcul DND.
   * Format IANA : ex "Africa/Conakry", "Europe/Paris"
   * Défaut : Africa/Conakry (GMT+0, Guinée)
   */
  @Column({ type: 'varchar', length: 50, default: 'Africa/Conakry' })
  timezone: string;

  /* ==========================================================
   * PRÉFÉRENCES PAR TYPE  (JSON flexible)
   * ========================================================== */

  /**
   * Préférences granulaires par type de notification.
   *
   * Clé = valeur du enum NotificationType
   * Valeur = { in_app, push, email, sms }
   *
   * Exemple :
   * {
   *   "order.confirmed":    { "in_app": true, "push": true,  "email": true,  "sms": false },
   *   "delivery.en_route":  { "in_app": true, "push": true,  "email": false, "sms": true  },
   *   "message.received":   { "in_app": true, "push": true,  "email": false, "sms": false },
   *   "product.liked":      { "in_app": true, "push": false, "email": false, "sms": false },
   *   "promo.ending_soon":  { "in_app": true, "push": true,  "email": true,  "sms": false },
   *   "follow.new":         { "in_app": true, "push": true,  "email": false, "sms": false },
   *   "stock.low":          { "in_app": true, "push": true,  "email": true,  "sms": false }
   * }
   *
   * Si une clé est ABSENTE → NotificationService.getDefaults(type)
   * retourne les valeurs par défaut pour ce type.
   *
   * Mis à jour par PATCH /notifications/preferences.
   */
  @Column({ type: 'json', nullable: true })
  preferences: Record<string, NotificationChannelPreference> | null;

  /* ==========================================================
   * TOKENS PUSH MOBILE  (FCM / APNs / Web Push)
   * ========================================================== */

  /**
   * Liste des tokens push pour les appareils de cet acteur.
   *
   * Un acteur peut être connecté sur plusieurs appareils.
   * Chaque token = un appareil (téléphone, tablette, web).
   *
   * Structure :
   * [
   *   {
   *     "token":    "eOx4Kz…FCM_TOKEN",
   *     "platform": "android",
   *     "deviceId": "uuid-appareil",
   *     "updatedAt": "2025-01-15T14:30:00.000Z"
   *   },
   *   {
   *     "token":    "APNS_TOKEN…",
   *     "platform": "ios",
   *     "deviceId": "uuid-iphone",
   *     "updatedAt": "2025-01-10T09:00:00.000Z"
   *   }
   * ]
   *
   * Mis à jour à chaque démarrage de l'app mobile via :
   *   POST /notifications/push-token
   *   { token, platform, deviceId }
   *
   * Nettoyé si le token retourne une erreur FCM (token invalide).
   */
  @Column({ type: 'json', nullable: true })
  pushTokens: PushToken[] | null;

  /**
   * Email de contact pour les notifications email.
   *
   * Peut être différent de l'email de connexion (user.email).
   * Ex: un livreur peut vouloir ses notifs sur un email pro.
   *
   * null = utilise user.email par défaut.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  notificationEmail: string | null;

  /**
   * Numéro de téléphone pour les notifications SMS.
   *
   * Format E.164 : "+224622345678"
   * null = utilise le phone du profil par défaut.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  notificationPhone: string | null;

  /* ==========================================================
   * STATISTIQUES  (dénormalisées)
   * ========================================================== */

  /**
   * Nombre total de notifications non lues.
   *
   * Dénormalisé pour afficher le badge sans COUNT(*).
   * Incrémenté par NotificationService.create().
   * Décrémenté par NotificationService.markAsRead().
   * Remis à 0 par NotificationService.markAllAsRead().
   */
  @Column({ type: 'int', default: 0 })
  unreadCount: number;

  /**
   * Date de la dernière lecture de la liste de notifications.
   *
   * Utilisé pour calculer les "nouvelles" depuis la dernière visite.
   * Mis à jour par PATCH /notifications/read-all.
   */
  @Column({ type: 'timestamp', nullable: true })
  lastSeenAt: Date | null;

  /* ==========================================================
   * TIMESTAMPS
   * ========================================================== */

  /**
   * Date de création (automatique à la création du profil acteur).
   */
  @CreateDateColumn()
  createdAt: Date;

  /**
   * Mis à jour à chaque modification des préférences.
   */
  @UpdateDateColumn()
  updatedAt: Date;
}