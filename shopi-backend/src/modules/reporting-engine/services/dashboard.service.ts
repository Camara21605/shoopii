/* ============================================================
 * FICHIER      : src/modules/reporting-engine/services/dashboard.service.ts
 * MODULE       : ReportingEngine
 * ROLE         : Tableaux de bord financiers adaptés aux rôles
 * RESPONSABILITES :
 *   - Construire les dashboards Super Admin, Admin, Partenaire,
 *     Entreprise, Livreur, Correspondant depuis un seul service
 *   - Appliquer le cloisonnement des données par rôle
 *   - Combiner KPIs + séries temporelles + alertes
 *   - Utiliser le cache pour éviter les recalculs répétés
 * DEPENDANCES  :
 *   KpiEngineService, AnalyticsService, ReportingCacheService
 *   PaiementDistribution (repository direct pour top acteurs)
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PaiementDistribution } from '../../../database/entities/paiement/paiement-distribution.entity';

import { KpiEngineService }       from './kpi-engine.service';
import { AnalyticsService }       from './analytics.service';
import { AlertService }           from './alert.service';
import { ReportingCacheService }  from './reporting-cache.service';

import {
  ReportFilter,
  RoleFilter,
  ReportRow,
  ReportSection,
  SuperAdminDashboard,
  RoleDashboard,
  OverviewKpi,
  ReportErreur,
  ReportErreurType,
} from '../types/reporting.types';

/* ============================================================
 * FENÊTRES PAR DÉFAUT
 * ============================================================ */

/**
 * Retourne un filtre par défaut pour les 30 derniers jours.
 * Utilisé quand aucune période n'est précisée dans le filtre.
 */
