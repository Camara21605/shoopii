/* ============================================================
 * FICHIER : src/modules/notifications/services/notification-dispatch.service.ts
 *
 * RÔLE : Orchestre la livraison d'une notification sur ses canaux.
 *
 * APPELÉ PAR :
 *   - NotificationProcessor (depuis BullMQ — async)
 *   - InAppChannelStrategy  (depuis NotificationService — sync)
 *
 * FLUX COMPLET :
 *   1. Recharger la notification depuis la DB (données fraîches)
 *   2. Charger les préférences du destinataire
 *   3. Pour chaque canal : canSend() → deliver() → log
 *   4. Mise à jour isSent sur la notification si succès
 *
 * PATTERN STRATEGY :
 *   NOTIFICATION_CHANNEL_STRATEGIES = tableau de tous les IChannelStrategy.
 *   Le dispatch ne connaît pas les fournisseurs concrets.
 * ============================================================ */

import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import {
  Notification, NotificationChannel,
} from 'src/database/entities/notification/notification.entitiy';
import {
  NotificationPreference,
} from 'src/database/entities/notification/notification-preference.entity';
import {
  NotificationDeliveryLog,
  DeliveryLogStatus,
  DeliveryProvider,
} from 'src/database/entities/notification/notification-delivery-log.entity';
import {
  IChannelStrategy,
  NOTIFICATION_CHANNEL_STRATEGIES,
} from '../interfaces/channel-strategy.interface';
import type { IDeliveryResult } from '../interfaces/notification.interfaces';
import { NotificationPreferenceService } from './notification-preference.service';

/** Délai de backoff par numéro de tentative */
const RETRY_DELAYS_MS = [5 * 60_000, 15 * 60_000, 30 * 60_000]; // 5min, 15min, 30min

@Injectable()
export class NotificationDispatchService {

  private readonly logger = new Logger(NotificationDispatchService.name);

  constructor(
    @Inject(NOTIFICATION_CHANNEL_STRATEGIES)
    private readonly strategies: IChannelStrategy[],

    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,

    @InjectRepository(NotificationPreference)
    private readonly prefRepo: Repository<NotificationPreference>,

    @InjectRepository(NotificationDeliveryLog)
    private readonly logRepo: Repository<NotificationDeliveryLog>,

    private readonly prefService: NotificationPreferenceService,
  ) {}

  // ─────────────────────────────────────────────────────────
  // DISPATCH PRINCIPAL
  // ─────────────────────────────────────────────────────────

  /**
   * Dispatche une notification sur la liste de canaux spécifiés.
   *
   * @param notificationId UUID de la notification à dispatcher
   * @param channels       Canaux cibles (déjà filtrés selon préférences)
   */
  async dispatch(
    notificationId: string,
    channels:       NotificationChannel[],
  ): Promise<void> {
    // 1. Recharger la notification (données fraîches depuis la DB)
    const notif = await this.notifRepo.findOne({ where: { id: notificationId } });
    if (!notif) {
      this.logger.warn(`dispatch: notification ${notificationId} introuvable`);
      return;
    }

    // 2. Charger les préférences du destinataire
    const pref = await this.prefService.getOrCreate(
      notif.recipientType,
      notif.recipientId,
    );

    // 3. Dispatcher sur chaque canal demandé
    const dispatches = channels.map(channel =>
      this.dispatchToChannel(notif, pref, channel),
    );
    await Promise.allSettled(dispatches);

    // 4. Marquer la notification comme envoyée si au moins un canal succès
    const logs = await this.logRepo.find({ where: { notificationId } });
    const hasSent = logs.some(l => l.status === DeliveryLogStatus.SENT);
    if (hasSent && !notif.isSent) {
      await this.notifRepo.update(notif.id, {
        isSent: true,
        sentAt: new Date(),
      });
    }
  }

  // ─────────────────────────────────────────────────────────
  // DISPATCH PAR CANAL
  // ─────────────────────────────────────────────────────────

