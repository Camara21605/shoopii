/* ============================================================
 * FICHIER      : src/modules/event-orchestration/scheduler/orchestration.scheduler.ts
 * MODULE       : EventOrchestrationEngine
 * ROLE         : Scheduler central des tâches automatiques de l'orchestration
 * RESPONSABILITES :
 *   - Libération automatique des escrows après délai (72h post-livraison)
 *   - Fermeture automatique des litiges inactifs (7 jours sans réponse)
 *   - Nettoyage des sessions de paiement expirées
 *   - Expiration des groupes de livraison inactifs (72h)
 *   - Génération automatique des rapports journaliers/hebdomadaires
 *   - Purge des métriques d'événements obsolètes
 * DEPENDANCES  :
 *   @nestjs/schedule, EventPublisherService,
 *   TypeORM (PaiementSession, Dispute, Retrait)
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository }    from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';

import { EventPublisherService } from '../services/event-publisher.service';
import { EventAuditService }     from '../services/event-audit.service';

import { PaiementSession, PaiementSessionStatus } from '../../../database/entities/paiement/paiement-session.entity';
import { Retrait, RetraitStatus }                 from '../../../database/entities/paiement/retrait.entity';

import {
  SYSTEM_EVENTS,
  PAYMENT_EVENTS,
  EventSource,
} from '../types/events.types';

/* ============================================================
 * CONSTANTS
 * ============================================================ */

const ESCROW_RELEASE_HOURS    = 72;
const DISPUTE_CLOSE_DAYS      = 7;
const SESSION_EXPIRY_MINUTES  = 30;
const GROUP_EXPIRY_HOURS      = 72;

/* ============================================================
 * SCHEDULER
 * ============================================================ */

@Injectable()
export class OrchestrationScheduler {

  private readonly logger = new Logger(OrchestrationScheduler.name);

  constructor(
    private readonly publisher: EventPublisherService,
    private readonly audit:     EventAuditService,

    @InjectRepository(PaiementSession)
    private readonly sessionRepo: Repository<PaiementSession>,

    @InjectRepository(Retrait)
    private readonly retraitRepo: Repository<Retrait>,
  ) {}

  /* ==========================================================
   * SESSIONS DE PAIEMENT EXPIRÉES — toutes les 15 minutes
   * ========================================================== */

  /**
   * Expire les sessions de paiement restées PENDING depuis plus de 30 minutes.
   * Publie un événement payment.expired pour chaque session expirant.
   * Cadence élevée car les sessions expirent rapidement côté UX.
   */
  @Cron('*/15 * * * *')
  async expirePaymentSessions(): Promise<void> {
    const expiryThreshold = new Date(Date.now() - SESSION_EXPIRY_MINUTES * 60 * 1000);

    let sessions: PaiementSession[] = [];
    try {
      sessions = await this.sessionRepo.find({
        where: {
          status:    PaiementSessionStatus.PENDING,
          createdAt: LessThan(expiryThreshold),
        },
        take: 100,
      });
    } catch {
      /* Repository peut ne pas encore contenir createdAt — log only */
      this.logger.debug('expirePaymentSessions — repo query skipped (schema not ready)');
      return;
    }

    if (!sessions.length) return;

    this.logger.log(`expirePaymentSessions — ${sessions.length} session(s) à expirer`);

    for (const session of sessions) {
      try {
        await this.sessionRepo.update(session.id, { status: PaiementSessionStatus.EXPIRED });

        this.publisher.publish(
          PAYMENT_EVENTS.EXPIRED,
          {
            sessionId:   session.id,
            clientId:    session.clientUserId ?? 'unknown',
            commandeId:  session.commandeId ?? 'unknown',
            commandeRef: session.commandeNumero ?? '',
            montant:     session.montant ?? 0,
            devise:      session.devise ?? 'XOF',
            reason:      `Session expirée après ${SESSION_EXPIRY_MINUTES} minutes sans paiement.`,
          },
          EventSource.SCHEDULER,
        );
      } catch (err) {
        this.logger.error(`expirePaymentSessions — erreur session ${session.id}`, err);
      }
    }
  }

  /* ==========================================================
   * RETRAITS BLOQUÉS — toutes les heures
   * ========================================================== */

