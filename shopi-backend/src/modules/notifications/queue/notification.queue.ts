/* ============================================================
 * FICHIER : src/modules/notifications/queue/notification.queue.ts
 *
 * RÔLE : Constantes de la file d'attente BullMQ notifications.
 *
 * PHILOSOPHIE :
 *   Toute notification externe (PUSH, EMAIL, SMS) passe par BullMQ.
 *   Jamais d'appel synchrone à FCM/SendGrid/Twilio depuis une
 *   requête HTTP → la réponse est immédiate, l'envoi est async.
 *
 * ARCHITECTURE :
 *   Requête HTTP
 *     → NotificationService.create()        (synchrone — <15ms)
 *       → INSERT en base
 *       → Socket.IO emit IN_APP             (synchrone — <5ms)
 *       → BullMQ.add(DISPATCH_JOB)         (synchrone — <5ms)
 *
 *   BullMQ Worker (async)
 *     → NotificationProcessor.dispatch()
 *       → EmailChannelStrategy.deliver()   (async — 200-1500ms)
 *       → SmsChannelStrategy.deliver()     (async — 100-500ms)
 *       → PushChannelStrategy.deliver()    (async — 50-300ms)
 *
 * QUEUES :
 *   NOTIFICATION_QUEUE → dispatch, retry
 * ============================================================ */

/** Nom de la queue BullMQ — doit correspondre à @InjectQueue() */
export const NOTIFICATION_QUEUE = 'notifications';

/**
 * Types de jobs disponibles dans la queue.
 * Chaque job est traité indépendamment par le processor.
 */
export const NOTIFICATION_JOBS = {

  /**
   * Dispatcher une notification sur ses canaux externes.
   *
   * Payload : INotificationDispatchJobPayload
   * Retry   : 3 tentatives avec backoff exponentiel
   * Priority: haute pour URGENT, normale pour le reste
   *
   * Déclenché par : NotificationService.create()
   */
  DISPATCH: 'notification-dispatch',

  /**
   * Retenter l'envoi d'un canal échoué.
   *
   * Payload : { deliveryLogId: string }
   * Déclenché par : NotificationScheduler (CRON toutes les 5min)
   *
   * Cherche les NotificationDeliveryLog avec :
   *   status = FAILED
   *   isPermanentFailure = false
   *   attemptNumber < maxAttempts
   *   nextRetryAt <= NOW()
   */
  RETRY: 'notification-retry',

  /**
   * Envoyer des rappels de notifications non lues.
   *
   * Payload : { recipientType, recipientId }
   * Déclenché par : NotificationScheduler (CRON quotidien)
   *
   * Ex: "Vous avez 5 notifications non lues depuis hier"
   */
  REMINDER: 'notification-reminder',

} as const;

/** Type union des valeurs de NOTIFICATION_JOBS */
export type NotificationJobName =
  (typeof NOTIFICATION_JOBS)[keyof typeof NOTIFICATION_JOBS];
