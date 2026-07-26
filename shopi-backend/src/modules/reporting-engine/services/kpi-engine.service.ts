/* ============================================================
 * FICHIER      : src/modules/reporting-engine/services/kpi-engine.service.ts
 * MODULE       : ReportingEngine
 * ROLE         : Moteur de calcul des indicateurs clés de performance (KPIs)
 * RESPONSABILITES :
 *   - Calculer chaque KPI financier par section via QueryBuilder PostgreSQL
 *   - Calculer les séries temporelles pour les graphiques
 *   - Calculer le taux de croissance période sur période
 *   - Appliquer les filtres de période, acteur et rôle
 *   - Retourner le KPI global (OverviewKpi) consolidé
 *
 * SOURCES DE DONNÉES :
 *   - paiement_sessions     → PaiementKpi
 *   - paiement_distributions → CommissionKpi + DistributionKpi
 *   - wallets               → WalletKpi (point-in-time)
 *   - retraits              → RetraitKpi
 *   - disputes              → DisputeKpi
 *
 * OPTIMISATIONS :
 *   - Un seul SELECT par section (CASE WHEN inline ou FILTER PostgreSQL)
 *   - Promise.all pour les 6 sections en parallèle dans computeOverviewKpi
 *   - Indexes couvrants sur (status, createdAt) pour les requêtes filtrées
 *
 * DEPENDANCES  :
 *   PaiementSession, PaiementDistribution, Wallet, Retrait, Dispute
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PaiementSession }     from '../../../database/entities/paiement/paiement-session.entity';
import { PaiementDistribution, DistributionActeurType } from '../../../database/entities/paiement/paiement-distribution.entity';
import { Wallet }              from '../../../database/entities/wallet.entity';
import { Retrait }             from '../../../database/entities/paiement/retrait.entity';
import { Dispute }             from '../../../database/entities/paiement/dispute.entity';

import {
  ReportFilter,
  ReportSection,
  TimeGranularity,
  TimeSeriesData,
  TimeSeriesPoint,
  PaiementKpi,
  CommissionKpi,
  WalletKpi,
  RetraitKpi,
  DisputeKpi,
  DistributionKpi,
  OverviewKpi,
  GrowthAnalysis,
  ReportErreur,
  ReportErreurType,
} from '../types/reporting.types';

/* ============================================================
 * CONSTANTES
 * ============================================================ */

/** Multiplicateur considéré comme un "spike" (3× la normale) */
const SPIKE_MULTIPLIER = 3.0;