  /**
   * Dispatche sur un canal spécifique via la strategy correspondante.
   * Crée un NotificationDeliveryLog pour chaque tentative.
   */
  private async dispatchToChannel(
    notif:   Notification,
    pref:    NotificationPreference,
    channel: NotificationChannel,
  ): Promise<void> {
    const strategy = this.strategies.find(s => s.channel === channel);
    if (!strategy) {
      this.logger.warn(`Aucune strategy pour le canal ${channel}`);
      return;
    }

    // Vérifier si l'envoi est autorisé (DND, préférences, token…)
    if (!strategy.canSend(pref, notif)) {
      await this.createLog(notif.id, channel, {
        channel,
        success: false,
        errorCode: 'SKIPPED',
      }, DeliveryLogStatus.SKIPPED);
      return;
    }

    // Créer le log PENDING avant l'envoi
    const log = await this.createLog(notif.id, channel, {
      channel,
      success: false,
    }, DeliveryLogStatus.PENDING);

    // Tenter l'envoi
    const result = await strategy.deliver(notif, pref);

    // Mettre à jour le log avec le résultat
    await this.updateLog(log, result);
  }

  // ─────────────────────────────────────────────────────────
  // RETRY
  // ─────────────────────────────────────────────────────────

  /**
   * Retente l'envoi d'un log échoué.
   * Appelé par NotificationScheduler (CRON toutes les 5min).
   */
  async retry(deliveryLogId: string): Promise<void> {
    const log = await this.logRepo.findOne({
      where: { id: deliveryLogId },
      relations: ['notification'],
    });

    if (!log) return;
    if (log.isPermanentFailure)     return;
    if (log.attemptNumber >= log.maxAttempts) return;

    const notif    = log.notification;
    const pref     = await this.prefService.getOrCreate(
      notif.recipientType,
      notif.recipientId,
    );
    const strategy = this.strategies.find(s => s.channel === log.channel);
    if (!strategy) return;

    log.attemptNumber += 1;
    log.status         = DeliveryLogStatus.PENDING;
    log.nextRetryAt    = null;
    await this.logRepo.save(log);

    const result = await strategy.deliver(notif, pref);
    await this.updateLog(log, result);
  }

  // ─────────────────────────────────────────────────────────
  // HELPERS DELIVERY LOG
  // ─────────────────────────────────────────────────────────

  private async createLog(
    notificationId: string,
    channel:        NotificationChannel,
    result:         Partial<IDeliveryResult>,
    status:         DeliveryLogStatus,
  ): Promise<NotificationDeliveryLog> {
    const log = this.logRepo.create({
      notificationId,
      channel,
      provider:    this.resolveProvider(channel),
      status,
      tokenUsed:   result.meta?.tokenUsed   ?? null,
      emailUsed:   result.meta?.emailUsed   ?? null,
      phoneUsed:   result.meta?.phoneUsed   ?? null,
      attemptNumber: 1,
      maxAttempts:   3,
    });
    return this.logRepo.save(log);
  }

  private async updateLog(
    log:    NotificationDeliveryLog,
    result: IDeliveryResult,
  ): Promise<void> {
    if (result.success) {
      log.status            = DeliveryLogStatus.SENT;
      log.sentAt            = new Date();
      log.providerMessageId = result.providerMessageId ?? null;
      log.durationMs        = result.durationMs        ?? null;
    } else {
      log.status             = DeliveryLogStatus.FAILED;
      log.errorCode          = result.errorCode        ?? null;
      log.errorMessage       = result.errorMessage     ?? null;
      log.isPermanentFailure = result.isPermanentFailure ?? false;

      // Calculer le prochain retry si possible
      if (!result.isPermanentFailure && log.attemptNumber < log.maxAttempts) {
        const delayMs  = RETRY_DELAYS_MS[log.attemptNumber - 1] ?? RETRY_DELAYS_MS[2];
        log.nextRetryAt = new Date(Date.now() + delayMs);
      }
    }
    await this.logRepo.save(log);
  }

  /** Mappe un canal vers son fournisseur par défaut */
  private resolveProvider(channel: NotificationChannel): DeliveryProvider {
    switch (channel) {
      case NotificationChannel.PUSH:   return DeliveryProvider.FCM;
      case NotificationChannel.EMAIL:  return DeliveryProvider.NODEMAILER;
      case NotificationChannel.SMS:    return DeliveryProvider.ORANGE_GN;
      case NotificationChannel.IN_APP: return DeliveryProvider.INTERNAL;
    }
  }
}
