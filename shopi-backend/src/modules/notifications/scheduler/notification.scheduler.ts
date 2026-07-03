/* ============================================================
 * FICHIER : src/modules/notifications/scheduler/notification.scheduler.ts
 *
 * RÔLE : Tâches planifiées du système de notifications.
 *
 * TÂCHES :
 *   expireNotifications() → toutes les heures
 *     Supprime les notifications dont expiresAt < NOW().
 *
 *   retryFailedDeliveries() → toutes les 5 minutes
 *     Enqueued les delivery logs FAILED dont nextRetryAt <= NOW().
 *
 *   cleanupOldLogs() → tous les jours à 3h
 *     Supprime les NotificationDeliveryLog > 90 jours.
 *
 * PRÉREQUIS : ScheduleModule.forRoot() doit être importé.
 *   Il l'est déjà via JobsModule (src/jobs/jobs.module.ts).
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository }     from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { InjectQueue }          from '@nestjs/bullmq';
import type { Queue }           from 'bullmq';

import { NotificationRepository }
  from '../repositories/notification.repository';
import {
  NotificationDeliveryLog,
  DeliveryLogStatus,
} from 'src/database/entities/notification/notification-delivery-log.entity';
import { NOTIFICATION_QUEUE, NOTIFICATION_JOBS } from '../queue/notification.queue';
import { NotificationReminderService } from '../services/notification-reminder.service';

@Injectable()
export class NotificationScheduler {

  private readonly logger = new Logger(NotificationScheduler.name);

  constructor(
    private readonly notifRepo:     NotificationRepository,
    private readonly reminderSvc:   NotificationReminderService,

    @InjectRepository(NotificationDeliveryLog)
    private readonly logRepo: Repository<NotificationDeliveryLog>,

    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly queue: Queue,
  ) {}

  // ─────────────────────────────────────────────────────────
  // EXPIRATION  (toutes les heures)
  // ─────────────────────────────────────────────────────────

  /**
   * Supprime les notifications dont expiresAt est dépassé.
   *
   * Exemples de notifications expirables :
   *   - PROMO_ENDING_SOON → expiresAt = fin de la promo
   *   - STORY_EXPIRING    → expiresAt = fin de la story
   *   - DELIVERY_EN_ROUTE → expiresAt = now + 4h
   *
   * Les DeliveryLogs sont supprimés par CASCADE.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async expireNotifications(): Promise<void> {
    try {
      const deleted = await this.notifRepo.deleteExpired();
      if (deleted > 0) {
        this.logger.log(`♻️  Expiré ${deleted} notification(s)`);
      }
    } catch (err) {
      this.logger.error('Erreur expireNotifications', err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // RETRY DES LIVRAISONS ÉCHOUÉES  (toutes les 5 min)
  // ─────────────────────────────────────────────────────────

  /**
   * Cherche les delivery logs FAILED dont nextRetryAt <= NOW()
   * et les enqueued dans BullMQ pour retry.
   *
   * Conditions de retry :
   *   - status = FAILED
   *   - isPermanentFailure = false
   *   - attemptNumber < maxAttempts
   *   - nextRetryAt <= NOW()
   */
  @Cron('*/5 * * * *')
  async retryFailedDeliveries(): Promise<void> {
    try {
      const now = new Date();

      const failedLogs = await this.logRepo.find({
        where: {
          status:             DeliveryLogStatus.FAILED,
          isPermanentFailure: false,
          nextRetryAt:        LessThanOrEqual(now),
        },
        select: ['id', 'attemptNumber', 'maxAttempts'],
        take:   50,  // batch de 50 par cycle
      });

      // Filtrer ceux qui ont encore des tentatives disponibles
      const toRetry = failedLogs.filter(
        l => l.attemptNumber < l.maxAttempts,
      );

      if (toRetry.length === 0) return;

      // Enqueued chaque log pour retry
      const jobs = toRetry.map(log =>
        this.queue.add(
          NOTIFICATION_JOBS.RETRY,
          { deliveryLogId: log.id },
          {
            priority:         5,
            attempts:         1,
            removeOnComplete: true,
            removeOnFail:     false,
          },
        ),
      );

      await Promise.allSettled(jobs);

      this.logger.log(`🔄 ${toRetry.length} delivery log(s) en retry`);
    } catch (err) {
      this.logger.error('Erreur retryFailedDeliveries', err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // NETTOYAGE DES VIEUX LOGS  (quotidien à 3h du matin)
  // ─────────────────────────────────────────────────────────

  /**
   * Supprime les NotificationDeliveryLog de plus de 90 jours.
   *
   * Conformité RGPD : les logs d'envoi (email, SMS, push)
   * ne sont conservés que 90 jours (preuve d'envoi).
   */
  @Cron('0 3 * * *')
  async cleanupOldLogs(): Promise<void> {
    try {
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - 90);

      const result = await this.logRepo
        .createQueryBuilder()
        .delete()
        .from(NotificationDeliveryLog)
        .where('createdAt < :threshold', { threshold })
        .execute();

      const deleted = result.affected ?? 0;
      if (deleted > 0) {
        this.logger.log(`🗑️  Supprimé ${deleted} delivery log(s) de plus de 90 jours`);
      }
    } catch (err) {
      this.logger.error('Erreur cleanupOldLogs', err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // DIGEST DES NON LUES  (quotidien à 09h00)
  // ─────────────────────────────────────────────────────────

  /**
   * Enqueue un job REMINDER pour chaque acteur ayant des
   * notifications non lues depuis plus de 24h.
   *
   * Protection anti-spam :
   *   - lastSeenAt doit être null ou > 24h
   *   - groupKey "digest:{type}:{id}" empêche une 2ème notif
   *     dans la même fenêtre d'agrégation (24h)
   *
   * Limite : 500 acteurs par cycle pour éviter de saturer la queue.
   */
  @Cron('0 9 * * *')
  async sendUnreadReminders(): Promise<void> {
    try {
      const recipients = await this.reminderSvc.findRecipientsWithUnread(1, 500);
      if (recipients.length === 0) return;

      const jobs = recipients.map(r =>
        this.queue.add(
          NOTIFICATION_JOBS.REMINDER,
          { actorType: r.actorType, actorId: r.actorId, unreadCount: r.unreadCount },
          {
            priority:         10,   // basse priorité (yield aux dispatch/retry)
            attempts:         2,
            removeOnComplete: true,
            removeOnFail:     false,
          },
        ),
      );

      await Promise.allSettled(jobs);

      this.logger.log(`📬 ${recipients.length} digest(s) de rappel enqueués`);
    } catch (err) {
      this.logger.error('Erreur sendUnreadReminders', err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // PURGE DES VIEILLES NOTIFICATIONS LUES  (hebdo dimanche 04h)
  // ─────────────────────────────────────────────────────────

  /**
   * Supprime les notifications LUES de plus de 30 jours.
   *
   * Les notifications non lues ne sont jamais supprimées ici
   * (seulement via expiresAt ou action utilisateur).
   *
   * Les DeliveryLogs associés sont supprimés par CASCADE.
   */
  @Cron('0 4 * * 0') // Dimanche à 04h00
  async purgeReadNotifications(): Promise<void> {
    try {
      const deleted = await this.notifRepo.deleteOldRead(30);
      if (deleted > 0) {
        this.logger.log(`🧹 Purgé ${deleted} notification(s) lue(s) de plus de 30 jours`);
      }
    } catch (err) {
      this.logger.error('Erreur purgeReadNotifications', err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // SURVEILLANCE DLQ  (toutes les 6 heures)
  // ─────────────────────────────────────────────────────────

  /**
   * Inspecte les jobs BullMQ en état "failed" (épuisement des retries).
   *
   * Ces jobs ont subi 3 tentatives et restent dans Redis avec
   * removeOnFail: false. Ce CRON les loggue pour alerter l'équipe
   * (Sentry / Grafana / ELK pourront les capturer via le logger).
   *
   * Traitement : log ERROR par job échoué + compteur global.
   * Action manuelle possible : redis-cli / BullMQ dashboard.
   */
  @Cron('0 */6 * * *')
  async processDlq(): Promise<void> {
    try {
      const failedCount = await this.queue.getFailedCount();
      if (failedCount === 0) return;

      this.logger.warn(`🚨 DLQ: ${failedCount} job(s) définitivement échoué(s) dans la queue`);

      // Inspecter jusqu'à 100 jobs pour le log détaillé
      const cap      = Math.min(failedCount, 100);
      const failedJobs = await this.queue.getFailed(0, cap - 1);

      for (const job of failedJobs) {
        this.logger.error(
          `DLQ job "${job.name}" id=${job.id} — ${job.failedReason}`,
          {
            data:         job.data,
            attemptsMade: job.attemptsMade,
            timestamp:    job.finishedOn
              ? new Date(job.finishedOn).toISOString()
              : 'unknown',
          },
        );
      }
    } catch (err) {
      this.logger.error('Erreur processDlq', err);
    }
  }
}