function defaultFilter(base: Partial<ReportFilter> = {}): ReportFilter {
  const now     = new Date();
  const dateFrom= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dateTo  = now;
  return { dateFrom, dateTo, ...base } as ReportFilter;
}

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class DashboardService {

  constructor(
    @InjectRepository(PaiementDistribution)
    private readonly distRepo: Repository<PaiementDistribution>,

    private readonly kpiEngine:  KpiEngineService,
    private readonly analytics:  AnalyticsService,
    private readonly alertSvc:   AlertService,
    private readonly cache:      ReportingCacheService,
  ) {}

  /* ==========================================================
   * SUPER ADMIN — VUE GLOBALE PLATEFORME
   * ========================================================== */

  /**
   * Dashboard Super Admin : vision complète de la plateforme.
   * Comprend KPIs, tendances de revenus, répartition des paiements,
   * top entreprises, top livreurs et alertes actives.
   *
   * Mise en cache 2 minutes (données sensibles aux anomalies).
   */
  async getSuperAdminDashboard(filter?: Partial<ReportFilter>): Promise<SuperAdminDashboard> {
    const f  = defaultFilter({ ...filter, includeTimeSeries: true });
    const key = ReportingCacheService.keyDashboard('super_admin', 'all', f.dateFrom, f.dateTo);

    const cached = this.cache.get<SuperAdminDashboard>(key);
    if (cached) return cached;

    const [kpis, revenueTrend, disputeTrend, withdrawalTrend, paiementBreakdown,
      commissionBreakdown, topEntreprises, topLivreurs, alerts] = await Promise.all([
      this.kpiEngine.computeOverviewKpi(f),
      this.kpiEngine.getTimeSeries(ReportSection.PAIEMENTS, 'ca_brut', f),
      this.kpiEngine.getTimeSeries(ReportSection.LITIGES,   'nb_disputes', f),
      this.kpiEngine.getTimeSeries(ReportSection.RETRAITS,  'montant', f),
      this.analytics.getPaymentMethodBreakdown(f),
      this.analytics.getCommissionBreakdown(f),
      this.getTopActeurs('entreprise', f, 5),
      this.getTopActeurs('livreur',    f, 5),
      this.alertSvc.getActiveAlerts(),
    ]);

    const dashboard: SuperAdminDashboard = {
      filter:              f,
      kpis,
      revenueTrend,
      paiementBreakdown,
      disputeTrend,
      withdrawalTrend,
      commissionBreakdown,
      topEntreprises,
      topLivreurs,
      alerts,
      generatedAt: new Date(),
    };

    this.cache.setRealtime(key, dashboard);
    return dashboard;
  }

  /* ==========================================================
   * ADMIN — VISION LIMITÉE À SON PÉRIMÈTRE
   * ========================================================== */

  /**
   * Dashboard Administrateur.
   * Filtré par les distributions où l'admin figure comme adminUserId.
   * L'admin voit uniquement ses commissions et les litiges qu'il traite.
   */
  async getAdminDashboard(adminId: string, filter?: Partial<ReportFilter>): Promise<RoleDashboard> {
    const f  = defaultFilter({ ...filter, adminId, requestingUserRole: RoleFilter.ADMIN });
    const key = ReportingCacheService.keyDashboard('admin', adminId, f.dateFrom, f.dateTo);

    const cached = this.cache.get<RoleDashboard>(key);
    if (cached) return cached;

    const [commissions, litiges, trend, alerts] = await Promise.all([
      this.kpiEngine.computeCommissionKpi(f),
      this.kpiEngine.computeDisputeKpi(f),
      this.kpiEngine.getTimeSeries(ReportSection.COMMISSIONS, 'revenus_admin', f),
      this.alertSvc.getActiveAlerts({ targetRole: 'admin' }),
    ]);

    const kpis: Partial<OverviewKpi> = {
      periode:    { from: f.dateFrom, to: f.dateTo },
      commissions,
      litiges,
      chiffreAffairesBrut: 0,
      chiffreAffairesNet:  0,
      revenusShopi:        commissions.adminsTotal,
      croissance:          null,
    };

    const dashboard: RoleDashboard = {
      role:        RoleFilter.ADMIN,
      userId:      adminId,
      kpis,
      trend,
      details:     [],
      totalDetails:0,
      alerts,
      generatedAt: new Date(),
    };

    this.cache.set(key, dashboard);
    return dashboard;
  }

  /* ==========================================================
   * PARTENAIRE — COMPTES CRÉÉS PAR LUI
   * ========================================================== */

  /**
   * Dashboard Partenaire.
   * Filtré par partenaireUserId dans les distributions.
   * Le partenaire voit les revenus de tous ses comptes (entreprises, livreurs).
   */
  async getPartnerDashboard(partenaireId: string, filter?: Partial<ReportFilter>): Promise<RoleDashboard> {
    const f  = defaultFilter({ ...filter, partenaireId, requestingUserRole: RoleFilter.PARTNER });
    const key = ReportingCacheService.keyDashboard('partner', partenaireId, f.dateFrom, f.dateTo);

    const cached = this.cache.get<RoleDashboard>(key);
    if (cached) return cached;

    const [commissions, retraits, trend, alerts] = await Promise.all([
      this.kpiEngine.computeCommissionKpi(f),
      this.kpiEngine.computeRetraitKpi(f),
      this.kpiEngine.getTimeSeries(ReportSection.COMMISSIONS, 'revenus_partenaire', f),
      this.alertSvc.getActiveAlerts({ targetRole: 'partner' }),
    ]);

    /* Détail par acteur créé par ce partenaire */
    const details = await this.getActeursUnderPartenaire(partenaireId, f);

    const kpis: Partial<OverviewKpi> = {
      periode:     { from: f.dateFrom, to: f.dateTo },
      commissions,
      retraits,
      revenusShopi: commissions.partenairesTotal,
      croissance:   null,
    };

    const dashboard: RoleDashboard = {
      role:        RoleFilter.PARTNER,
      userId:      partenaireId,
      kpis,
      trend,
      details,
      totalDetails: details.length,
      alerts,
      generatedAt: new Date(),
    };

    this.cache.set(key, dashboard);
    return dashboard;
  }

  /* ==========================================================
   * ENTREPRISE — VENTES ET REVENUS
   * ========================================================== */

  /**
   * Dashboard Entreprise.
   * L'entreprise voit ses ventes, revenus, commandes, remboursements.
   * Filtré par acteurUserId = userId dans les distributions.
   */
  async getEntrepriseDashboard(userId: string, filter?: Partial<ReportFilter>): Promise<RoleDashboard> {
    const f  = defaultFilter({ ...filter, userId, requestingUserRole: RoleFilter.ENTREPRISE });
    const key = ReportingCacheService.keyDashboard('entreprise', userId, f.dateFrom, f.dateTo);

    const cached = this.cache.get<RoleDashboard>(key);
    if (cached) return cached;

    const [distributions, paiements, retraits, litiges, trend] = await Promise.all([
      this.kpiEngine.computeDistributionKpi(f),
      this.kpiEngine.computePaiementKpi(f),
      this.kpiEngine.computeRetraitKpi({ ...f, userId }),
      this.kpiEngine.computeDisputeKpi(f),
      this.kpiEngine.getTimeSeries(ReportSection.DISTRIBUTIONS, 'ventes', f),
    ]);

    const kpis: Partial<OverviewKpi> = {
      periode:              { from: f.dateFrom, to: f.dateTo },
      distributions,
      paiements,
      retraits,
      litiges,
      chiffreAffairesBrut:  distributions.montantReleased,
      chiffreAffairesNet:   distributions.montantReleased - litiges.montantRembourseTotal,
      revenusShopi:         0, // non applicable pour une entreprise
      croissance:           null,
    };

    const dashboard: RoleDashboard = {
      role:        RoleFilter.ENTREPRISE,
      userId,
      kpis,
      trend,
      details:     [],
      totalDetails:0,
      alerts:      [],
      generatedAt: new Date(),
    };

    this.cache.set(key, dashboard);
    return dashboard;
  }

  /* ==========================================================
   * LIVREUR — LIVRAISONS ET REVENUS
   * ========================================================== */

  /**
   * Dashboard Livreur.
   * Le livreur voit ses livraisons effectuées, ses revenus de livraison
   * et ses demandes de retrait.
   */
  async getLivreurDashboard(userId: string, filter?: Partial<ReportFilter>): Promise<RoleDashboard> {
    return this.buildActeurDashboard(userId, 'livreur', RoleFilter.LIVREUR, filter);
  }

  /* ==========================================================
   * CORRESPONDANT — LIVRAISONS ET REVENUS
   * ========================================================== */

  /**
   * Dashboard Correspondant.
   * Même structure que le livreur (point relais).
   */
  async getCorrespondantDashboard(userId: string, filter?: Partial<ReportFilter>): Promise<RoleDashboard> {
    return this.buildActeurDashboard(userId, 'correspondant', RoleFilter.CORRESPONDANT, filter);
  }

  /* ==========================================================
   * MÉTHODES PRIVÉES
   * ========================================================== */

  /**
   * Construction générique d'un dashboard livreur/correspondant.
   * Factorisé car ces deux rôles ont la même structure de données.
   */
  private async buildActeurDashboard(
    userId:     string,
    acteurType: string,
    role:       RoleFilter,
    filterBase?: Partial<ReportFilter>,
  ): Promise<RoleDashboard> {
    const f  = defaultFilter({ ...filterBase, userId, requestingUserRole: role });
    const key = ReportingCacheService.keyDashboard(role, userId, f.dateFrom, f.dateTo);

    const cached = this.cache.get<RoleDashboard>(key);
    if (cached) return cached;

    const [distributions, retraits, trend] = await Promise.all([
      this.kpiEngine.computeDistributionKpi(f),
      this.kpiEngine.computeRetraitKpi(f),
      this.kpiEngine.getTimeSeries(ReportSection.DISTRIBUTIONS, 'revenus', f),
    ]);

    const kpis: Partial<OverviewKpi> = {
      periode:             { from: f.dateFrom, to: f.dateTo },
      distributions,
      retraits,
      chiffreAffairesBrut: distributions.montantReleased,
      chiffreAffairesNet:  distributions.montantReleased,
      revenusShopi:        0,
      croissance:          null,
    };

    const dashboard: RoleDashboard = {
      role,
      userId,
      kpis,
      trend,
      details:     [],
      totalDetails:0,
      alerts:      [],
      generatedAt: new Date(),
    };

    this.cache.set(key, dashboard);
    return dashboard;
  }

  /**
   * Top N acteurs d'un type donné selon leur montant de distributions RELEASED.
   * Utilisé par le Super Admin pour les classements.
   */
  private async getTopActeurs(
    acteurType: string,
    filter:     ReportFilter,
    limit:      number,
  ): Promise<Array<{ userId: string; nom: string; montant: number; nbCommandes: number }>> {
    const { dateFrom, dateTo } = filter;

    const rows = await this.distRepo
      .createQueryBuilder('pd')
      .select('pd.acteurUserId', 'userId')
      .addSelect('pd.acteurNom',  'nom')
      .addSelect(
        `SUM(CASE WHEN pd.status = 'released' THEN pd.montant ELSE 0 END)`,
        'montant',
      )
      .addSelect(`COUNT(DISTINCT pd.commandeId)`, 'nbCommandes')
      .where('pd.acteurType = :type', { type: acteurType })
      .andWhere('pd.createdAt BETWEEN :from AND :to', {
        from: dateFrom, to: dateTo,
      })
      .groupBy('pd.acteurUserId, pd.acteurNom')
      .orderBy('montant', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map(r => ({
      userId:     r.userId,
      nom:        r.nom ?? '',
      montant:    +r.montant    || 0,
      nbCommandes: +r.nbCommandes || 0,
    }));
  }

  /**
   * Liste des acteurs (entreprises + livreurs) rattachés à un partenaire.
   * Retourne une ligne par acteur avec ses revenus sur la période.
   */
  private async getActeursUnderPartenaire(
    partenaireId: string,
    filter:       ReportFilter,
  ): Promise<ReportRow[]> {
    const { dateFrom, dateTo } = filter;

    const rows = await this.distRepo
      .createQueryBuilder('pd')
      .select('pd.acteurUserId', 'userId')
      .addSelect('pd.acteurNom',  'nom')
      .addSelect('pd.acteurType', 'acteurType')
      .addSelect(
        `SUM(CASE WHEN pd.status = 'released' THEN pd.montant ELSE 0 END)`,
        'revenus',
      )
      .addSelect(`COUNT(DISTINCT pd.commandeId)`, 'nbCommandes')
      .where('pd.partenaireUserId = :pid', { pid: partenaireId })
      .andWhere('pd.acteurType IN (:...types)', {
        types: ['entreprise', 'livreur', 'correspondant'],
      })
      .andWhere('pd.createdAt BETWEEN :from AND :to', {
        from: dateFrom, to: dateTo,
      })
      .groupBy('pd.acteurUserId, pd.acteurNom, pd.acteurType')
      .orderBy('revenus', 'DESC')
      .getRawMany();

    return rows.map(r => ({
      userId:      r.userId,
      nom:         r.nom,
      acteurType:  r.acteurType,
      revenus:     +r.revenus     || 0,
      nbCommandes: +r.nbCommandes || 0,
    }));
  }
}
