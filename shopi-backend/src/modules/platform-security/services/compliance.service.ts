/* ============================================================
 * FICHIER      : src/modules/platform-security/services/compliance.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Conformité, conservation des données et rapports d'audit.
 *
 * RESPONSABILITÉS
 * ─────────────────────────────────────────────────────────────
 * 1. Définir et appliquer les politiques de rétention des données
 * 2. Détecter les enregistrements devant être archivés/supprimés
 * 3. Générer des rapports de conformité périodiques
 *
 * POLITIQUE DE RÉTENTION PAR TYPE DE DONNÉES
 * ─────────────────────────────────────────────────────────────
 * financial_audit_logs     → 5 ans (obligation légale)
 * security_event_logs      → 3 ans
 * system_metrics           → 90 jours
 * platform_incidents       → 5 ans
 * audit_logs (général)     → 3 ans
 * wallet_transactions      → 5 ans (identique aux logs financiers)
 *
 * SÉCURITÉ
 * ─────────────────────────────────────────────────────────────
 * La suppression effective des données est soumise à validation
 * manuelle Super Admin — ce service ne SUPPRIME jamais directement.
 * Il SIGNALE uniquement ce qui dépasse la rétention.
 *
 * DÉPENDANCES
 * ─────────────────────────────────────────────────────────────
 *   TypeORM → DataSource (requêtes cross-entités)
 *   SecurityEventService → log() pour les rapports générés
 *   IncidentManagerService → statistiques incidents
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource }   from '@nestjs/typeorm';
import { DataSource }         from 'typeorm';

import { SecurityEventService }             from './security-event.service';
import { IncidentManagerService }           from './incident-manager.service';
import { SecurityEventType, SecuritySeverity } from '../../../database/entities/security/security-event-log.entity';

import {
  RetentionPolicy,
  RetentionCheckResult,
  ComplianceReport,
} from '../types/security.types';

/* ============================================================
 * CONSTANTES
 * ============================================================ */

