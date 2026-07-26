/* ============================================================
 * FICHIER      : src/modules/platform-security/scheduler/security.scheduler.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Tâches cron automatiques du moteur de sécurité.
 * Orchestre les opérations de monitoring, compliance et maintenance
 * qui doivent s'exécuter sans intervention manuelle.
 *
 * TÂCHES PLANIFIÉES
 * ─────────────────────────────────────────────────────────────
 * Toutes les 5 minutes   — Instantané métriques
 * Toutes les heures      — Health check profond
 * Toutes les 15 minutes  — Nettoyage fenêtres anomalies
 * Chaque nuit à 2h00     — Vérification rétention des données
 * Lundi à 6h00           — Rapport de conformité hebdomadaire
 * 1er du mois à 0h00     — Purge métriques anciennes
 *
 * DÉPENDANCES
 * ─────────────────────────────────────────────────────────────
 *   MetricsCollectorService  → persistSnapshot()
 *   DeepHealthService        → checkAll()
 *   AlertManagerService      → trigger(), autoResolveForHealthyComponents()
 *   AnomalyDetectorService   → cleanupExpiredWindows()
 *   ObservabilityService     → cleanupOldTraces()
 *   ComplianceService        → runRetentionCheck(), generateComplianceReport()
 *   SecurityEventService     → purgeOlderThan()
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { MetricsCollectorService }  from '../services/metrics-collector.service';
import { DeepHealthService }        from '../services/deep-health.service';
import { AlertManagerService }      from '../services/alert-manager.service';
import { AnomalyDetectorService }   from '../services/anomaly-detector.service';
import { ObservabilityService }     from '../services/observability.service';
import { ComplianceService }        from '../services/compliance.service';
import { SecurityEventService }     from '../services/security-event.service';
import { SecuritySeverity }         from '../../../database/entities/security/security-event-log.entity';

/* ============================================================
 * CONSTANTES
 * ============================================================ */

/** Taux d'erreur HTTP au-delà duquel une alerte est déclenchée (%). */
const HTTP_ERROR_ALERT_PCT   = 10;
/** Utilisation mémoire au-delà de laquelle une alerte est déclenchée (%). */
const MEMORY_ALERT_PCT       = 85;
/** Durée de conservation des métriques en base (jours). */
const METRICS_RETENTION_DAYS = 90;
/** Durée de conservation des événements de sécurité (années). */
const SECURITY_EVENTS_RETENTION_YEARS = 3;

/* ============================================================
 * SCHEDULER
 * ============================================================ */

@Injectable()
export class SecurityScheduler {

  private readonly logger = new Logger(SecurityScheduler.name);

  constructor(
    private readonly metrics:     MetricsCollectorService,
    private readonly health:      DeepHealthService,
    private readonly alerts:      AlertManagerService,
    private readonly anomaly:     AnomalyDetectorService,
    private readonly obs:         ObservabilityService,
    private readonly compliance:  ComplianceService,
    private readonly secEvent:    SecurityEventService,
  ) {}

  /* ==========================================================
   * MÉTRIQUES — toutes les 5 minutes
   * ========================================================== */

  /**
   * Persiste un instantané des métriques système.
   * Seuil HTTP error rate : si >10% → alerte HIGH.
   * Seuil mémoire : si >85% → alerte MEDIUM.
   */
  @Cron('*/5 * * * *')
  async persistMetricsSnapshot(): Promise<void> {
    try {
      await this.metrics.persistSnapshot();
      const snap = this.metrics.getSnapshot();

      /* Alerte taux d'erreur HTTP élevé */
      if (snap.http.errorRatePct > HTTP_ERROR_ALERT_PCT && snap.http.totalRequests >= 50) {
        this.alerts.trigger({
          ruleId:    'http.error_rate_high',
          severity:  SecuritySeverity.HIGH,
          component: 'http',
          message:   `Taux d'erreur HTTP élevé : ${snap.http.errorRatePct}% (seuil : ${HTTP_ERROR_ALERT_PCT}%)`,
          metadata:  {
            errorRatePct:  snap.http.errorRatePct,
            totalRequests: snap.http.totalRequests,
            errorCount:    snap.http.errorCount,
          },
        });
      } else {
        this.alerts.resolve('http.error_rate_high', 'auto-heal');
      }

      /* Alerte mémoire élevée */
      if (snap.process.memoryUsedPct > MEMORY_ALERT_PCT) {
        this.alerts.trigger({
          ruleId:    'process.memory_high',
          severity:  SecuritySeverity.MEDIUM,
          component: 'process',
          message:   `Utilisation mémoire élevée : ${snap.process.memoryUsedPct}% (seuil : ${MEMORY_ALERT_PCT}%)`,
          metadata:  {
            memoryUsedPct:  snap.process.memoryUsedPct,
            memoryUsedMb:   snap.process.memoryUsedMb,
          },
        });
      } else {
        this.alerts.resolve('process.memory_high', 'auto-heal');
      }

    } catch (err) {
      this.logger.error('[Scheduler] persistMetricsSnapshot erreur', err);
    }
  }

  /* ==========================================================
   * HEALTH CHECK PROFOND — toutes les heures
   * ========================================================== */

