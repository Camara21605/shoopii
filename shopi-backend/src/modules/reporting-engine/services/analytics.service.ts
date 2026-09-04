/* ============================================================
 * FICHIER      : src/modules/reporting-engine/services/analytics.service.ts
 * MODULE       : ReportingEngine
 * ROLE         : Analyses financières approfondies et graphiques
 * RESPONSABILITES :
 *   - Générer les données de graphiques (pie, bar, line)
 *   - Calculer les tendances sur plusieurs périodes
 *   - Répartitions par méthode de paiement, type d'acteur, région
 *   - Analyse de croissance période sur période
 *   - Top acteurs (entreprises, livreurs, partenaires)
 * DEPENDANCES  :
 *   PaiementSession, PaiementDistribution, Retrait
 *   KpiEngineService (pour le calcul de croissance)
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PaiementSession }     from '../../../database/entities/paiement/paiement-session.entity';
import { PaiementDistribution, DistributionActeurType } from '../../../database/entities/paiement/paiement-distribution.entity';
import { Retrait }             from '../../../database/entities/paiement/retrait.entity';

/** Types d'acteur qui PRÉLÈVENT une commission (par opposition à
 * ENTREPRISE/LIVREUR/CORRESPONDANT, qui reçoivent leur revenu produit/
 * livraison — même distinction que dans WalletService.getSummary()). */
const COMMISSION_ACTEUR_TYPES: string[] = [
  DistributionActeurType.PLATEFORME_PRODUIT,
  DistributionActeurType.PLATEFORME_LIVRAISON,
  DistributionActeurType.PARTENAIRE_PRODUIT,
  DistributionActeurType.PARTENAIRE_LIVRAISON,
  DistributionActeurType.ADMIN_PRODUIT,
  DistributionActeurType.ADMIN_LIVRAISON,
  DistributionActeurType.PLATEFORME,
  DistributionActeurType.PARTENAIRE,
];

import { KpiEngineService }   from './kpi-engine.service';
import { ReportingCacheService } from './reporting-cache.service';

import {
  ReportFilter,
  ReportSection,
  ChartData,
  ChartDataset,
  TimeSeriesData,
  GrowthAnalysis,
  ActeurStats,
  ProviderStats,
  ReportErreur,
  ReportErreurType,
} from '../types/reporting.types';

/* ============================================================
 * COULEURS PRÉDÉFINIES POUR LES GRAPHIQUES
 * ============================================================ */