const RETENTION: RetentionPolicy = {
  financialAuditLogsYears: 5,
  securityEventsYears:     3,
  metricsRetentionDays:    90,
  incidentsRetentionYears: 5,
  generalAuditLogsYears:   3,
};

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class ComplianceService {

  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,

    private readonly securityEvent: SecurityEventService,
    private readonly incidentMgr:   IncidentManagerService,
  ) {}

  /* ==========================================================
   * POLITIQUE DE RÉTENTION
   * ========================================================== */

  /** Retourne la politique de rétention active. */
  getRetentionPolicy(): RetentionPolicy {
    return { ...RETENTION };
  }

  /* ==========================================================
   * VÉRIFICATION DE CONFORMITÉ
   * ========================================================== */

  /**
   * Analyse chaque table et détecte les enregistrements
   * dépassant leur période de conservation.
   * NE SUPPRIME PAS — retourne uniquement le rapport.
   */
  async runRetentionCheck(): Promise<RetentionCheckResult> {
    const now = new Date();

    const checks = [
      {
        name:           'financial_audit_logs',
        retentionYears: RETENTION.financialAuditLogsYears,
        threshold:      yearsAgo(now, RETENTION.financialAuditLogsYears),
      },
      {
        name:           'security_event_logs',
        retentionYears: RETENTION.securityEventsYears,
        threshold:      yearsAgo(now, RETENTION.securityEventsYears),
      },
      {
        name:           'system_metrics',
        retentionYears: RETENTION.metricsRetentionDays / 365,
        threshold:      daysAgo(now, RETENTION.metricsRetentionDays),
      },
      {
        name:           'platform_incidents',
        retentionYears: RETENTION.incidentsRetentionYears,
        threshold:      yearsAgo(now, RETENTION.incidentsRetentionYears),
      },
      {
        name:           'audit_logs',
        retentionYears: RETENTION.generalAuditLogsYears,
        threshold:      yearsAgo(now, RETENTION.generalAuditLogsYears),
      },
    ];

    const tableResults = await Promise.all(
      checks.map(async c => {
        const { count, oldest } = await this.getTableRetentionStats(c.name, c.threshold);
        return {
          name:             c.name,
          retentionYears:   c.retentionYears,
          recordsToArchive: count,
          oldestRecord:     oldest ?? undefined,
        };
      }),
    );

    const total = tableResults.reduce((s, r) => s + r.recordsToArchive, 0);

    if (total > 0) {
      this.logger.warn(
        `[Compliance] Vérification rétention : ${total} enregistrement(s) à archiver.`,
      );
    } else {
      this.logger.log('[Compliance] Vérification rétention : toutes les tables sont conformes.');
    }

    return {
      checkedAt: now,
      tables: tableResults,
      totalRecordsToArchive: total,
    };
  }

  /**
   * Compte les enregistrements antérieurs au seuil dans une table.
   * Utilise une requête générique sur createdAt.
   */
  private async getTableRetentionStats(
    tableName: string,
    threshold:  Date,
  ): Promise<{ count: number; oldest: Date | null }> {
    try {
      const rows = await this.dataSource.query<Array<{ count: string; oldest: Date | null }>>(
        `SELECT COUNT(*) AS count, MIN("createdAt") AS oldest
         FROM "${tableName}"
         WHERE "createdAt" < $1`,
        [threshold],
      );
      return {
        count:  Number(rows[0]?.count ?? 0),
        oldest: rows[0]?.oldest ?? null,
      };
    } catch {
      /* La table peut ne pas exister encore (première migration) */
      return { count: 0, oldest: null };
    }
  }

  /* ==========================================================
   * RAPPORT DE CONFORMITÉ
   * ========================================================== */

  /**
   * Génère un rapport de conformité complet pour la période donnée.
   * Agrège les événements de sécurité, les incidents et la rétention.
   */
  async generateComplianceReport(period: { from: Date; to: Date }): Promise<ComplianceReport> {
    const [
      byType,
      bySeverity,
      topIps,
      incidents,
      openIncidents,
      avgResolution,
      retention,
    ] = await Promise.all([
      this.securityEvent.countByTypeGrouped(period.from, period.to),
      this.securityEvent.countBySeverityGrouped(period.from, period.to),
      this.securityEvent.topIps(period.from, period.to, 10),
      this.incidentMgr.list({ from: period.from, to: period.to, limit: 1000 }),
      this.incidentMgr.countOpen(),
      this.incidentMgr.avgResolutionHours(period.from, period.to),
      this.runRetentionCheck(),
    ]);

    const totalEvents  = Object.values(byType).reduce((a, b) => a + b, 0);
    const incidentsBySev: Record<string, number> = {};
    for (const inc of incidents) {
      incidentsBySev[inc.severity] = (incidentsBySev[inc.severity] ?? 0) + 1;
    }

    const recommendations = this.buildRecommendations(
      bySeverity,
      incidents.length,
      openIncidents,
      retention,
    );

    const report: ComplianceReport = {
      generatedAt: new Date(),
      period,
      securityEvents: {
        total:      totalEvents,
        bySeverity: bySeverity,
        byType:     byType,
        topIps,
      },
      incidents: {
        total:               incidents.length,
        bySeverity:          incidentsBySev,
        avgResolutionHours:  avgResolution,
        openCount:           openIncidents,
      },
      retention,
      recommendations,
    };

    /* Persistance du fait que le rapport a été généré */
    this.securityEvent.logAsync({
      eventType: SecurityEventType.COMPLIANCE_REPORT_GENERATED,
      severity:  SecuritySeverity.INFO,
      action:    'generate_compliance_report',
      details: {
        periodFrom:  period.from.toISOString(),
        periodTo:    period.to.toISOString(),
        totalEvents,
        incidentCount: incidents.length,
      },
    });

    this.logger.log(
      `[Compliance] Rapport généré — période ${period.from.toISOString().slice(0, 10)} ` +
      `→ ${period.to.toISOString().slice(0, 10)} | événements=${totalEvents} incidents=${incidents.length}`,
    );

    return report;
  }

  /**
   * Génère des recommandations basées sur les données du rapport.
   */
  private buildRecommendations(
    bySeverity:    Record<string, number>,
    totalIncidents: number,
    openIncidents:  number,
    retention:     RetentionCheckResult,
  ): string[] {
    const recs: string[] = [];

    const critical = bySeverity['critical'] ?? 0;
    if (critical > 5) {
      recs.push(`${critical} événement(s) CRITICAL détecté(s) sur la période — investigation recommandée.`);
    }

    if (openIncidents > 0) {
      recs.push(`${openIncidents} incident(s) encore ouvert(s) — vérifier l'état de résolution.`);
    }

    if (totalIncidents > 10) {
      recs.push(`Fréquence d'incidents élevée (${totalIncidents}) — revoir la stratégie de prévention.`);
    }

    if (retention.totalRecordsToArchive > 0) {
      recs.push(
        `${retention.totalRecordsToArchive} enregistrement(s) dépassent la politique de rétention — ` +
        `planifier l'archivage/suppression.`,
      );
    }

    if (recs.length === 0) {
      recs.push('Aucune anomalie majeure détectée sur la période. Plateforme conforme.');
    }

    return recs;
  }
}

/* ============================================================
 * UTILITAIRES
 * ============================================================ */

function yearsAgo(from: Date, years: number): Date {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() - years);
  return d;
}

function daysAgo(from: Date, days: number): Date {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
}
