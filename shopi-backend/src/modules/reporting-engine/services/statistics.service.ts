/* ============================================================
 * FICHIER      : src/modules/reporting-engine/services/statistics.service.ts
 * MODULE       : ReportingEngine
 * ROLE         : Statistiques avancées et agrégations financières
 * RESPONSABILITES :
 *   - Calculs statistiques avancés (percentiles, moyennes, médianes)
 *   - Statistiques détaillées par provider de paiement
 *   - Statistiques par acteur financier (entreprise, livreur, partenaire)
 *   - Comparaisons inter-périodes et benchmarks
 * DEPENDANCES  :
 *   PaiementSession, PaiementDistribution, Retrait, Wallet (repos directs)
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PaiementSession }      from '../../../database/entities/paiement/paiement-session.entity';
import { PaiementDistribution, DistributionActeurType } from '../../../database/entities/paiement/paiement-distribution.entity';
import { Retrait }              from '../../../database/entities/paiement/retrait.entity';
import { Wallet }               from '../../../database/entities/wallet.entity';

/** Voir la même liste dans analytics.service.ts::COMMISSION_ACTEUR_TYPES */
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

import {
  ReportFilter,
  ProviderStats,
  ActeurStats,
} from '../types/reporting.types';

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class StatisticsService {

  constructor(
    @InjectRepository(PaiementSession)
    private readonly sessionRepo: Repository<PaiementSession>,

    @InjectRepository(PaiementDistribution)
    private readonly distRepo: Repository<PaiementDistribution>,

    @InjectRepository(Retrait)
    private readonly retraitRepo: Repository<Retrait>,

    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
  ) {}

  /* ==========================================================
   * PERCENTILES
   * ========================================================== */

  /**
   * Calcule les percentiles P25, P50 (médiane), P75 et P90
   * du montant des paiements confirmés sur la période.
   *
   * Utilise la fonction PostgreSQL PERCENTILE_CONT pour une précision maximale.
   * Permet d'identifier la distribution des paniers (ex: 90% des commandes
   * sont sous X GNF).
   */
  async getPaiementPercentiles(
    filter: ReportFilter,
  ): Promise<{ p25: number; p50: number; p75: number; p90: number }> {
    const raw = await this.sessionRepo.manager.query(
      `SELECT
         PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY "montant") AS p25,
         PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "montant") AS p50,
         PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY "montant") AS p75,
         PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY "montant") AS p90
       FROM "paiement_sessions"
       WHERE "status" = 'confirmed'
         AND "createdAt" BETWEEN $1 AND $2`,
      [filter.dateFrom, filter.dateTo],
    );

    const r = raw[0] ?? {};
    return {
      p25: +r.p25 || 0,
      p50: +r.p50 || 0,
      p75: +r.p75 || 0,
      p90: +r.p90 || 0,
    };
  }

  /**
   * Percentiles des retraits complétés (pour calibrer les limites de retrait).
   */
  async getRetraitPercentiles(
    filter: ReportFilter,
  ): Promise<{ p25: number; p50: number; p75: number; p90: number }> {
    const raw = await this.retraitRepo.manager.query(
      `SELECT
         PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY "montant") AS p25,
         PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "montant") AS p50,
         PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY "montant") AS p75,
         PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY "montant") AS p90
       FROM "retraits"
       WHERE "status" = 'completed'
         AND "requestedAt" BETWEEN $1 AND $2`,
      [filter.dateFrom, filter.dateTo],
    );

    const r = raw[0] ?? {};
    return {
      p25: +r.p25 || 0,
      p50: +r.p50 || 0,
      p75: +r.p75 || 0,
      p90: +r.p90 || 0,
    };
  }

  /* ==========================================================
   * MOYENNES & MÉTRIQUES DÉRIVÉES
   * ========================================================== */

  /**
   * Calcule les moyennes clés sur la période.
   * Utile pour les rapports de synthèse et les benchmarks.
   */
  async computeAverages(filter: ReportFilter): Promise<{
    panierMoyen:          number;
    montantMoyenRetrait:  number;
    delaiMoyenPaiementH:  number;
    nbCommandesParJour:   number;
  }> {
    const durationDays = Math.max(
      1,
      (filter.dateTo.getTime() - filter.dateFrom.getTime()) / (1000 * 60 * 60 * 24),
    );

    const [paiementRaw, retraitRaw] = await Promise.all([
      this.sessionRepo.manager.query(
        `SELECT
           AVG(CASE WHEN "status" = 'confirmed' THEN "montant" END) AS "panierMoyen",
           COUNT(CASE WHEN "status" = 'confirmed' THEN 1 END)       AS "nbConfirmes",
           AVG(EXTRACT(EPOCH FROM ("confirmedAt" - "createdAt")) / 3600) AS "delaiH"
         FROM "paiement_sessions"
         WHERE "createdAt" BETWEEN $1 AND $2
           AND "confirmedAt" IS NOT NULL`,
        [filter.dateFrom, filter.dateTo],
      ),
      this.retraitRepo.manager.query(
        `SELECT AVG("montant") AS "avg"
         FROM "retraits"
         WHERE "status" = 'completed'
           AND "requestedAt" BETWEEN $1 AND $2`,
        [filter.dateFrom, filter.dateTo],
      ),
    ]);

    const p = paiementRaw[0] ?? {};
    const r = retraitRaw[0]  ?? {};

    return {
      panierMoyen:          +p.panierMoyen         || 0,
      montantMoyenRetrait:  +r.avg                 || 0,
      delaiMoyenPaiementH:  Math.round((+p.delaiH || 0) * 10) / 10,
      nbCommandesParJour:   Math.round((+p.nbConfirmes || 0) / durationDays * 10) / 10,
    };
  }

  /* ==========================================================
   * STATISTIQUES PAR ACTEUR
   * ========================================================== */

  /**
   * Statistiques complètes d'un acteur individuel (entreprise, livreur, etc.).
   * Combine distributions, retraits et solde actuel de son wallet.
   */
  async getActeurStats(userId: string, filter: ReportFilter): Promise<ActeurStats> {
    const [distRaw, retraitRaw, walletRaw] = await Promise.all([
      this.distRepo
        .createQueryBuilder('pd')
        .select('pd.acteurNom',  'nom')
        .addSelect('pd.acteurType', 'role')
        .addSelect(
          `SUM(CASE WHEN pd.status = 'released' THEN pd.montant ELSE 0 END)`,
          'montantTotal',
        )
        .addSelect(`COUNT(DISTINCT pd.commandeId)`, 'nbCommandes')
        .where('pd.acteurUserId = :uid', { uid: userId })
        .andWhere('pd.createdAt BETWEEN :from AND :to', {
          from: filter.dateFrom, to: filter.dateTo,
        })
        .groupBy('pd.acteurNom, pd.acteurType')
        .limit(1)
        .getRawMany(),

      this.retraitRepo
        .createQueryBuilder('r')
        .select(`COUNT(CASE WHEN r.status = 'completed' THEN 1 END)`, 'nbRetraits')
        .where('r.userId = :uid', { uid: userId })
        .andWhere('r.requestedAt BETWEEN :from AND :to', {
          from: filter.dateFrom, to: filter.dateTo,
        })
        .getRawOne(),

      this.walletRepo
        .createQueryBuilder('w')
        .select('w.balance', 'balance')
        .where('w.userId = :uid', { uid: userId })
        .getRawOne(),
    ]);

    const dist   = distRaw[0]   ?? {};
    const retrait= retraitRaw   ?? {};
    const wallet = walletRaw    ?? {};
    const montantTotal = +dist.montantTotal || 0;

    return {
      userId,
      nom:             dist.nom            ?? '',
      role:            dist.role           ?? 'inconnu',
      nbCommandes:     +dist.nbCommandes   || 0,
      montantTotal,
      commissions:     COMMISSION_ACTEUR_TYPES.includes(dist.role) ? montantTotal : 0,
      nbRetraits:      +retrait.nbRetraits || 0,
      balanceActuelle: +wallet.balance     || 0,
    };
  }

  /* ==========================================================
   * STATISTIQUES WALLETS
   * ========================================================== */

  /**
   * Identifie les wallets anormaux : soldes négatifs ou très élevés.
   * Utilisé par AlertService pour détecter des anomalies.
   */
  async getWalletAnomalies(): Promise<Array<{
    walletId: string;
    userId:   string;
    balance:  number;
    type:     string;
    issue:    'negative' | 'very_high';
  }>> {
    const rows = await this.walletRepo.manager.query(
      `SELECT id       AS "walletId",
              "userId",
              balance,
              "walletType" AS type,
              CASE WHEN balance < 0           THEN 'negative'
                   WHEN balance > 100000000   THEN 'very_high'
              END AS issue
       FROM "wallets"
       WHERE balance < 0
          OR balance > 100000000
       ORDER BY balance ASC
       LIMIT 50`,
    );

    return rows.map((r: Record<string, unknown>) => ({
      walletId: r.walletId as string,
      userId:   r.userId   as string,
      balance:  Number(r.balance as string),
      type:     r.type     as string,
      issue:    r.issue    as 'negative' | 'very_high',
    }));
  }

  /* ==========================================================
   * TAUX D'ACTIVITÉ
   * ========================================================== */

  /**
   * Statistiques globales d'activité : nombre d'acteurs distincts
   * ayant eu une transaction sur la période.
   */
  async getActivityStats(filter: ReportFilter): Promise<{
    entreprisesActives:    number;
    livreursActifs:        number;
    correspondantsActifs:  number;
    clientsActifs:         number;
  }> {
    const [distStats, clientStats] = await Promise.all([
      this.distRepo.manager.query(
        `SELECT
           COUNT(DISTINCT CASE WHEN "acteurType" = 'entreprise'    THEN "acteurUserId" END) AS "entreprises",
           COUNT(DISTINCT CASE WHEN "acteurType" = 'livreur'        THEN "acteurUserId" END) AS "livreurs",
           COUNT(DISTINCT CASE WHEN "acteurType" = 'correspondant'  THEN "acteurUserId" END) AS "correspondants"
         FROM "paiement_distributions"
         WHERE "createdAt" BETWEEN $1 AND $2`,
        [filter.dateFrom, filter.dateTo],
      ),
      this.sessionRepo.manager.query(
        `SELECT COUNT(DISTINCT "clientUserId") AS "clients"
         FROM "paiement_sessions"
         WHERE "status" = 'confirmed'
           AND "createdAt" BETWEEN $1 AND $2`,
        [filter.dateFrom, filter.dateTo],
      ),
    ]);

    const d = distStats[0]  ?? {};
    const c = clientStats[0]?? {};

    return {
      entreprisesActives:   +d.entreprises   || 0,
      livreursActifs:       +d.livreurs      || 0,
      correspondantsActifs: +d.correspondants|| 0,
      clientsActifs:        +c.clients       || 0,
    };
  }
}
