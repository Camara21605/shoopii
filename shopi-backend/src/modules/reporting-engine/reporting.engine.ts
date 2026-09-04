/* ============================================================
 * FICHIER      : src/modules/reporting-engine/reporting.engine.ts
 * MODULE       : ReportingEngine
 * ROLE         : Orchestrateur — point d'entrée unique du moteur
 * RESPONSABILITES :
 *   - Exposer une API unifiée pour tous les cas d'usage reporting
 *   - Appliquer le contrôle d'accès par rôle avant chaque opération
 *   - Journaliser les accès sensibles (exports, rapports par rôle)
 *   - Déléguer aux services spécialisés
 * DEPENDANCES  :
 *   DashboardService, KpiEngineService, AnalyticsService,
 *   ReportGeneratorService, StatisticsService, ExportService,
 *   AlertService, AuditReportService, ReportingCacheService
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';

import { DashboardService }       from './services/dashboard.service';
import { KpiEngineService }       from './services/kpi-engine.service';
import { AnalyticsService }       from './services/analytics.service';
import { ReportGeneratorService } from './services/report-generator.service';
import { StatisticsService }      from './services/statistics.service';
import { ExportService }          from './services/export.service';
import { AlertService }           from './services/alert.service';
import { AuditReportService }     from './services/audit-report.service';
import { ReportingCacheService }  from './services/reporting-cache.service';

import {
  ReportFilter,
  ReportSection,
  ExportFormat,
  AuditReportFilter,
  RoleFilter,
  OverviewKpi,
  SuperAdminDashboard,
  RoleDashboard,
  FinancialReport,
  ExportResult,
  AlertCheckResult,
  FinancialAlert,
  PaginatedResult,
  GrowthAnalysis,
  ChartData,
  ReportErreur,
  ReportErreurType,
} from './types/reporting.types';

/* ============================================================
 * PERMISSIONS PAR RÔLE
 * Détermine quelles sections un rôle peut consulter.
 * ============================================================ */

const ROLE_ALLOWED_SECTIONS: Record<RoleFilter, ReportSection[]> = {
  [RoleFilter.SUPER_ADMIN]:  Object.values(ReportSection) as ReportSection[],
  [RoleFilter.ADMIN]:        [ReportSection.COMMISSIONS, ReportSection.LITIGES, ReportSection.OVERVIEW],
  [RoleFilter.PARTNER]:      [ReportSection.COMMISSIONS, ReportSection.DISTRIBUTIONS, ReportSection.RETRAITS],
  [RoleFilter.ENTREPRISE]:   [ReportSection.DISTRIBUTIONS, ReportSection.PAIEMENTS, ReportSection.RETRAITS, ReportSection.LITIGES],
  [RoleFilter.LIVREUR]:      [ReportSection.DISTRIBUTIONS, ReportSection.RETRAITS],
  [RoleFilter.CORRESPONDANT]:[ReportSection.DISTRIBUTIONS, ReportSection.RETRAITS],
};

/* ============================================================
 * ORCHESTRATEUR
 * ============================================================ */

@Injectable()
export class ReportingEngine {

  constructor(
    private readonly dashboard:       DashboardService,
    private readonly kpiEngine:       KpiEngineService,
    private readonly analytics:       AnalyticsService,
    private readonly reportGenerator: ReportGeneratorService,
    private readonly statistics:      StatisticsService,
    private readonly exportSvc:       ExportService,
    private readonly alertSvc:        AlertService,
    private readonly auditReport:     AuditReportService,
    private readonly cache:           ReportingCacheService,
  ) {}

  /* ==========================================================
   * DASHBOARDS PAR RÔLE
   * ========================================================== */

  /** Dashboard Super Admin — vue globale plateforme */
  async getSuperAdminDashboard(
    filter?: Partial<ReportFilter>,
  ): Promise<SuperAdminDashboard> {
    return this.dashboard.getSuperAdminDashboard(filter);
  }

