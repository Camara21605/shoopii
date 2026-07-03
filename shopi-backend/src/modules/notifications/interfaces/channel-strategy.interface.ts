/* ============================================================
 * FICHIER : src/modules/notifications/interfaces/channel-strategy.interface.ts
 *
 * RÔLE : Contrat du Pattern Strategy pour les canaux de livraison.
 *
 * POURQUOI STRATEGY PATTERN ?
 * ----------------------------
 * Sans Strategy : NotificationDispatchService contient des if/switch
 * sur le canal → difficile à étendre, à tester, à maintenir.
 *
 * Avec Strategy :
 *   → Ajouter un canal = créer une classe + l'enregistrer.
 *     Aucun code existant n'est modifié (Open/Closed Principle).
 *   → Chaque canal est testable indépendamment.
 *   → NotificationDispatchService ne connaît PAS les fournisseurs
 *     (FCM, SendGrid, Twilio…) — uniquement l'interface.
 *
 * FLUX :
 *   NotificationDispatchService
 *     → boucle sur toutes les IChannelStrategy
 *     → filtre celles où canSend() = true
 *     → appelle deliver() sur chacune
 *     → log le résultat dans NotificationDeliveryLog
 *
 * IMPLÉMENTATIONS :
 *   - InAppChannelStrategy  → Socket.IO gateway /notifications
 *   - EmailChannelStrategy  → Nodemailer (dev) / SendGrid (prod)
 *   - SmsChannelStrategy    → Twilio / Orange GN / MTN GN
 *   - PushChannelStrategy   → FCM (Android) / APNs (iOS) / Web Push
 * ============================================================ */

import type { Notification, NotificationChannel } from 'src/database/entities/notification/notification.entitiy';
import type { NotificationPreference }            from 'src/database/entities/notification/notification-preference.entity';
import type { IDeliveryResult }                   from './notification.interfaces';

// ─────────────────────────────────────────────────────────────
// CONTRAT STRATEGY
// ─────────────────────────────────────────────────────────────

/**
 * Interface que chaque stratégie de canal DOIT implémenter.
 *
 * Règle : deliver() ne doit JAMAIS lever d'exception non gérée.
 *         En cas d'erreur fournisseur → retourner success: false.
 */
export interface IChannelStrategy {

  /**
   * Canal géré par cette stratégie.
   *
   * Utilisé par NotificationDispatchService pour mapper
   * le canal de la notification à la bonne stratégie.
   *
   * Ex: NotificationChannel.EMAIL → EmailChannelStrategy
   */
  readonly channel: NotificationChannel;

  /**
   * Vérifie si cet envoi doit être tenté.
   *
   * Contrôles intégrés (dans l'ordre) :
   *   1. Switch global du canal (globalPushEnabled, etc.)
   *   2. Mode DND actif ET priorité < URGENT ?
   *   3. Préférence par type de notification
   *   4. Token/email/phone disponible ?
   *
   * @returns false → le delivery log sera marqué SKIPPED
   */
  canSend(
    pref:  NotificationPreference,
    notif: Notification,
  ): boolean;

  /**
   * Envoie la notification via le fournisseur du canal.
   *
   * @returns IDeliveryResult complet (success ou échec détaillé)
   */
  deliver(
    notif: Notification,
    pref:  NotificationPreference,
  ): Promise<IDeliveryResult>;
}

// ─────────────────────────────────────────────────────────────
// TOKEN D'INJECTION NESTJS
// ─────────────────────────────────────────────────────────────

/**
 * Token utilisé pour injecter le tableau de toutes les stratégies
 * dans NotificationDispatchService.
 *
 * Dans notifications.module.ts :
 *   {
 *     provide: NOTIFICATION_CHANNEL_STRATEGIES,
 *     useFactory: (inApp, email, sms, push) => [inApp, email, sms, push],
 *     inject: [InAppChannelStrategy, EmailChannelStrategy, ...],
 *   }
 *
 * Dans NotificationDispatchService :
 *   constructor(
 *     @Inject(NOTIFICATION_CHANNEL_STRATEGIES)
 *     private readonly strategies: IChannelStrategy[],
 *   ) {}
 */
export const NOTIFICATION_CHANNEL_STRATEGIES = 'NOTIFICATION_CHANNEL_STRATEGIES';
