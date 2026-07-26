/* ============================================================
 * FICHIER      : src/modules/platform-security/services/metrics-collector.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Collecte et agrège les métriques système en temps réel.
 * Maintient des compteurs in-memory et persiste des instantanés
 * périodiques dans la table system_metrics.
 *
 * MÉTRIQUES COLLECTÉES
 * ─────────────────────────────────────────────────────────────
 *   Processus  : RAM, uptime
 *   HTTP       : requêtes totales, actives, erreurs, durée moyenne
 *   Événements : publiés, consommés, échoués, DLQ (depuis EventAudit)
 *
 * PATTERN
 * ─────────────────────────────────────────────────────────────
 * Les compteurs HTTP sont incrémentés via recordRequest() appelé
 * depuis un intercepteur HTTP ou depuis les controllers.
 * Le scheduler appelle persistSnapshot() toutes les 5 minutes.
 *
 * DÉPENDANCES
 * ─────────────────────────────────────────────────────────────
 *   TypeORM → Repository<SystemMetric>
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';

import { SystemMetric }   from '../../../database/entities/security/system-metric.entity';
import { MetricsSnapshot } from '../types/security.types';

/* ============================================================
 * CONSTANTES
 * ============================================================ */

/** Nombre maximal de durées de requêtes conservées en mémoire pour la moyenne glissante. */
const MAX_DURATION_SAMPLES = 2000;

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class MetricsCollectorService {

  private readonly logger  = new Logger(MetricsCollectorService.name);
  private readonly startMs = Date.now();

  /* ── Compteurs HTTP en mémoire ───────────────────────────── */
  private totalRequests  = 0;
  private activeRequests = 0;
  private errorCount     = 0;
  private durations: number[] = []; // fenêtre glissante des dernières durées

  /* ── Compteurs événements injectés depuis l'extérieur ─────── */
  private eventsPublished = 0;
  private eventsConsumed  = 0;
  private eventsFailed    = 0;
  private eventsDlqSize   = 0;

  constructor(
    @InjectRepository(SystemMetric)
    private readonly metricRepo: Repository<SystemMetric>,
  ) {}

  /* ==========================================================
   * INSTRUMENTATION HTTP
   * ========================================================== */

  /**
   * Enregistre une requête HTTP complète.
   * À appeler depuis un intercepteur NestJS ou un middleware.
   */
  recordRequest(statusCode: number, durationMs: number): void {
    this.totalRequests++;

    if (statusCode >= 400) this.errorCount++;

    /* Fenêtre glissante pour la durée moyenne */
    if (this.durations.length >= MAX_DURATION_SAMPLES) {
      this.durations.shift();
    }
    this.durations.push(durationMs);
  }

  /** Indique qu'une requête est en cours (appelé à l'entrée du handler). */
  incrementActive(): void {
    this.activeRequests++;
  }

  /** Indique qu'une requête s'est terminée (appelé à la sortie du handler). */
  decrementActive(): void {
    if (this.activeRequests > 0) this.activeRequests--;
  }

  /* ==========================================================
   * MISE À JOUR DES MÉTRIQUES D'ÉVÉNEMENTS
   * ========================================================== */

  /**
   * Reçoit les métriques depuis EventAuditService ou OrchestrationScheduler.
   * Appelé par le SecurityScheduler avant chaque persistSnapshot().
   */
  updateEventMetrics(metrics: {
    published:    number;
    consumed:     number;
    failed:       number;
    dlqSize:      number;
  }): void {
    this.eventsPublished = metrics.published;
    this.eventsConsumed  = metrics.consumed;
    this.eventsFailed    = metrics.failed;
    this.eventsDlqSize   = metrics.dlqSize;
  }

  /* ==========================================================
   * SNAPSHOT
   * ========================================================== */

  /**
   * Calcule et retourne un instantané des métriques actuelles.
   * Appel synchrone — n'écrit pas en base.
   */
  getSnapshot(): MetricsSnapshot {
    const mem       = process.memoryUsage();
    const uptimeMs  = Date.now() - this.startMs;

    const heapTotalMb = mem.heapTotal / 1_048_576;
    const heapUsedMb  = mem.heapUsed  / 1_048_576;
    const rssMb       = mem.rss       / 1_048_576;
    const memUsedPct  = heapTotalMb > 0
      ? Math.round((heapUsedMb / heapTotalMb) * 10000) / 100
      : 0;

    const avgDuration = this.durations.length > 0
      ? Math.round(this.durations.reduce((a, b) => a + b, 0) / this.durations.length)
      : 0;

    const errorRate = this.totalRequests > 0
      ? Math.round((this.errorCount / this.totalRequests) * 10000) / 100
      : 0;

    const failureRate = this.eventsPublished > 0
      ? Math.round((this.eventsFailed / this.eventsPublished) * 10000) / 100
      : 0;

    return {
      timestamp: new Date(),
      process: {
        uptimeMs,
        memoryUsedMb:      Math.round(heapUsedMb  * 100) / 100,
        memoryHeapTotalMb: Math.round(heapTotalMb * 100) / 100,
        memoryUsedPct:     memUsedPct,
        rssMb:             Math.round(rssMb * 100) / 100,
      },
      http: {
        totalRequests:  this.totalRequests,
        activeRequests: this.activeRequests,
        errorCount:     this.errorCount,
        errorRatePct:   errorRate,
        avgDurationMs:  avgDuration,
      },
      events: {
        published:      this.eventsPublished,
        consumed:       this.eventsConsumed,
        failed:         this.eventsFailed,
        dlqSize:        this.eventsDlqSize,
        failureRatePct: failureRate,
      },
    };
  }

  /* ==========================================================
   * PERSISTANCE
   * ========================================================== */

  /**
   * Persiste un instantané complet dans system_metrics.
   * Appelé par SecurityScheduler toutes les 5 minutes.
   * En cas d'erreur, log seulement — n'interrompt pas le scheduler.
   */
  async persistSnapshot(): Promise<void> {
    try {
      const snap = this.getSnapshot();
      const now  = snap.timestamp;

      const entries: Partial<SystemMetric>[] = [
        { metricName: 'process.memory_mb',    value: snap.process.memoryUsedMb,    unit: 'mb',    collectedAt: now },
        { metricName: 'process.memory_pct',   value: snap.process.memoryUsedPct,   unit: 'pct',   collectedAt: now },
        { metricName: 'process.uptime_min',   value: Math.round(snap.process.uptimeMs / 60000), unit: 'min', collectedAt: now },
        { metricName: 'process.rss_mb',       value: snap.process.rssMb,           unit: 'mb',    collectedAt: now },
        { metricName: 'http.total_requests',  value: snap.http.totalRequests,       unit: 'count', collectedAt: now },
        { metricName: 'http.error_count',     value: snap.http.errorCount,          unit: 'count', collectedAt: now },
        { metricName: 'http.error_rate_pct',  value: snap.http.errorRatePct,        unit: 'pct',   collectedAt: now },
        { metricName: 'http.avg_duration_ms', value: snap.http.avgDurationMs,       unit: 'ms',    collectedAt: now },
        { metricName: 'events.published',     value: snap.events.published,         unit: 'count', collectedAt: now },
        { metricName: 'events.failed',        value: snap.events.failed,            unit: 'count', collectedAt: now },
        { metricName: 'events.failure_pct',   value: snap.events.failureRatePct,    unit: 'pct',   collectedAt: now },
        { metricName: 'events.dlq_size',      value: snap.events.dlqSize,           unit: 'count', collectedAt: now },
      ];

      await this.metricRepo.insert(entries);
      this.logger.debug(`[Metrics] Instantané persisté — ${entries.length} métriques`);
    } catch (err) {
      this.logger.error('[Metrics] Erreur persistSnapshot', err);
    }
  }

  /**
   * Récupère l'historique d'une métrique sur une période.
   * Utilisé par le tableau de bord admin pour les graphiques.
   */
  async getHistory(
    metricName: string,
    from: Date,
    to: Date,
  ): Promise<SystemMetric[]> {
    return this.metricRepo
      .createQueryBuilder('m')
      .where('m.metricName = :name', { name: metricName })
      .andWhere('m.collectedAt BETWEEN :from AND :to', { from, to })
      .orderBy('m.collectedAt', 'ASC')
      .getMany();
  }

  /**
   * Supprime les métriques antérieures à la date donnée.
   * Appelé par le SecurityScheduler selon la politique de rétention.
   */
  async purgeOlderThan(date: Date): Promise<number> {
    const result = await this.metricRepo
      .createQueryBuilder()
      .delete()
      .from(SystemMetric)
      .where('collectedAt < :date', { date })
      .execute();

    return result.affected ?? 0;
  }

  /* ==========================================================
   * RÉINITIALISATION (tests)
   * ========================================================== */

  /** Remet tous les compteurs in-memory à zéro. Usage : tests unitaires. */
  reset(): void {
    this.totalRequests  = 0;
    this.activeRequests = 0;
    this.errorCount     = 0;
    this.durations      = [];
    this.eventsPublished = 0;
    this.eventsConsumed  = 0;
    this.eventsFailed    = 0;
    this.eventsDlqSize   = 0;
  }
}