  /**
   * Dashboard Admin — cloisonné à son périmètre.
   * @param adminId     ID de l'administrateur connecté
   */
  async getAdminDashboard(
    adminId: string,
    filter?: Partial<ReportFilter>,
  ): Promise<RoleDashboard> {
    return this.dashboard.getAdminDashboard(adminId, filter);
  }

  /**
   * Dashboard Partenaire — cloisonné à ses comptes.
   * @param partenaireId ID du partenaire connecté
   */
  async getPartnerDashboard(
    partenaireId: string,
    filter?:      Partial<ReportFilter>,
  ): Promise<RoleDashboard> {
    return this.dashboard.getPartnerDashboard(partenaireId, filter);
  }

  /**
   * Dashboard Entreprise — ventes et revenus.
   * @param userId  ID de l'entreprise connectée
   */
  async getEntrepriseDashboard(
    userId:  string,
    filter?: Partial<ReportFilter>,
  ): Promise<RoleDashboard> {
    return this.dashboard.getEntrepriseDashboard(userId, filter);
  }

  /**
   * Dashboard Livreur — livraisons et revenus.
   * @param userId ID du livreur connecté
   */
  async getLivreurDashboard(
    userId:  string,
    filter?: Partial<ReportFilter>,
  ): Promise<RoleDashboard> {
    return this.dashboard.getLivreurDashboard(userId, filter);
  }

  /**
   * Dashboard Correspondant — livraisons et revenus.
   * @param userId ID du correspondant connecté
   */
  async getCorrespondantDashboard(
    userId:  string,
    filter?: Partial<ReportFilter>,
  ): Promise<RoleDashboard> {
    return this.dashboard.getCorrespondantDashboard(userId, filter);
  }

  /* ==========================================================
   * KPIs
   * ========================================================== */

  /**
   * Calcule les KPIs globaux pour un filtre donné.
   * Accessible à tous les rôles ; les services sous-jacents
   * appliquent le cloisonnement SQL.
   */
  async getOverviewKpi(filter: ReportFilter): Promise<OverviewKpi> {
    return this.kpiEngine.computeOverviewKpi(filter);
  }

  /* ==========================================================
   * RAPPORTS
   * ========================================================== */

  /**
   * Génère un rapport pour une section et une période.
   * Vérifie que le rôle demandeur a accès à la section.
   *
   * @throws ReportErreur UNAUTHORIZED si le rôle n'a pas accès
   */
  async generateReport(
    section: ReportSection,
    filter:  ReportFilter,
  ): Promise<FinancialReport> {
    this.assertSectionAccess(filter.requestingUserRole, section);
    return this.reportGenerator.generateReport(section, filter);
  }

  /**
   * Rapport quotidien pour une date et une section.
   */
  async generateDailyReport(
    date:        Date,
    section:     ReportSection,
    baseFilter?: Partial<ReportFilter>,
  ): Promise<FinancialReport> {
    if (baseFilter?.requestingUserRole) {
      this.assertSectionAccess(baseFilter.requestingUserRole, section);
    }
    return this.reportGenerator.generateDailyReport(date, section, baseFilter);
  }

  /**
   * Rapport hebdomadaire.
   */
  async generateWeeklyReport(
    weekStart:   Date,
    section:     ReportSection,
    baseFilter?: Partial<ReportFilter>,
  ): Promise<FinancialReport> {
    if (baseFilter?.requestingUserRole) {
      this.assertSectionAccess(baseFilter.requestingUserRole, section);
    }
    return this.reportGenerator.generateWeeklyReport(weekStart, section, baseFilter);
  }

  /**
   * Rapport mensuel.
   */
  async generateMonthlyReport(
    year:        number,
    month:       number,
    section:     ReportSection,
    baseFilter?: Partial<ReportFilter>,
  ): Promise<FinancialReport> {
    if (baseFilter?.requestingUserRole) {
      this.assertSectionAccess(baseFilter.requestingUserRole, section);
    }
    return this.reportGenerator.generateMonthlyReport(year, month, section, baseFilter);
  }