/** Acteur types dont les montants vont dans les revenus Shopi */
const SHOPI_PRODUCT_TYPES   = [DistributionActeurType.PLATEFORME_PRODUIT,   DistributionActeurType.PLATEFORME];
const SHOPI_DELIVERY_TYPES  = [DistributionActeurType.PLATEFORME_LIVRAISON];
const PARTNER_PRODUCT_TYPES = [DistributionActeurType.PARTENAIRE_PRODUIT,   DistributionActeurType.PARTENAIRE];
const PARTNER_DELIVERY_TYPES= [DistributionActeurType.PARTENAIRE_LIVRAISON];
const ADMIN_PRODUCT_TYPES   = [DistributionActeurType.ADMIN_PRODUIT];
const ADMIN_DELIVERY_TYPES  = [DistributionActeurType.ADMIN_LIVRAISON];

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class KpiEngineService {

  constructor(
    @InjectRepository(PaiementSession)
    private readonly sessionRepo: Repository<PaiementSession>,

    @InjectRepository(PaiementDistribution)
    private readonly distRepo: Repository<PaiementDistribution>,

    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    @InjectRepository(Retrait)
    private readonly retraitRepo: Repository<Retrait>,

    @InjectRepository(Dispute)
    private readonly disputeRepo: Repository<Dispute>,
  ) {}

  /* ==========================================================
   * API PUBLIQUE — KPIs PAR SECTION
   * ========================================================== */

  /**
   * Calcule tous les KPIs en parallèle et retourne l'OverviewKpi consolidé.
   * C'est la méthode principale pour les tableaux de bord super admin.
   *
   * Promise.all garantit que les 6 requêtes s'exécutent simultanément
   * sur la base de données, minimisant le temps de réponse total.
   */
  async computeOverviewKpi(filter: ReportFilter): Promise<OverviewKpi> {
    this.validateFilter(filter);

    const [paiements, commissions, wallets, retraits, litiges, distributions] =
      await Promise.all([
        this.computePaiementKpi(filter),
        this.computeCommissionKpi(filter),
        this.computeWalletKpi(),
        this.computeRetraitKpi(filter),
        this.computeDisputeKpi(filter),
        this.computeDistributionKpi(filter),
      ]);

    const chiffreAffairesBrut = paiements.montantConfirme;
    const chiffreAffairesNet  = chiffreAffairesBrut - paiements.montantRembourse;
    const revenusShopi        = commissions.shopiTotal;

    /* Calcule la croissance CA brut vs période précédente équivalente */
    const croissance = await this.computeGrowthRate(chiffreAffairesBrut, filter);

    return {
      periode: { from: filter.dateFrom, to: filter.dateTo },
      paiements,
      commissions,
      wallets,
      retraits,
      litiges,
      distributions,
      chiffreAffairesBrut,
      chiffreAffairesNet,
      revenusShopi,
      croissance,
    };
  }

  /**
   * KPIs section Paiements.
   * Un seul SELECT agrégé sur paiement_sessions.
   */
  async computePaiementKpi(filter: ReportFilter): Promise<PaiementKpi> {
    const { from, to } = this.periodeBounds(filter);

    /* Requête principale — tous les agrégats en un seul passage */
    const raw = await this.sessionRepo
      .createQueryBuilder('ps')
      .select('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN ps.status = 'confirmed' THEN ps.montant ELSE 0 END)`,
        'montantConfirme',
      )
      .addSelect(
        `SUM(CASE WHEN ps.status IN ('refunded','partially_refunded') THEN ps.montant ELSE 0 END)`,
        'montantRembourse',
      )
      .addSelect(
        `COUNT(CASE WHEN ps.status = 'confirmed' THEN 1 END)`,
        'nbConfirmes',
      )
      .addSelect(
        `COUNT(CASE WHEN ps.status IN ('failed','cancelled') THEN 1 END)`,
        'nbEchoues',
      )
      .addSelect(
        `COUNT(CASE WHEN ps.status = 'expired' THEN 1 END)`,
        'nbExpires',
      )
      .addSelect(
        `AVG(CASE WHEN ps.status = 'confirmed' THEN ps.montant END)`,
        'panierMoyen',
      )
      .where('ps.createdAt BETWEEN :from AND :to', { from, to })
      .getRawOne();

    /* Répartition par provider */
    const byProvider = await this.sessionRepo
      .createQueryBuilder('ps')
      .select('ps.provider', 'provider')
      .addSelect(
        `COUNT(CASE WHEN ps.status = 'confirmed' THEN 1 END)`,
        'nb',
      )
      .addSelect(
        `SUM(CASE WHEN ps.status = 'confirmed' THEN ps.montant ELSE 0 END)`,
        'montant',
      )
      .where('ps.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('ps.provider')
      .getRawMany();

    /* Répartition par méthode */
    const byMethode = await this.sessionRepo
      .createQueryBuilder('ps')
      .select('ps.methode', 'methode')
      .addSelect(
        `COUNT(CASE WHEN ps.status = 'confirmed' THEN 1 END)`,
        'nb',
      )
      .addSelect(
        `SUM(CASE WHEN ps.status = 'confirmed' THEN ps.montant ELSE 0 END)`,
        'montant',
      )
      .where('ps.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('ps.methode')
      .getRawMany();

    const total       = +raw.total       || 0;
    const nbConfirmes = +raw.nbConfirmes || 0;
    const nbEchoues   = +raw.nbEchoues   || 0;
    const nbExpires   = +raw.nbExpires   || 0;
    const denomReussite = nbConfirmes + nbEchoues + nbExpires;

    return {
      total,
      montantTotal:     0, // total initié (toutes sessions)
      montantConfirme:  +raw.montantConfirme || 0,
      montantRembourse: +raw.montantRembourse || 0,
      nbConfirmes,
      nbEchoues,
      nbExpires,
      tauxReussite: denomReussite > 0
        ? Math.round((nbConfirmes / denomReussite) * 10000) / 100
        : 0,
      panierMoyen: +raw.panierMoyen || 0,
      parProvider: byProvider.reduce((acc, r) => {
        acc[r.provider] = { nb: +r.nb || 0, montant: +r.montant || 0 };
        return acc;
      }, {} as Record<string, { nb: number; montant: number }>),
      parMethode: byMethode.reduce((acc, r) => {
        acc[r.methode] = { nb: +r.nb || 0, montant: +r.montant || 0 };
        return acc;
      }, {} as Record<string, { nb: number; montant: number }>),
    };
  }

  /**
   * KPIs section Commissions.
   * Agrège paiement_distributions par acteurType.
   *
   * Cloisonnement par rôle :
   *   PARTNER  → filtre acteurUserId = partenaireId
   *   ADMIN    → filtre acteurUserId = adminId
   *   SUPER_ADMIN → pas de filtre additionnel
   */
  async computeCommissionKpi(filter: ReportFilter): Promise<CommissionKpi> {
    const { from, to } = this.periodeBounds(filter);

    const qb = this.distRepo
      .createQueryBuilder('pd')
      .select('pd.acteurType', 'acteurType')
      .addSelect(
        `SUM(CASE WHEN pd.status = 'released' THEN pd.montant ELSE 0 END)`,
        'montantReleased',
      )
      .addSelect(
        `SUM(CASE WHEN pd.status = 'escrow' THEN pd.montant ELSE 0 END)`,
        'montantEscrow',
      )
      .addSelect('COUNT(*)', 'nb')
      .where('pd.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('pd.acteurType');

    /* Filtre partenaire : ne voit que ses propres distributions */
    if (filter.partenaireId) {
      qb.andWhere('pd.partenaireUserId = :pid', { pid: filter.partenaireId });
    }
    /* Filtre admin */
    if (filter.adminId) {
      qb.andWhere('pd.adminUserId = :aid', { aid: filter.adminId });
    }

    const rows = await qb.getRawMany();

    const byType: Record<string, { released: number; escrow: number }> = {};
    for (const r of rows) {
      byType[r.acteurType] = {
        released: +r.montantReleased || 0,
        escrow:   +r.montantEscrow   || 0,
      };
    }

    const get = (keys: string[]) =>
      keys.reduce((sum, k) => sum + (byType[k]?.released ?? 0), 0);
    const getEsc = (keys: string[]) =>
      keys.reduce((sum, k) => sum + (byType[k]?.escrow ?? 0), 0);

    const shopiProduit       = get([...SHOPI_PRODUCT_TYPES]);
    const shopiLivraison     = get([...SHOPI_DELIVERY_TYPES]);
    const partenairesProduit = get([...PARTNER_PRODUCT_TYPES]);
    const partenairesLivraison = get([...PARTNER_DELIVERY_TYPES]);
    const adminsProduit      = get([...ADMIN_PRODUCT_TYPES]);
    const adminsLivraison    = get([...ADMIN_DELIVERY_TYPES]);
    const livreurs           = get([DistributionActeurType.LIVREUR]);
    const correspondants     = get([DistributionActeurType.CORRESPONDANT]);
    const entreprises        = get([DistributionActeurType.ENTREPRISE]);

    const totalDistribue = Object.values(byType).reduce(
      (s, v) => s + v.released, 0,
    );
    const enEscrow = Object.values(byType).reduce(
      (s, v) => s + v.escrow, 0,
    );

    return {
      shopiProduit,
      shopiLivraison,
      shopiTotal: shopiProduit + shopiLivraison,
      partenairesProduit,
      partenairesLivraison,
      partenairesTotal: partenairesProduit + partenairesLivraison,
      adminsProduit,
      adminsLivraison,
      adminsTotal: adminsProduit + adminsLivraison,
      livreurs,
      correspondants,
      entreprises,
      totalDistribue,
      enEscrow,
    };
  }

  /**
   * KPIs section Wallets.
   * Point-in-time : snapshot de l'état actuel (pas de filtre de date).
   */
  async computeWalletKpi(): Promise<WalletKpi> {
    const raw = await this.walletRepo
      .createQueryBuilder('w')
      .select('COUNT(*)', 'total')
      .addSelect(`COUNT(CASE WHEN w.status = 'active'  THEN 1 END)`, 'actifs')
      .addSelect(`COUNT(CASE WHEN w.status = 'frozen'  THEN 1 END)`, 'frozen')
      .addSelect(`COUNT(CASE WHEN w.status = 'closed'  THEN 1 END)`, 'fermes')
      .addSelect('SUM(w.balance)',         'balanceTotale')
      .addSelect('SUM(w.pendingBalance)',  'pendingTotal')
      .addSelect('SUM(w.blockedBalance)',  'blockedTotal')
      .addSelect('SUM(w.totalCredited)',   'totalCredite')
      .addSelect('SUM(w.totalDebited)',    'totalDebite')
      .getRawOne();

    /* Répartition par type de wallet */
    const byType = await this.walletRepo
      .createQueryBuilder('w')
      .select('w.walletType', 'walletType')
      .addSelect('COUNT(*)', 'nb')
      .addSelect('SUM(w.balance)', 'balance')
      .groupBy('w.walletType')
      .getRawMany();

    return {
      totalWallets:          +raw.total        || 0,
      walletsActifs:         +raw.actifs        || 0,
      walletsFrozen:         +raw.frozen        || 0,
      walletsFermes:         +raw.fermes        || 0,
      balanceTotale:         +raw.balanceTotale || 0,
      pendingBalanceTotale:  +raw.pendingTotal  || 0,
      blockedBalanceTotale:  +raw.blockedTotal  || 0,
      totalCredite:          +raw.totalCredite  || 0,
      totalDebite:           +raw.totalDebite   || 0,
      parType: byType.reduce((acc, r) => {
        acc[r.walletType] = { nb: +r.nb || 0, balance: +r.balance || 0 };
        return acc;
      }, {} as Record<string, { nb: number; balance: number }>),
    };
  }

  /**
   * KPIs section Retraits.
   * Filtrés par periode (requestedAt) et optionnellement par userId.
   */
  async computeRetraitKpi(filter: ReportFilter): Promise<RetraitKpi> {
    const { from, to } = this.periodeBounds(filter);

    const qb = this.retraitRepo
      .createQueryBuilder('r')
      .select('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN r.status = 'completed' THEN r.montantNet ELSE 0 END)`,
        'montantCompleted',
      )
      .addSelect(
        `SUM(CASE WHEN r.status = 'failed' THEN r.montant ELSE 0 END)`,
        'montantFailed',
      )
      .addSelect(
        `SUM(CASE WHEN r.status IN ('pending','processing') THEN r.montant ELSE 0 END)`,
        'montantPending',
      )
      .addSelect('SUM(r.montant)', 'montantTotal')
      .addSelect('SUM(r.frais)',   'fraisTotal')
      .addSelect(
        `COUNT(CASE WHEN r.status = 'completed' THEN 1 END)`,
        'nbCompleted',
      )
      .addSelect(
        `COUNT(CASE WHEN r.status = 'failed' THEN 1 END)`,
        'nbFailed',
      )
      .where('r.requestedAt BETWEEN :from AND :to', { from, to });

    if (filter.userId) {
      qb.andWhere('r.userId = :uid', { uid: filter.userId });
    }

    const raw = await qb.getRawOne();

    /* Répartition par méthode */
    const methodeQb = this.retraitRepo
      .createQueryBuilder('r')
      .select('r.methode', 'methode')
      .addSelect(`COUNT(CASE WHEN r.status = 'completed' THEN 1 END)`, 'nb')
      .addSelect(
        `SUM(CASE WHEN r.status = 'completed' THEN r.montantNet ELSE 0 END)`,
        'montant',
      )
      .where('r.requestedAt BETWEEN :from AND :to', { from, to })
      .groupBy('r.methode');

    if (filter.userId) {
      methodeQb.andWhere('r.userId = :uid', { uid: filter.userId });
    }
    const byMethode = await methodeQb.getRawMany();

    const total       = +raw.total       || 0;
    const nbCompleted = +raw.nbCompleted || 0;

    return {
      total,
      montantTotal:    +raw.montantTotal    || 0,
      montantCompleted:+raw.montantCompleted|| 0,
      montantFailed:   +raw.montantFailed   || 0,
      montantPending:  +raw.montantPending  || 0,
      fraisTotal:      +raw.fraisTotal      || 0,
      nbCompleted,
      nbFailed:        +raw.nbFailed        || 0,
      tauxReussite: total > 0
        ? Math.round((nbCompleted / total) * 10000) / 100
        : 0,
      parMethode: byMethode.reduce((acc, r) => {
        acc[r.methode] = { nb: +r.nb || 0, montant: +r.montant || 0 };
        return acc;
      }, {} as Record<string, { nb: number; montant: number }>),
    };
  }

  /**
   * KPIs section Litiges.
   * Inclut délai moyen de résolution (calculé via EXTRACT EPOCH en PostgreSQL).
   */
  async computeDisputeKpi(filter: ReportFilter): Promise<DisputeKpi> {
    const { from, to } = this.periodeBounds(filter);

    const qb = this.disputeRepo
      .createQueryBuilder('d')
      .select('COUNT(*)', 'total')
      .addSelect(
        `COUNT(CASE WHEN d.status IN ('open','under_review','waiting_for_evidence','decision_pending') THEN 1 END)`,
        'ouverts',
      )
      .addSelect(
        `COUNT(CASE WHEN d.status IN ('under_review','waiting_for_evidence','decision_pending') THEN 1 END)`,
        'enInstruction',
      )
      .addSelect(
        `COUNT(CASE WHEN d.status IN ('approved','rejected','refunded') THEN 1 END)`,
        'resolus',
      )
      .addSelect(
        `COUNT(CASE WHEN d.status = 'closed' THEN 1 END)`,
        'fermes',
      )
      .addSelect('SUM(d.montantConteste)', 'montantContesteTotale')
      .addSelect(
        `SUM(CASE WHEN d.montantRembourse IS NOT NULL THEN d.montantRembourse ELSE 0 END)`,
        'montantRembourseTotal',
      )
      /* Délai moyen de résolution en heures */
      .addSelect(
        `AVG(CASE WHEN d.resolvedAt IS NOT NULL
           THEN EXTRACT(EPOCH FROM (d.resolvedAt - d.openedAt)) / 3600
           ELSE NULL
         END)`,
        'delaiMoyenHeures',
      )
      .where('d.openedAt BETWEEN :from AND :to', { from, to });

    if (filter.adminId) {
      qb.andWhere('d.adminUserId = :aid', { aid: filter.adminId });
    }

    const raw = await qb.getRawOne();

    /* Répartition par motif */
    const motifQb = this.disputeRepo
      .createQueryBuilder('d')
      .select('d.motif', 'motif')
      .addSelect('COUNT(*)', 'nb')
      .where('d.openedAt BETWEEN :from AND :to', { from, to })
      .groupBy('d.motif');

    /* Répartition par décision */
    const decisionQb = this.disputeRepo
      .createQueryBuilder('d')
      .select('d.decision', 'decision')
      .addSelect('COUNT(*)', 'nb')
      .where('d.openedAt BETWEEN :from AND :to', { from, to })
      .andWhere('d.decision IS NOT NULL')
      .groupBy('d.decision');

    const [byMotif, byDecision] = await Promise.all([
      motifQb.getRawMany(),
      decisionQb.getRawMany(),
    ]);

    /* Nombre de paiements confirmés sur la même période (dénominateur du taux) */
    const nbPayments = await this.sessionRepo
      .createQueryBuilder('ps')
      .select(`COUNT(CASE WHEN ps.status = 'confirmed' THEN 1 END)`, 'nb')
      .where('ps.createdAt BETWEEN :from AND :to', { from, to })
      .getRawOne();

    const nbConfirmes         = +nbPayments.nb || 0;
    const montantConteste     = +raw.montantContesteTotale || 0;
    const montantRembourse    = +raw.montantRembourseTotal || 0;
    const totalDisputes       = +raw.total || 0;

    return {
      total:           totalDisputes,
      ouverts:         +raw.ouverts      || 0,
      enInstruction:   +raw.enInstruction|| 0,
      resolus:         +raw.resolus      || 0,
      fermes:          +raw.fermes       || 0,
      tauxLitiges: nbConfirmes > 0
        ? Math.round((totalDisputes / nbConfirmes) * 10000) / 100
        : 0,
      montantContesteTotale: montantConteste,
      montantRembourseTotal: montantRembourse,
      tauxRemboursement: montantConteste > 0
        ? Math.round((montantRembourse / montantConteste) * 10000) / 100
        : 0,
      parMotif: byMotif.reduce((acc, r) => {
        acc[r.motif] = +r.nb || 0;
        return acc;
      }, {} as Record<string, number>),
      parDecision: byDecision.reduce((acc, r) => {
        if (r.decision) acc[r.decision] = +r.nb || 0;
        return acc;
      }, {} as Record<string, number>),
      delaiMoyenResolutionHeures: Math.round((+raw.delaiMoyenHeures || 0) * 10) / 10,
    };
  }

  /**
   * KPIs section Distributions.
   * Vue d'ensemble de toutes les distributions sur la période.
   */
  async computeDistributionKpi(filter: ReportFilter): Promise<DistributionKpi> {
    const { from, to } = this.periodeBounds(filter);

    const qb = this.distRepo
      .createQueryBuilder('pd')
      .select('COUNT(*)', 'total')
      .addSelect('SUM(pd.montant)', 'montantTotal')
      .addSelect(
        `SUM(CASE WHEN pd.status = 'released'  THEN pd.montant ELSE 0 END)`,
        'montantReleased',
      )
      .addSelect(
        `SUM(CASE WHEN pd.status = 'escrow'    THEN pd.montant ELSE 0 END)`,
        'montantEscrow',
      )
      .addSelect(
        `SUM(CASE WHEN pd.status = 'cancelled' THEN pd.montant ELSE 0 END)`,
        'montantCancelled',
      )
      .addSelect(
        `SUM(CASE WHEN pd.status = 'refunded'  THEN pd.montant ELSE 0 END)`,
        'montantRefunded',
      )
      .where('pd.createdAt BETWEEN :from AND :to', { from, to });

    if (filter.userId) {
      qb.andWhere('pd.acteurUserId = :uid', { uid: filter.userId });
    }

    const raw = await qb.getRawOne();

    /* Répartition par acteurType */
    const byTypeQb = this.distRepo
      .createQueryBuilder('pd')
      .select('pd.acteurType', 'acteurType')
      .addSelect('COUNT(*)', 'nb')
      .addSelect(`SUM(CASE WHEN pd.status = 'released' THEN pd.montant ELSE 0 END)`, 'montant')
      .where('pd.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('pd.acteurType');

    const byType = await byTypeQb.getRawMany();

    return {
      total:           +raw.total           || 0,
      montantTotal:    +raw.montantTotal    || 0,
      montantReleased: +raw.montantReleased || 0,
      montantEscrow:   +raw.montantEscrow   || 0,
      montantCancelled:+raw.montantCancelled|| 0,
      montantRefunded: +raw.montantRefunded || 0,
      parActeurType: byType.reduce((acc, r) => {
        acc[r.acteurType] = { nb: +r.nb || 0, montant: +r.montant || 0 };
        return acc;
      }, {} as Record<string, { nb: number; montant: number }>),
    };
  }

  /* ==========================================================
   * SÉRIES TEMPORELLES
   * ========================================================== */

  /**
   * Génère une série temporelle pour un graphique.
   * La granularité est déduite automatiquement de la durée de la période
   * si non précisée dans le filtre.
   *
   * @param section  Section financière source (PAIEMENTS, RETRAITS, etc.)
   * @param metric   Nom de la métrique ('ca_brut', 'nb_transactions', etc.)
   * @param filter   Filtre avec période et contexte
   */
  async getTimeSeries(
    section: ReportSection,
    metric: string,
    filter: ReportFilter,
  ): Promise<TimeSeriesData> {
    const { from, to } = this.periodeBounds(filter);
    const granularity  = filter.granularity ?? this.detectGranularity(from, to);

    let points: TimeSeriesPoint[];

    switch (section) {
      case ReportSection.PAIEMENTS:
        points = await this.getPaymentTimeSeries(from, to, granularity, metric, filter);
        break;
      case ReportSection.RETRAITS:
        points = await this.getWithdrawalTimeSeries(from, to, granularity, filter);
        break;
      case ReportSection.LITIGES:
        points = await this.getDisputeTimeSeries(from, to, granularity, filter);
        break;
      case ReportSection.DISTRIBUTIONS:
      case ReportSection.COMMISSIONS:
        points = await this.getDistributionTimeSeries(from, to, granularity, filter);
        break;
      default:
        points = await this.getPaymentTimeSeries(from, to, granularity, 'ca_brut', filter);
    }

    return {
      section,
      metric,
      granularity,
      points,
      total: points.reduce((s, p) => s + p.value, 0),
    };
  }

  /* ==========================================================
   * ANALYSE DE CROISSANCE
   * ========================================================== */

  /**
   * Calcule le taux de croissance du CA brut vs la période équivalente
   * immédiatement précédente.
   *
   * Exemple : filtre du 01-06 au 30-06 → compare avec 01-05 au 31-05
   */
  async computeGrowthAnalysis(filter: ReportFilter): Promise<GrowthAnalysis> {
    const { from, to } = this.periodeBounds(filter);
    const durationMs   = to.getTime() - from.getTime();

    const prevFrom = new Date(from.getTime() - durationMs);
    const prevTo   = new Date(to.getTime()   - durationMs);

    const [currentRaw, previousRaw] = await Promise.all([
      this.sessionRepo
        .createQueryBuilder('ps')
        .select(
          `SUM(CASE WHEN ps.status = 'confirmed' THEN ps.montant ELSE 0 END)`,
          'ca',
        )
        .where('ps.createdAt BETWEEN :from AND :to', { from, to })
        .getRawOne(),
      this.sessionRepo
        .createQueryBuilder('ps')
        .select(
          `SUM(CASE WHEN ps.status = 'confirmed' THEN ps.montant ELSE 0 END)`,
          'ca',
        )
        .where('ps.createdAt BETWEEN :from AND :to', { from: prevFrom, to: prevTo })
        .getRawOne(),
    ]);

    const current  = +currentRaw.ca  || 0;
    const previous = +previousRaw.ca || 0;
    const delta    = current - previous;
    const growthRate = previous > 0
      ? Math.round((delta / previous) * 10000) / 100
      : null;

    return {
      currentPeriod:  { from, to, value: current  },
      previousPeriod: { from: prevFrom, to: prevTo, value: previous },
      growthRate,
      isPositive: delta >= 0,
      delta,
    };
  }

  /* ==========================================================
   * MÉTHODES PRIVÉES — SÉRIES TEMPORELLES
   * ========================================================== */

  private async getPaymentTimeSeries(
    from:        Date,
    to:          Date,
    granularity: TimeGranularity,
    metric:      string,
    filter:      ReportFilter,
  ): Promise<TimeSeriesPoint[]> {
    const trunc = this.dateTrunc(granularity);

    const qb = this.sessionRepo
      .createQueryBuilder('ps')
      .select(`date_trunc('${trunc}', ps."createdAt")`, 'period')
      .addSelect(
        `SUM(CASE WHEN ps.status = 'confirmed' THEN ps.montant ELSE 0 END)`,
        'value',
      )
      .addSelect(
        `COUNT(CASE WHEN ps.status = 'confirmed' THEN 1 END)`,
        'count',
      )
      .where('ps."createdAt" BETWEEN :from AND :to', { from, to })
      .groupBy(`date_trunc('${trunc}', ps."createdAt")`)
      .orderBy('period', 'ASC');

    if (filter.userId) {
      qb.andWhere('ps."clientUserId" = :uid', { uid: filter.userId });
    }

    const rows = await qb.getRawMany();
    return rows.map(r => ({
      date:  new Date(r.period).toISOString(),
      value: +r.value || 0,
      count: +r.count || 0,
      label: this.formatDateLabel(new Date(r.period), granularity),
    }));
  }

  private async getWithdrawalTimeSeries(
    from:        Date,
    to:          Date,
    granularity: TimeGranularity,
    filter:      ReportFilter,
  ): Promise<TimeSeriesPoint[]> {
    const trunc = this.dateTrunc(granularity);

    const qb = this.retraitRepo
      .createQueryBuilder('r')
      .select(`date_trunc('${trunc}', r."requestedAt")`, 'period')
      .addSelect(
        `SUM(CASE WHEN r.status = 'completed' THEN r."montantNet" ELSE 0 END)`,
        'value',
      )
      .addSelect(
        `COUNT(CASE WHEN r.status = 'completed' THEN 1 END)`,
        'count',
      )
      .where('r."requestedAt" BETWEEN :from AND :to', { from, to })
      .groupBy(`date_trunc('${trunc}', r."requestedAt")`)
      .orderBy('period', 'ASC');

    if (filter.userId) {
      qb.andWhere('r."userId" = :uid', { uid: filter.userId });
    }

    const rows = await qb.getRawMany();
    return rows.map(r => ({
      date:  new Date(r.period).toISOString(),
      value: +r.value || 0,
      count: +r.count || 0,
      label: this.formatDateLabel(new Date(r.period), granularity),
    }));
  }

  private async getDisputeTimeSeries(
    from:        Date,
    to:          Date,
    granularity: TimeGranularity,
    filter:      ReportFilter,
  ): Promise<TimeSeriesPoint[]> {
    const trunc = this.dateTrunc(granularity);

    const rows = await this.disputeRepo
      .createQueryBuilder('d')
      .select(`date_trunc('${trunc}', d."openedAt")`, 'period')
      .addSelect('COUNT(*)', 'value')
      .addSelect(
        `SUM(CASE WHEN d."montantConteste" IS NOT NULL THEN d."montantConteste" ELSE 0 END)`,
        'montant',
      )
      .where('d."openedAt" BETWEEN :from AND :to', { from, to })
      .groupBy(`date_trunc('${trunc}', d."openedAt")`)
      .orderBy('period', 'ASC')
      .getRawMany();

    return rows.map(r => ({
      date:  new Date(r.period).toISOString(),
      value: +r.value || 0,
      count: +r.value || 0,
      label: this.formatDateLabel(new Date(r.period), granularity),
    }));
  }

  private async getDistributionTimeSeries(
    from:        Date,
    to:          Date,
    granularity: TimeGranularity,
    filter:      ReportFilter,
  ): Promise<TimeSeriesPoint[]> {
    const trunc = this.dateTrunc(granularity);

    const qb = this.distRepo
      .createQueryBuilder('pd')
      .select(`date_trunc('${trunc}', pd."createdAt")`, 'period')
      .addSelect(
        `SUM(CASE WHEN pd.status = 'released' THEN pd.montant ELSE 0 END)`,
        'value',
      )
      .addSelect('COUNT(*)', 'count')
      .where('pd."createdAt" BETWEEN :from AND :to', { from, to })
      .groupBy(`date_trunc('${trunc}', pd."createdAt")`)
      .orderBy('period', 'ASC');

    if (filter.userId) {
      qb.andWhere('pd."acteurUserId" = :uid', { uid: filter.userId });
    }

    const rows = await qb.getRawMany();
    return rows.map(r => ({
      date:  new Date(r.period).toISOString(),
      value: +r.value || 0,
      count: +r.count || 0,
      label: this.formatDateLabel(new Date(r.period), granularity),
    }));
  }

  /* ==========================================================
   * MÉTHODES PRIVÉES — CALCULS DE CROISSANCE ET VALIDATION
   * ========================================================== */

  private async computeGrowthRate(
    currentCa: number,
    filter:    ReportFilter,
  ): Promise<number | null> {
    const { from, to } = this.periodeBounds(filter);
    const durationMs   = to.getTime() - from.getTime();
    const prevFrom     = new Date(from.getTime() - durationMs);
    const prevTo       = new Date(to.getTime()   - durationMs);

    const raw = await this.sessionRepo
      .createQueryBuilder('ps')
      .select(
        `SUM(CASE WHEN ps.status = 'confirmed' THEN ps.montant ELSE 0 END)`,
        'ca',
      )
      .where('ps.createdAt BETWEEN :from AND :to', { from: prevFrom, to: prevTo })
      .getRawOne();

    const prevCa = +raw.ca || 0;
    if (prevCa === 0) return null;

    return Math.round(((currentCa - prevCa) / prevCa) * 10000) / 100;
  }

  private validateFilter(filter: ReportFilter): void {
    if (!filter.dateFrom || !filter.dateTo) {
      throw new ReportErreur(
        ReportErreurType.INVALID_FILTER,
        'dateFrom et dateTo sont obligatoires',
        { filter },
      );
    }
    if (filter.dateFrom > filter.dateTo) {
      throw new ReportErreur(
        ReportErreurType.INVALID_PERIOD,
        'dateFrom doit être antérieure à dateTo',
        { from: filter.dateFrom, to: filter.dateTo },
      );
    }
  }

  /* ==========================================================
   * HELPERS
   * ========================================================== */

  private periodeBounds(filter: ReportFilter): { from: Date; to: Date } {
    return { from: filter.dateFrom, to: filter.dateTo };
  }

  /**
   * Déduit la granularité optimale selon la durée de la période.
   */
  private detectGranularity(from: Date, to: Date): TimeGranularity {
    const days = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    if (days <= 90)  return 'day';
    if (days <= 365) return 'week';
    return 'month';
  }

  /**
   * Mappe la granularité vers la fonction date_trunc PostgreSQL.
   */
  private dateTrunc(granularity: TimeGranularity): string {
    const map: Record<TimeGranularity, string> = {
      day:   'day',
      week:  'week',
      month: 'month',
    };
    return map[granularity];
  }

  /**
   * Formate une date pour l'affichage dans les graphiques.
   */
  private formatDateLabel(date: Date, granularity: TimeGranularity): string {
    const opts: Intl.DateTimeFormatOptions =
      granularity === 'day'
        ? { day: '2-digit', month: 'short' }
        : granularity === 'week'
        ? { day: '2-digit', month: 'short' }
        : { month: 'long', year: 'numeric' };
    return date.toLocaleDateString('fr-FR', opts);
  }
}