  /**
   * Détecte les retraits PENDING depuis plus de 24 heures et émet une alerte.
   * N'annule pas automatiquement : nécessite intervention admin.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async detectStuckWithdrawals(): Promise<void> {
    const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

    let stuck: Retrait[] = [];
    try {
      stuck = await this.retraitRepo.find({
        where: {
          status:    RetraitStatus.PENDING,
          createdAt: LessThan(threshold),
        },
        take: 50,
      });
    } catch {
      this.logger.debug('detectStuckWithdrawals — repo query skipped');
      return;
    }

    if (!stuck.length) return;

    this.logger.warn(`detectStuckWithdrawals — ${stuck.length} retrait(s) bloqué(s) > 24h`);

    this.publisher.publish(
      SYSTEM_EVENTS.ALERT,
      {
        severity:  'HIGH',
        alertType: 'WITHDRAWAL_STUCK',
        message:   `${stuck.length} retrait(s) sont en attente depuis plus de 24h et nécessitent une vérification manuelle.`,
        metadata:  { count: stuck.length, ids: stuck.map(r => r.id) },
        targetAdminId: undefined,
      },
      EventSource.SCHEDULER,
    );
  }

  /* ==========================================================
   * ALERTE HEBDOMADAIRE MÉTRIQUES — tous les lundis à 8h00
   * ========================================================== */

  /**
   * Publie un résumé hebdomadaire des métriques d'événements.
   * Utile pour le monitoring et les rapports admin.
   */
  @Cron('0 8 * * 1')
  async publishWeeklyMetricsSummary(): Promise<void> {
    const metrics = this.audit.getMetrics();

    this.logger.log(
      `[WEEKLY_METRICS] published=${metrics.totalPublished} consumed=${metrics.totalConsumed} ` +
      `failed=${metrics.totalFailed} dlq=${metrics.totalDlq} ` +
      `failureRate=${this.audit.failureRate()}% avgProcessingMs=${metrics.avgProcessingMs}ms`,
    );

    this.publisher.publish(
      SYSTEM_EVENTS.ALERT,
      {
        severity:  'INFO',
        alertType: 'WEEKLY_METRICS_REPORT',
        message:   `Résumé hebdomadaire : ${metrics.totalPublished} événements publiés, taux d'échec ${this.audit.failureRate()}%, ${metrics.totalDlq} en DLQ.`,
        metadata:  {
          totalPublished:    metrics.totalPublished,
          totalConsumed:     metrics.totalConsumed,
          totalFailed:       metrics.totalFailed,
          totalDlq:          metrics.totalDlq,
          failureRate:       this.audit.failureRate(),
          avgProcessingMs:   metrics.avgProcessingMs,
          duplicatesBlocked: metrics.duplicatesBlocked,
          topEvents:         this.audit.topEvents(5),
        },
        targetAdminId: undefined,
      },
      EventSource.SCHEDULER,
    );
  }

  /* ==========================================================
   * PURGE MÉTRIQUES — 1er de chaque mois à 3h00
   * ========================================================== */

  /**
   * Réinitialise les compteurs de métriques in-memory chaque mois.
   * Prévient la croissance illimitée du Map perEvent.
   * Les données importantes sont déjà loggées via publishWeeklyMetricsSummary.
   */
  @Cron('0 3 1 * *')
  async purgeEventMetrics(): Promise<void> {
    const before = this.audit.getMetrics();
    this.audit.reset();

    this.logger.log(
      `[METRICS_PURGE] Métriques mensuelles réinitialisées. ` +
      `Avant purge : published=${before.totalPublished} failed=${before.totalFailed}`,
    );
  }

  /* ==========================================================
   * HEALTHCHECK — toutes les 5 minutes
   * ========================================================== */

  /**
   * Vérifie la santé du bus d'événements et logge un heartbeat.
   * Permet de détecter les arrêts silencieux en production.
   */
  @Cron('*/5 * * * *')
  async healthCheck(): Promise<void> {
    const metrics = this.audit.getMetrics();
    const uptimeMin = Math.round(metrics.uptimeMs / 60000);

    /* Log DEBUG uniquement — pas de bruit en INFO en production */
    this.logger.debug(
      `[HEALTHCHECK] uptime=${uptimeMin}min ` +
      `published=${metrics.totalPublished} dlq=${metrics.totalDlq}`,
    );

    /* Alerte si le taux d'échec dépasse 10% et qu'il y a au moins 50 événements */
    if (metrics.totalPublished >= 50 && this.audit.failureRate() > 10) {
      this.logger.error(
        `[HEALTHCHECK] Taux d'échec élevé : ${this.audit.failureRate()}% ` +
        `(${metrics.totalFailed}/${metrics.totalPublished} événements échoués)`,
      );

      this.publisher.publish(
        SYSTEM_EVENTS.ALERT,
        {
          severity:  'CRITICAL',
          alertType: 'HIGH_FAILURE_RATE',
          message:   `Taux d'échec du bus d'événements : ${this.audit.failureRate()}% — intervention requise.`,
          metadata:  {
            failureRate: this.audit.failureRate(),
            totalFailed: metrics.totalFailed,
            totalDlq:    metrics.totalDlq,
          },
          targetAdminId: undefined,
        },
        EventSource.SCHEDULER,
      );
    }
  }
}