  /**
   * Rapport annuel.
   */
  async generateAnnualReport(
    year:        number,
    section:     ReportSection,
    baseFilter?: Partial<ReportFilter>,
  ): Promise<FinancialReport> {
    if (baseFilter?.requestingUserRole) {
      this.assertSectionAccess(baseFilter.requestingUserRole, section);
    }
    return this.reportGenerator.generateAnnualReport(year, section, baseFilter);
  }

  /* ==========================================================
   * ANALYTICS & GRAPHIQUES
   * ========================================================== */

  /** Répartition par méthode de paiement (données pour graphique pie) */
  async getPaymentMethodBreakdown(filter: ReportFilter): Promise<ChartData> {
    return this.analytics.getPaymentMethodBreakdown(filter);
  }

  /** Tendance du CA brut (données pour graphique line) */
  async getRevenueTrend(filter: ReportFilter): Promise<ChartData> {
    return this.analytics.getRevenueTrend(filter);
  }

  /** Tendance des litiges (données pour graphique line) */
  async getDisputeTrend(filter: ReportFilter): Promise<ChartData> {
    return this.analytics.getDisputeTrend(filter);
  }

  /** Analyse de croissance période sur période */
  async getGrowthAnalysis(filter: ReportFilter): Promise<GrowthAnalysis> {
    return this.analytics.getGrowthAnalysis(filter);
  }

  /* ==========================================================
   * STATISTIQUES AVANCÉES
   * ========================================================== */

  /** Percentiles P25/P50/P75/P90 des paiements */
  async getPaiementPercentiles(
    filter: ReportFilter,
  ): Promise<{ p25: number; p50: number; p75: number; p90: number }> {
    return this.statistics.getPaiementPercentiles(filter);
  }

  /** Moyennes clés (panier moyen, délai paiement, etc.) */
  async computeAverages(filter: ReportFilter) {
    return this.statistics.computeAverages(filter);
  }

  /** Taux d'activité des acteurs sur la période */
  async getActivityStats(filter: ReportFilter) {
    return this.statistics.getActivityStats(filter);
  }

  /* ==========================================================
   * TOP ACTEURS
   *
   * Terminé — AnalyticsService.getTopEntreprises/Livreurs/Partenaires
   * et StatisticsService.getActeurStats existaient déjà, complets et
   * corrects (calculs réels depuis PaiementDistribution), mais n'étaient
   * exposés par aucune méthode de cette façade ni par aucune route :
   * code mort, jamais atteignable. Voir GET /dashboard/super-admin/
   * finances/top-acteurs et .../acteur/:userId dans super-admin.controller.ts.
   * ========================================================== */

  private defaultFilter(filter?: Partial<ReportFilter>): ReportFilter {
    const now = new Date();
    const dateFrom = filter?.dateFrom ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dateTo   = filter?.dateTo   ?? now;
    return { ...filter, dateFrom, dateTo } as ReportFilter;
  }

  /** Top N entreprises par montant de distributions libérées */
  async getTopEntreprises(filter?: Partial<ReportFilter>, limit = 10) {
    return this.analytics.getTopEntreprises(this.defaultFilter(filter), limit);
  }

  /** Top N livreurs par montant de distributions libérées */
  async getTopLivreurs(filter?: Partial<ReportFilter>, limit = 10) {
    return this.analytics.getTopLivreurs(this.defaultFilter(filter), limit);
  }

  /** Top N partenaires par montant de commissions libérées */
  async getTopPartenaires(filter?: Partial<ReportFilter>, limit = 10) {
    return this.analytics.getTopPartenaires(this.defaultFilter(filter), limit);
  }

  /** Statistiques complètes d'un acteur individuel */
  async getActeurStats(userId: string, filter?: Partial<ReportFilter>) {
    return this.statistics.getActeurStats(userId, this.defaultFilter(filter));
  }

  /* ==========================================================
   * EXPORTS
   * ========================================================== */

