/* ============================================================
 * FICHIER : src/modules/notifications/services/notification-stats.service.ts
 *
 * RÔLE : Métriques et analytics du système de notifications.
 *        Exposé via NotificationsAdminController (/admin/notifications).
 *
 * MÉTHODES :
 *   getGlobalStats(days)     → KPIs globaux + volume par type
 *   getDeliveryRates(days)   → taux de livraison par canal
 *   getDlqStats()            → état de la file morte (retries + erreurs)
 *
 * SÉCURITÉ : ces méthodes sont appelées exclusivement depuis
 *   NotificationsAdminController qui vérifie role=admin|super_admin.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import {
  Notification,
} from 'src/database/entities/notification/notification.entitiy';
import {
  NotificationDeliveryLog,
  DeliveryLogStatus,
} from 'src/database/entities/notification/notification-delivery-log.entity';

// ─── Types retournés ──────────────────────────────────────────

export interface ITypeVolume {
  type:  string;
  count: number;
}

export interface INotificationGlobalStats {
  period:       { days: number; from: string; to: string };
  totalCreated: number;
  totalUnread:  number;
  unreadRate:   number;        // % arrondi à 1 décimale
  byType:       ITypeVolume[]; // top 10, tri décroissant
}

export interface IChannelRate {
  channel:       string;
  total:         number;
  sent:          number;
  failed:        number;
  skipped:       number;
  deliveryRate:  number;       // % (sent / (total - skipped))
  avgDurationMs: number | null;
}

export interface IDeliveryRateStats {
  period:   { days: number; from: string; to: string };
  overall:  { total: number; sent: number; failed: number; deliveryRate: number };
  byChannel: IChannelRate[];
}

export interface IDlqTopError {
  errorCode: string;
  count:     number;
}

export interface IDlqStats {
  pendingRetries:     number;
  permanentFailures:  number;
  topErrors:          IDlqTopError[];
}

// ─────────────────────────────────────────────────────────────

@Injectable()
export class NotificationStatsService {

  private readonly logger = new Logger(NotificationStatsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,

    @InjectRepository(NotificationDeliveryLog)
    private readonly logRepo: Repository<NotificationDeliveryLog>,
  ) {}

  // ─────────────────────────────────────────────────────────
  // STATS GLOBALES
  // ─────────────────────────────────────────────────────────

  /**
   * KPIs globaux sur une fenêtre glissante de `days` jours.
   *
   * - totalCreated : notifications créées dans la période
   * - totalUnread  : parmi celles-ci, combien ne sont pas lues
   * - unreadRate   : % non lues
   * - byType       : top 10 des types les plus émis
   */
  async getGlobalStats(days = 30): Promise<INotificationGlobalStats> {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1_000);
    const to   = new Date();

    // Volume par type (top 10)
    const byTypeRows = await this.notifRepo
      .createQueryBuilder('n')
      .select('n.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('n.createdAt >= :from', { from })
      .groupBy('n.type')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany<{ type: string; count: string }>();

    const byType: ITypeVolume[] = byTypeRows.map(r => ({
      type:  r.type,
      count: Number(r.count),
    }));

    const totalCreated = byType.reduce((s, r) => s + r.count, 0);

    // Total non lues dans la période
    const totalUnread = await this.notifRepo
      .createQueryBuilder('n')
      .where('n.createdAt >= :from', { from })
      .andWhere('n.isRead = false')
      .getCount();

    const unreadRate = totalCreated > 0
      ? Math.round((totalUnread / totalCreated) * 1_000) / 10
      : 0;

    return {
      period:       { days, from: from.toISOString(), to: to.toISOString() },
      totalCreated,
      totalUnread,
      unreadRate,
      byType,
    };
  }

  // ─────────────────────────────────────────────────────────
  // TAUX DE LIVRAISON PAR CANAL
  // ─────────────────────────────────────────────────────────

  /**
   * Taux de livraison par canal (IN_APP, PUSH, EMAIL, SMS).
   *
   * deliveryRate = sent / (total - skipped)
   *   Exclut les SKIPPED du dénominateur car ils ont été
   *   intentionnellement ignorés (DND, préférence désactivée).
   *
   * avgDurationMs : moyenne des temps de réponse fournisseur
   *   (null si aucun log SENT avec durationMs dans la période)
   */
  async getDeliveryRates(days = 30): Promise<IDeliveryRateStats> {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1_000);
    const to   = new Date();

    const rows = await this.logRepo
      .createQueryBuilder('l')
      .select('l.channel', 'channel')
      .addSelect('COUNT(*)',                                              'total')
      .addSelect(`SUM(CASE WHEN l.status = :sent    THEN 1 ELSE 0 END)`, 'sent')
      .addSelect(`SUM(CASE WHEN l.status = :failed  THEN 1 ELSE 0 END)`, 'failed')
      .addSelect(`SUM(CASE WHEN l.status = :skipped THEN 1 ELSE 0 END)`, 'skipped')
      .addSelect(`AVG(CASE WHEN l.status = :sent AND l.durationMs IS NOT NULL THEN l.durationMs END)`, 'avgDurationMs')
      .where('l.createdAt >= :from', { from })
      .setParameters({
        sent:    DeliveryLogStatus.SENT,
        failed:  DeliveryLogStatus.FAILED,
        skipped: DeliveryLogStatus.SKIPPED,
      })
      .groupBy('l.channel')
      .orderBy('total', 'DESC')
      .getRawMany<{
        channel:       string;
        total:         string;
        sent:          string;
        failed:        string;
        skipped:       string;
        avgDurationMs: string | null;
      }>();

    const byChannel: IChannelRate[] = rows.map(r => {
      const total   = Number(r.total);
      const sent    = Number(r.sent);
      const failed  = Number(r.failed);
      const skipped = Number(r.skipped);
      const eligible = total - skipped;
      const deliveryRate = eligible > 0
        ? Math.round((sent / eligible) * 1_000) / 10
        : 0;
      return {
        channel:       r.channel,
        total,
        sent,
        failed,
        skipped,
        deliveryRate,
        avgDurationMs: r.avgDurationMs != null ? Math.round(Number(r.avgDurationMs)) : null,
      };
    });

    // Agrégat global (tous canaux confondus)
    const totalAll   = byChannel.reduce((s, c) => s + c.total,   0);
    const sentAll    = byChannel.reduce((s, c) => s + c.sent,    0);
    const failedAll  = byChannel.reduce((s, c) => s + c.failed,  0);
    const skippedAll = byChannel.reduce((s, c) => s + c.skipped, 0);
    const eligibleAll = totalAll - skippedAll;
    const overallRate = eligibleAll > 0
      ? Math.round((sentAll / eligibleAll) * 1_000) / 10
      : 0;

    return {
      period:   { days, from: from.toISOString(), to: to.toISOString() },
      overall:  { total: totalAll, sent: sentAll, failed: failedAll, deliveryRate: overallRate },
      byChannel,
    };
  }

  // ─────────────────────────────────────────────────────────
  // ÉTAT DE LA FILE MORTE (DLQ)
  // ─────────────────────────────────────────────────────────

  /**
   * Snapshot de l'état des livraisons en échec.
   *
   * pendingRetries    : FAILED + isPermanentFailure=false + attempts restantes
   * permanentFailures : isPermanentFailure=true (ne seront jamais retentées)
   * topErrors         : top 10 des codes d'erreur les plus fréquents
   */
  async getDlqStats(): Promise<IDlqStats> {
    const [pendingRetries, permanentFailures, topErrorRows] = await Promise.all([

      // Retries en attente
      this.logRepo
        .createQueryBuilder('l')
        .where('l.status = :status', { status: DeliveryLogStatus.FAILED })
        .andWhere('l.isPermanentFailure = false')
        .andWhere('l.attemptNumber < l.maxAttempts')
        .getCount(),

      // Échecs permanents
      this.logRepo
        .createQueryBuilder('l')
        .where('l.isPermanentFailure = true')
        .getCount(),

      // Top 10 des codes d'erreur
      this.logRepo
        .createQueryBuilder('l')
        .select('l.errorCode', 'errorCode')
        .addSelect('COUNT(*)', 'count')
        .where('l.status = :status', { status: DeliveryLogStatus.FAILED })
        .andWhere('l.errorCode IS NOT NULL')
        .groupBy('l.errorCode')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany<{ errorCode: string; count: string }>(),
    ]);

    return {
      pendingRetries,
      permanentFailures,
      topErrors: topErrorRows.map(r => ({
        errorCode: r.errorCode,
        count:     Number(r.count),
      })),
    };
  }
}