const CHART_COLORS = [
  '#F5A623', '#00C88A', '#8B5CF6', '#38BDF8',
  '#F87171', '#4ADE80', '#FBBF24', '#818CF8',
];

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class AnalyticsService {

  constructor(
    @InjectRepository(PaiementSession)
    private readonly sessionRepo: Repository<PaiementSession>,

    @InjectRepository(PaiementDistribution)
    private readonly distRepo: Repository<PaiementDistribution>,

    @InjectRepository(Retrait)
    private readonly retraitRepo: Repository<Retrait>,

    private readonly kpiEngine: KpiEngineService,
    private readonly cache:     ReportingCacheService,
  ) {}

  /* ==========================================================
   * RÉPARTITIONS (PIE / DONUT)
   * ========================================================== */

  /**
   * Répartition des paiements confirmés par méthode de paiement.
   * Données pour un graphique en secteurs (pie/donut).
   */
  async getPaymentMethodBreakdown(filter: ReportFilter): Promise<ChartData> {
    const key = ReportingCacheService.keyTimeSeries(
      'paiements', 'methode_breakdown', 'day', filter.dateFrom, filter.dateTo,
    );
    const cached = this.cache.get<ChartData>(key);
    if (cached) return cached;

    const rows = await this.sessionRepo
      .createQueryBuilder('ps')
      .select('ps.methode', 'methode')
      .addSelect(
        `SUM(CASE WHEN ps.status = 'confirmed' THEN ps.montant ELSE 0 END)`,
        'montant',
      )
      .addSelect(
        `COUNT(CASE WHEN ps.status = 'confirmed' THEN 1 END)`,
        'nb',
      )
      .where('ps.createdAt BETWEEN :from AND :to', {
        from: filter.dateFrom, to: filter.dateTo,
      })
      .groupBy('ps.methode')
      .orderBy('montant', 'DESC')
      .getRawMany();

    const total  = rows.reduce((s, r) => s + (+r.montant || 0), 0);
    const result: ChartData = {
      labels:   rows.map(r => r.methode ?? 'Inconnu'),
      total,
      datasets: [{
        label: 'Montant confirmé (GNF)',
        data:  rows.map(r => +r.montant || 0),
        color: CHART_COLORS[0],
      }, {
        label: 'Nombre de transactions',
        data:  rows.map(r => +r.nb || 0),
        color: CHART_COLORS[1],
      }],
    };

    this.cache.set(key, result);
    return result;
  }

  /**
   * Répartition des commissions libérées par type d'acteur.
   * Données pour un graphique en secteurs montrant la distribution
   * des revenus entre Shopi, partenaires, admins, entreprises, livreurs.
   */
  async getCommissionBreakdown(filter: ReportFilter): Promise<ChartData> {
    const key = ReportingCacheService.keyTimeSeries(
      'commissions', 'acteur_breakdown', 'day', filter.dateFrom, filter.dateTo,
    );
    const cached = this.cache.get<ChartData>(key);
    if (cached) return cached;

    const rows = await this.distRepo
      .createQueryBuilder('pd')
      .select('pd.acteurType', 'acteurType')
      .addSelect(
        `SUM(CASE WHEN pd.status = 'released' THEN pd.montant ELSE 0 END)`,
        'montant',
      )
      .addSelect('COUNT(*)', 'nb')
      .where('pd.createdAt BETWEEN :from AND :to', {
        from: filter.dateFrom, to: filter.dateTo,
      })
      .groupBy('pd.acteurType')
      .orderBy('montant', 'DESC')
      .getRawMany();

    const total  = rows.reduce((s, r) => s + (+r.montant || 0), 0);
    const result: ChartData = {
      labels:   rows.map(r => this.labelActeurType(r.acteurType)),
      total,
      datasets: [{
        label: 'Revenus libérés (GNF)',
        data:  rows.map(r => +r.montant || 0),
        color: CHART_COLORS[0],
      }],
    };

    this.cache.set(key, result);
    return result;
  }

  /**
   * Répartition par provider de paiement (Orange Money, MTN, Wave…).
   */
  async getProviderBreakdown(filter: ReportFilter): Promise<ChartData> {
    const rows = await this.sessionRepo
      .createQueryBuilder('ps')
      .select('ps.provider', 'provider')
      .addSelect(
        `COUNT(CASE WHEN ps.status = 'confirmed' THEN 1 END)`,
        'confirmed',
      )
      .addSelect(
        `COUNT(CASE WHEN ps.status IN ('failed','expired') THEN 1 END)`,
        'failed',
      )
      .addSelect(
        `SUM(CASE WHEN ps.status = 'confirmed' THEN ps.montant ELSE 0 END)`,
        'montant',
      )
      .where('ps.createdAt BETWEEN :from AND :to', {
        from: filter.dateFrom, to: filter.dateTo,
      })
      .groupBy('ps.provider')
      .orderBy('confirmed', 'DESC')
      .getRawMany();

    const confirmedDataset: ChartDataset = {
      label: 'Confirmés',
      data:  rows.map(r => +r.confirmed || 0),
      color: CHART_COLORS[1],
    };
    const failedDataset: ChartDataset = {
      label: 'Échoués/Expirés',
      data:  rows.map(r => +r.failed || 0),
      color: CHART_COLORS[4],
    };

    return {
      labels:   rows.map(r => r.provider),
      datasets: [confirmedDataset, failedDataset],
      total:    rows.reduce((s, r) => s + (+r.confirmed || 0), 0),
    };
  }

  /* ==========================================================
   * TENDANCES MULTI-PÉRIODES (LINE CHARTS)
   * ========================================================== */

  /**
   * Tendance du chiffre d'affaires sur plusieurs périodes successives.
   * Retourne une série temporelle utilisable par un graphique en lignes.
   * Les séries comparées (période actuelle vs précédente) sont incluses
   * dans datasets pour permettre un graphique de comparaison.
   */
  async getRevenueTrend(filter: ReportFilter): Promise<ChartData> {
    const series = await this.kpiEngine.getTimeSeries(
      ReportSection.PAIEMENTS, 'ca_brut', filter,
    );

    return {
      labels:   series.points.map(p => p.label ?? p.date),
      total:    series.total,
      datasets: [{
        label: 'CA Brut (GNF)',
        data:  series.points.map(p => p.value),
        color: CHART_COLORS[0],
      }, {
        label: 'Nb transactions',
        data:  series.points.map(p => p.count ?? 0),
        color: CHART_COLORS[1],
      }],
    };
  }

  /**
   * Tendance des litiges sur la période.
   * Permet d'identifier des pics anormaux d'insatisfaction.
   */
  async getDisputeTrend(filter: ReportFilter): Promise<ChartData> {
    const series = await this.kpiEngine.getTimeSeries(
      ReportSection.LITIGES, 'nb_disputes', filter,
    );

    return {
      labels:   series.points.map(p => p.label ?? p.date),
      total:    series.total,
      datasets: [{
        label: 'Nombre de litiges',
        data:  series.points.map(p => p.value),
        color: CHART_COLORS[4],
      }],
    };
  }

  /**
   * Tendance des retraits complétés sur la période.
   */
  async getWithdrawalTrend(filter: ReportFilter): Promise<ChartData> {
    const series = await this.kpiEngine.getTimeSeries(
      ReportSection.RETRAITS, 'montant', filter,
    );

    return {
      labels:   series.points.map(p => p.label ?? p.date),
      total:    series.total,
      datasets: [{
        label: 'Retraits complétés (GNF)',
        data:  series.points.map(p => p.value),
        color: CHART_COLORS[2],
      }],
    };
  }

  /* ==========================================================
   * TOP ACTEURS
   * ========================================================== */

  /**
   * Top N entreprises par montant de distributions libérées.
   */
  async getTopEntreprises(filter: ReportFilter, limit = 10): Promise<ActeurStats[]> {
    return this.getTopByActeurType('entreprise', filter, limit);
  }

  /**
   * Top N livreurs par montant de distributions libérées.
   */
  async getTopLivreurs(filter: ReportFilter, limit = 10): Promise<ActeurStats[]> {
    return this.getTopByActeurType('livreur', filter, limit);
  }

  /**
   * Top N partenaires par montant de commissions libérées.
   */
  async getTopPartenaires(filter: ReportFilter, limit = 10): Promise<ActeurStats[]> {
    return this.getTopByActeurType('partenaire_produit', filter, limit);
  }

  /* ==========================================================
   * STATISTIQUES PROVIDERS
   * ========================================================== */

  /**
   * Statistiques détaillées par provider de paiement.
   * Inclut le taux de réussite, le volume et les échecs.
   */
  async getProviderStats(filter: ReportFilter): Promise<ProviderStats[]> {
    const rows = await this.sessionRepo
      .createQueryBuilder('ps')
      .select('ps.provider', 'provider')
      .addSelect('COUNT(*)', 'totalSessions')
      .addSelect(
        `COUNT(CASE WHEN ps.status = 'confirmed' THEN 1 END)`,
        'confirmed',
      )
      .addSelect(
        `COUNT(CASE WHEN ps.status IN ('failed','cancelled') THEN 1 END)`,
        'failed',
      )
      .addSelect(
        `COUNT(CASE WHEN ps.status = 'expired' THEN 1 END)`,
        'expired',
      )
      .addSelect(`SUM(ps.montant)`, 'montantTotal')
      .addSelect(
        `SUM(CASE WHEN ps.status = 'confirmed' THEN ps.montant ELSE 0 END)`,
        'montantConfirme',
      )
      .where('ps.createdAt BETWEEN :from AND :to', {
        from: filter.dateFrom, to: filter.dateTo,
      })
      .groupBy('ps.provider')
      .orderBy('totalSessions', 'DESC')
      .getRawMany();

    return rows.map(r => {
      const total       = +r.totalSessions || 0;
      const confirmed   = +r.confirmed     || 0;
      const failed      = +r.failed        || 0;
      const expired     = +r.expired       || 0;
      const denomReuss  = confirmed + failed + expired;
      return {
        provider:        r.provider,
        totalSessions:   total,
        confirmed,
        failed,
        expired,
        tauxReussite: denomReuss > 0
          ? Math.round((confirmed / denomReuss) * 10000) / 100
          : 0,
        montantTotal:    +r.montantTotal    || 0,
        montantConfirme: +r.montantConfirme || 0,
      };
    });
  }

  /* ==========================================================
   * ANALYSE DE CROISSANCE
   * ========================================================== */

  /**
   * Analyse de croissance du CA brut vs la période précédente équivalente.
   * Délègue au KpiEngineService qui gère le calcul comparatif.
   */
  async getGrowthAnalysis(filter: ReportFilter): Promise<GrowthAnalysis> {
    return this.kpiEngine.computeGrowthAnalysis(filter);
  }

  /* ==========================================================
   * MÉTHODES PRIVÉES
   * ========================================================== */

  /**
   * Récupère le top N acteurs d'un type donné.
   * Inclut les statistiques de revenus et de commandes.
   */
  private async getTopByActeurType(
    acteurType: string,
    filter:     ReportFilter,
    limit:      number,
  ): Promise<ActeurStats[]> {
    const rows = await this.distRepo
      .createQueryBuilder('pd')
      .select('pd.acteurUserId', 'userId')
      .addSelect('pd.acteurNom',   'nom')
      .addSelect('pd.acteurType',  'role')
      .addSelect(
        `SUM(CASE WHEN pd.status = 'released' THEN pd.montant ELSE 0 END)`,
        'montantTotal',
      )
      .addSelect(`COUNT(DISTINCT pd.commandeId)`, 'nbCommandes')
      .where('pd.acteurType = :type', { type: acteurType })
      .andWhere('pd.createdAt BETWEEN :from AND :to', {
        from: filter.dateFrom, to: filter.dateTo,
      })
      .groupBy('pd.acteurUserId, pd.acteurNom, pd.acteurType')
      .orderBy('montantTotal', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map(r => {
      const montantTotal = +r.montantTotal || 0;
      return {
        userId:          r.userId,
        nom:             r.nom       ?? '',
        role:            r.role,
        nbCommandes:     +r.nbCommandes || 0,
        montantTotal,
        /* montantTotal est déjà, pour un acteurType "préleveur de
         * commission" (plateforme/partenaire/admin), le montant de
         * commission perçu — pas une valeur distincte à recalculer. */
        commissions:     COMMISSION_ACTEUR_TYPES.includes(r.role) ? montantTotal : 0,
        nbRetraits:      0,
        balanceActuelle: 0,
      };
    });
  }

  /**
   * Mappe le type d'acteur vers un libellé lisible pour les graphiques.
   */
  private labelActeurType(type: string): string {
    const labels: Record<string, string> = {
      entreprise:           'Entreprises',
      livreur:              'Livreurs',
      correspondant:        'Correspondants',
      partenaire:           'Partenaires',
      partenaire_produit:   'Partenaires Produit',
      partenaire_livraison: 'Partenaires Livraison',
      plateforme:           'Shopi',
      plateforme_produit:   'Shopi Produit',
      plateforme_livraison: 'Shopi Livraison',
      admin_produit:        'Admins Produit',
      admin_livraison:      'Admins Livraison',
    };
    return labels[type] ?? type;
  }
}