  /**
   * Exporte un rapport en CSV, PDF ou Excel.
   * Vérifie les permissions avant de lancer l'export.
   * Journalise l'export via fire-and-forget.
   *
   * @throws ReportErreur UNAUTHORIZED si le rôle n'a pas accès
   */
  async exportReport(
    section: ReportSection,
    format:  ExportFormat,
    filter:  ReportFilter,
  ): Promise<ExportResult> {
    this.assertSectionAccess(filter.requestingUserRole, section);

    /* Journalisation asynchrone de l'export (données sensibles) */
    setImmediate(() => {
      this.logExport(
        filter.requestingUserId ?? 'unknown',
        filter.requestingUserRole ?? RoleFilter.ADMIN,
        section,
        format,
      );
    });

    return this.exportSvc.exportReport(section, format, filter);
  }

  /* ==========================================================
   * ALERTES
   * ========================================================== */

  /** Lance toutes les vérifications d'alerte */
  async runAlertChecks(): Promise<AlertCheckResult> {
    return this.alertSvc.runAllChecks();
  }

  /** Retourne les alertes actives non expirées */
  getActiveAlerts(options?: { targetRole?: string }): FinancialAlert[] {
    return this.alertSvc.getActiveAlerts(options);
  }

  /** Acquitte une alerte */
  dismissAlert(alertId: string): void {
    this.alertSvc.dismissAlert(alertId);
  }

  /* ==========================================================
   * RAPPORTS D'AUDIT
   * ========================================================== */

  /**
   * Retourne les entrées d'audit paginées.
   * Réservé aux Super Admin (vérification à faire au niveau controller).
   */
  async getAuditLogs(
    filter: AuditReportFilter,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    return this.auditReport.findAuditLogs(filter);
  }

  /** Résumé des événements d'audit par acteur */
  async getAuditSummaryByActor(filter: AuditReportFilter) {
    return this.auditReport.getAuditSummaryByActor(filter);
  }

  /** Événements de sécurité des dernières N heures */
  async getSecurityEvents(hours = 24) {
    return this.auditReport.getSecurityEvents(hours);
  }

  /** Statistiques globales du journal d'audit */
  async getAuditStats(filter: AuditReportFilter) {
    return this.auditReport.getAuditStats(filter);
  }

  /* ==========================================================
   * CACHE
   * ========================================================== */

  /** Invalide tout le cache (à utiliser avec précaution) */
  invalidateCache(): void {
    this.cache.invalidateAll();
  }

  /** Statistiques du cache en mémoire */
  getCacheStats() {
    return this.cache.stats();
  }

  /* ==========================================================
   * MÉTHODES PRIVÉES
   * ========================================================== */

  /**
   * Vérifie que le rôle demandeur est autorisé à accéder à la section.
   * Lève ReportErreur UNAUTHORIZED en cas de refus.
   *
   * Note : si requestingUserRole est absent du filtre, l'accès est refusé
   * par défaut (fail-secure).
   */
  private assertSectionAccess(
    role:    RoleFilter | undefined,
    section: ReportSection,
  ): void {
    if (!role) {
      throw new ReportErreur(
        ReportErreurType.UNAUTHORIZED,
        'Rôle manquant dans le filtre de rapport',
      );
    }

    const allowed = ROLE_ALLOWED_SECTIONS[role] ?? [];
    if (!allowed.includes(section)) {
      throw new ReportErreur(
        ReportErreurType.UNAUTHORIZED,
        `Rôle ${role} non autorisé à accéder à la section ${section}`,
      );
    }
  }

  /**
   * Journalise un export dans la console (à remplacer par FinancialAuditLog
   * une fois l'intégration avec AuditLogService finalisée).
   * Utilise fire-and-forget via setImmediate (pattern cohérent avec la charte).
   */
  private logExport(
    userId:  string,
    role:    RoleFilter,
    section: ReportSection,
    format:  ExportFormat,
  ): void {
    /* TODO: remplacer par injection FinancialAuditLogService quand disponible */
    console.log(
      `[ReportingEngine] EXPORT userId=${userId} role=${role} section=${section} format=${format} at=${new Date().toISOString()}`,
    );
  }
}