  /**
   * Exécute un health check complet de tous les composants.
   * Déclenche une alerte par composant dégradé ou indisponible.
   * Auto-résout les alertes pour les composants redevenus sains.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async runHourlyHealthCheck(): Promise<void> {
    try {
      const report = await this.health.checkAll();

      const healthy: string[] = [];

      for (const component of report.components) {
        if (component.status === 'healthy') {
          healthy.push(component.name);
          continue;
        }

        const ruleId   = `health.${component.name}`;
        const severity = component.status === 'down'
          ? SecuritySeverity.CRITICAL
          : SecuritySeverity.HIGH;

        this.alerts.trigger({
          ruleId,
          severity,
          component: component.name,
          message:   `Composant ${component.name} ${component.status.toUpperCase()} — ${component.error ?? ''}`,
          metadata:  {
            latencyMs: component.latencyMs,
            details:   component.details,
          },
        });
      }

      /* Auto-résolution des composants redevenus sains */
      this.alerts.autoResolveForHealthyComponents(healthy);

      const level = report.overall === 'healthy' ? 'debug' : 'warn';
      this.logger[level](
        `[HealthCheck] overall=${report.overall} ` +
        `components=${report.components.map(c => `${c.name}:${c.status}`).join(' ')} ` +
        `totalMs=${report.totalCheckMs}ms`,
      );

    } catch (err) {
      this.logger.error('[Scheduler] runHourlyHealthCheck erreur', err);
    }
  }

  /* ==========================================================
   * NETTOYAGE FENÊTRES ANOMALIES — toutes les 15 minutes
   * ========================================================== */

  /**
   * Nettoie les fenêtres de détection de brute force expirées
   * et les traces d'observabilité anciennes.
   */
  @Cron('*/15 * * * *')
  cleanupWindows(): void {
    try {
      const loginRemoved = this.anomaly.cleanupExpiredWindows();
      const tracePurged  = this.obs.cleanupOldTraces();

      if (loginRemoved > 0 || tracePurged > 0) {
        this.logger.debug(
          `[Scheduler] Nettoyage — loginWindows=${loginRemoved} traces=${tracePurged}`,
        );
      }
    } catch (err) {
      this.logger.error('[Scheduler] cleanupWindows erreur', err);
    }
  }

  /* ==========================================================
   * VÉRIFICATION RÉTENTION — chaque nuit à 2h00
   * ========================================================== */

  /**
   * Vérifie la conformité de rétention des données.
   * Loggue le nombre d'enregistrements à archiver.
   * Déclenche une alerte si des enregistrements sont hors-conformité.
   */
  @Cron('0 2 * * *')
  async runNightlyRetentionCheck(): Promise<void> {
    try {
      const result = await this.compliance.runRetentionCheck();

      if (result.totalRecordsToArchive > 0) {
        this.logger.warn(
          `[Scheduler] Rétention non conforme — ${result.totalRecordsToArchive} enregistrement(s) à archiver`,
        );
        this.alerts.trigger({
          ruleId:    'compliance.retention_overdue',
          severity:  SecuritySeverity.MEDIUM,
          component: 'compliance',
          message:   `${result.totalRecordsToArchive} enregistrement(s) dépassent la politique de rétention`,
          metadata:  { tables: result.tables.filter(t => t.recordsToArchive > 0) },
        });
      } else {
        this.alerts.resolve('compliance.retention_overdue', 'auto-heal');
      }
    } catch (err) {
      this.logger.error('[Scheduler] runNightlyRetentionCheck erreur', err);
    }
  }

  /* ==========================================================
   * RAPPORT HEBDOMADAIRE — lundi 6h00
   * ========================================================== */

  /**
   * Génère le rapport de conformité hebdomadaire.
   * Couvre les 7 derniers jours.
   */
  @Cron('0 6 * * 1')
  async generateWeeklyComplianceReport(): Promise<void> {
    try {
      const to   = new Date();
      const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

      const report = await this.compliance.generateComplianceReport({ from, to });

      this.logger.log(
        `[Scheduler] Rapport hebdomadaire — ` +
        `events=${report.securityEvents.total} ` +
        `incidents=${report.incidents.total} ` +
        `recommendations=${report.recommendations.length}`,
      );
    } catch (err) {
      this.logger.error('[Scheduler] generateWeeklyComplianceReport erreur', err);
    }
  }

  /* ==========================================================
   * PURGE MÉTRIQUES — 1er du mois à 0h00
   * ========================================================== */

  /**
   * Supprime les métriques DB et événements de sécurité
   * qui dépassent leur période de rétention respective.
   */
  @Cron('0 0 1 * *')
  async runMonthlyCleanup(): Promise<void> {
    try {
      /* Métriques : 90 jours */
      const metricsBefore = new Date(Date.now() - METRICS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const metricsDeleted = await this.metrics.purgeOlderThan(metricsBefore);

      /* Événements de sécurité : 3 ans */
      const secBefore  = new Date(Date.now() - SECURITY_EVENTS_RETENTION_YEARS * 365 * 24 * 60 * 60 * 1000);
      const secDeleted = await this.secEvent.purgeOlderThan(secBefore);

      this.logger.log(
        `[Scheduler] Nettoyage mensuel — ` +
        `metrics_deleted=${metricsDeleted} security_events_deleted=${secDeleted}`,
      );
    } catch (err) {
      this.logger.error('[Scheduler] runMonthlyCleanup erreur', err);
    }
  }
}
