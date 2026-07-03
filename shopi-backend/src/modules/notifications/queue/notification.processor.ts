/* ============================================================
 * FICHIER : src/modules/notifications/queue/notification.processor.ts
 *
 * RÔLE : Consommateur BullMQ — traite les jobs de notification.
 *
 * JOBS TRAITÉS :
 *   notification-dispatch → appelle NotificationDispatchService.dispatch()
 *   notification-retry    → appelle NotificationDispatchService.retry()
 *   notification-reminder → TODO Phase 4 (rappels non lus)
 *
 * ROBUSTESSE :
 *   - Si le job échoue → BullMQ retente selon la config (attempts: 3)
 *   - removeOnFail: false → les jobs échoués restent pour audit
 *   - Les erreurs sont loggées mais ne font pas crasher le process
 *
 * PATTERN IDENTIQUE À : SuivisProcessor (si existant dans SuivisModule)
 * ============================================================ */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger }                from '@nestjs/common';
import type { Job }              from 'bullmq';

import {
  NOTIFICATION_QUEUE, NOTIFICATION_JOBS, NotificationJobName,
} from './notification.queue';
import { NotificationDispatchService }
  from '../services/notification-dispatch.service';
import { NotificationReminderService }
  from '../services/notification-reminder.service';
import type {
  INotificationDispatchJobPayload,
  IReminderJobPayload,
} from '../interfaces/notification.interfaces';

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {

  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly dispatchService: NotificationDispatchService,
    private readonly reminderService: NotificationReminderService,
  ) {
    super();
  }

  // ─────────────────────────────────────────────────────────
  // ROUTEUR DE JOBS
  // ─────────────────────────────────────────────────────────

  async process(job: Job<unknown, unknown, NotificationJobName>): Promise<void> {
    this.logger.debug(`Job reçu: ${job.name} id=${job.id}`);

    switch (job.name) {
      case NOTIFICATION_JOBS.DISPATCH:
        return this.handleDispatch(job as Job<INotificationDispatchJobPayload>);

      case NOTIFICATION_JOBS.RETRY:
        return this.handleRetry(job as Job<{ deliveryLogId: string }>);

      case NOTIFICATION_JOBS.REMINDER:
        return this.handleReminder(job as unknown as Job<IReminderJobPayload>);

      default:
        this.logger.warn(`Job inconnu: ${job.name}`);
    }
  }

  // ─────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────

  /**
   * Dispatche la notification sur ses canaux externes.
   * BullMQ retente 3 fois en cas d'erreur non gérée.
   */
  private async handleDispatch(
    job: Job<INotificationDispatchJobPayload>,
  ): Promise<void> {
    const { notificationId, channels } = job.data;

    this.logger.debug(
      `DISPATCH notif=${notificationId} channels=[${channels.join(',')}]`,
    );

    await this.dispatchService.dispatch(notificationId, channels);

    this.logger.debug(`DISPATCH terminé notif=${notificationId}`);
  }

  /**
   * Retente l'envoi d'un delivery log échoué.
   * Déclenché par NotificationScheduler (CRON toutes les 5min).
   */
  private async handleRetry(
    job: Job<{ deliveryLogId: string }>,
  ): Promise<void> {
    const { deliveryLogId } = job.data;

    this.logger.debug(`RETRY deliveryLog=${deliveryLogId}`);

    await this.dispatchService.retry(deliveryLogId);
  }

  /**
   * Envoie un digest récapitulatif à un acteur ayant des notifications
   * non lues depuis > 24h. Déclenché par NotificationScheduler (09h00).
   *
   * Crée une notification SYSTEM_ANNOUNCEMENT IN_APP + PUSH (si activé)
   * via NotificationReminderService.sendDigest().
   */
  private async handleReminder(job: Job<IReminderJobPayload>): Promise<void> {
    const { actorType, actorId, unreadCount } = job.data;

    this.logger.debug(
      `REMINDER ${actorType}:${actorId} — ${unreadCount} non lue(s)`,
    );

    await this.reminderService.sendDigest(actorType, actorId, unreadCount);
  }
}
