/* ============================================================
 * FICHIER      : src/modules/reporting-engine/services/report-generator.service.ts
 * MODULE       : ReportingEngine
 * ROLE         : Générateur de rapports financiers structurés
 * RESPONSABILITES :
 *   - Assembler un FinancialReport complet à partir des KPIs + données brutes
 *   - Générer les rapports journaliers, hebdomadaires, mensuels, annuels
 *   - Produire les lignes tabulaires exportables (CSV, Excel)
 *   - Appliquer la pagination sur les jeux de données volumineux
 * DEPENDANCES  :
 *   KpiEngineService, AnalyticsService, StatisticsService
 *   PaiementSession, PaiementDistribution, Retrait, Dispute (repos directs)
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { PaiementSession }      from '../../../database/entities/paiement/paiement-session.entity';
import { PaiementDistribution } from '../../../database/entities/paiement/paiement-distribution.entity';
import { Retrait }              from '../../../database/entities/paiement/retrait.entity';
import { Dispute }              from '../../../database/entities/paiement/dispute.entity';

import { KpiEngineService }   from './kpi-engine.service';
import { AnalyticsService }   from './analytics.service';
import { ReportingCacheService } from './reporting-cache.service';

import {
  ReportFilter,
  ReportPeriod,
  ReportSection,
  FinancialReport,
  ReportRow,
  ReportErreur,
  ReportErreurType,
} from '../types/reporting.types';

/* ============================================================
 * CONSTANTES
 * ============================================================ */

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE     = 200;

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class ReportGeneratorService {

  constructor(
    @InjectRepository(PaiementSession)
    private readonly sessionRepo: Repository<PaiementSession>,

    @InjectRepository(PaiementDistribution)
    private readonly distRepo: Repository<PaiementDistribution>,

    @InjectRepository(Retrait)
    private readonly retraitRepo: Repository<Retrait>,

    @InjectRepository(Dispute)
    private readonly disputeRepo: Repository<Dispute>,

    private readonly kpiEngine: KpiEngineService,
    private readonly analytics: AnalyticsService,
    private readonly cache:     ReportingCacheService,
  ) {}

  /* ==========================================================
   * ENTRY POINT
   * ========================================================== */

  /**
   * Point d'entrée principal pour la génération de rapports.
   * Délègue au générateur approprié selon le type de rapport.
   */
  async generateReport(
    section: ReportSection,
    filter:  ReportFilter,
  ): Promise<FinancialReport> {
    const period = filter.period ?? ReportPeriod.CUSTOM;

    switch (period) {
      case ReportPeriod.DAILY:   return this.generateDailyReport(filter.dateFrom, section, filter);
      case ReportPeriod.WEEKLY:  return this.generateWeeklyReport(filter.dateFrom, section, filter);
      case ReportPeriod.MONTHLY: return this.generateMonthlyReport(
        filter.dateFrom.getFullYear(), filter.dateFrom.getMonth() + 1, section, filter,
      );
      case ReportPeriod.ANNUAL:  return this.generateAnnualReport(
        filter.dateFrom.getFullYear(), section, filter,
      );
      default:                   return this.generateCustomReport(section, filter);
    }
  }

  /* ==========================================================
   * RAPPORTS PAR PÉRIODE STANDARD
   * ========================================================== */

  /**
   * Rapport journalier.
   * Période : minuit → 23:59:59 du jour spécifié.
   */
  async generateDailyReport(
    date:    Date,
    section: ReportSection = ReportSection.OVERVIEW,
    baseFilter?: Partial<ReportFilter>,
  ): Promise<FinancialReport> {
    const dateFrom = startOfDay(date);
    const dateTo   = endOfDay(date);
    return this.generateCustomReport(section, {
      ...baseFilter,
      dateFrom,
      dateTo,
      period: ReportPeriod.DAILY,
    } as ReportFilter);
  }

  /**
   * Rapport hebdomadaire.
   * Période : lundi → dimanche de la semaine contenant `weekStart`.
   */
  async generateWeeklyReport(
    weekStart: Date,
    section:   ReportSection = ReportSection.OVERVIEW,
    baseFilter?: Partial<ReportFilter>,
  ): Promise<FinancialReport> {
    const dateFrom = startOfWeek(weekStart);
    const dateTo   = endOfWeek(weekStart);
    return this.generateCustomReport(section, {
      ...baseFilter,
      dateFrom,
      dateTo,
      period: ReportPeriod.WEEKLY,
      granularity: 'day',
    } as ReportFilter);
  }

  /**
   * Rapport mensuel.
   * Période : 1er du mois → dernier jour du mois.
   */
  async generateMonthlyReport(
    year:    number,
    month:   number,
    section: ReportSection = ReportSection.OVERVIEW,
    baseFilter?: Partial<ReportFilter>,
  ): Promise<FinancialReport> {
    const dateFrom = new Date(year, month - 1, 1, 0, 0, 0);
    const dateTo   = new Date(year, month, 0, 23, 59, 59, 999);
    return this.generateCustomReport(section, {
      ...baseFilter,
      dateFrom,
      dateTo,
      period: ReportPeriod.MONTHLY,
      granularity: 'day',
    } as ReportFilter);
  }

  /**
   * Rapport annuel.
   * Période : 1er janvier → 31 décembre de l'année spécifiée.
   * Granularité : mensuelle (12 points dans la série temporelle).
   */
  async generateAnnualReport(
    year:    number,
    section: ReportSection = ReportSection.OVERVIEW,
    baseFilter?: Partial<ReportFilter>,
  ): Promise<FinancialReport> {
    const dateFrom = new Date(year,  0, 1, 0, 0, 0);
    const dateTo   = new Date(year, 11, 31, 23, 59, 59, 999);
    return this.generateCustomReport(section, {
      ...baseFilter,
      dateFrom,
      dateTo,
      period: ReportPeriod.ANNUAL,
      granularity: 'month',
    } as ReportFilter);
  }

  /* ==========================================================
   * RAPPORT PERSONNALISÉ
   * ========================================================== */

  /**
   * Rapport sur période personnalisée avec filtres multi-critères.
   * C'est le générateur générique appelé par tous les autres.
   *
   * Les lignes tabulaires sont paginées pour supporter les gros volumes.
   * La génération des séries temporelles est optionnelle (includeTimeSeries).
   */
  async generateCustomReport(
    section: ReportSection,
    filter:  ReportFilter,
  ): Promise<FinancialReport> {
    const page     = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, filter.limit ?? DEFAULT_PAGE_SIZE);
    const offset   = (page - 1) * pageSize;

    /* KPIs globaux du rapport */
    const kpis = await this.kpiEngine.computeOverviewKpi(filter);

    /* Lignes tabulaires selon la section */
    const { rows, total } = await this.fetchRows(section, filter, offset, pageSize);

    /* Séries temporelles optionnelles */
    const timeSeries = filter.includeTimeSeries !== false
      ? [await this.kpiEngine.getTimeSeries(section, 'montant', filter)]
      : undefined;

    return {
      id:          uuidv4(),
      type:        filter.period ?? ReportPeriod.CUSTOM,
      section,
      filter:      { ...filter },
      generatedAt: new Date(),
      periode:     { from: filter.dateFrom, to: filter.dateTo },
      kpis,
      timeSeries,
      rows,
      total,
      page,
      pageSize,
    };
  }

  /* ==========================================================
   * MÉTHODES PRIVÉES — LIGNES TABULAIRES
   * ========================================================== */

  /**
   * Dispatche vers le fetcher de lignes selon la section du rapport.
   */
  private async fetchRows(
    section:  ReportSection,
    filter:   ReportFilter,
    offset:   number,
    limit:    number,
  ): Promise<{ rows: ReportRow[]; total: number }> {
    switch (section) {
      case ReportSection.PAIEMENTS:
        return this.fetchPaiementRows(filter, offset, limit);
      case ReportSection.DISTRIBUTIONS:
      case ReportSection.COMMISSIONS:
        return this.fetchDistributionRows(filter, offset, limit);
      case ReportSection.RETRAITS:
        return this.fetchRetraitRows(filter, offset, limit);
      case ReportSection.LITIGES:
        return this.fetchDisputeRows(filter, offset, limit);
      default:
        /* OVERVIEW : retourne les lignes de paiements par défaut */
        return this.fetchPaiementRows(filter, offset, limit);
    }
  }

  /**
   * Lignes de paiements pour le rapport.
   * Chaque ligne correspond à une session de paiement.
   */
  private async fetchPaiementRows(
    filter: ReportFilter,
    skip:   number,
    take:   number,
  ): Promise<{ rows: ReportRow[]; total: number }> {
    const qb = this.sessionRepo
      .createQueryBuilder('ps')
      .select([
        'ps.id              AS "id"',
        'ps.commandeNumero  AS "commande"',
        'ps.montant         AS "montant"',
        'ps.devise          AS "devise"',
        'ps.provider        AS "provider"',
        'ps.methode         AS "methode"',
        'ps.status          AS "statut"',
        'ps.clientUserId    AS "clientId"',
        'ps.createdAt       AS "date"',
        'ps.confirmedAt     AS "confirmeA"',
      ])
      .where('ps.createdAt BETWEEN :from AND :to', {
        from: filter.dateFrom, to: filter.dateTo,
      })
      .orderBy('ps.createdAt', 'DESC')
      .skip(skip)
      .take(take);

    if (filter.userId) qb.andWhere('ps.clientUserId = :uid', { uid: filter.userId });

    const [rawRows, total] = await Promise.all([
      qb.getRawMany(),
      qb.getCount(),
    ]);

    return {
      rows: rawRows.map(r => ({
        id:        r.id,
        commande:  r.commande,
        montant:   +r.montant || 0,
        devise:    r.devise,
        provider:  r.provider,
        methode:   r.methode,
        statut:    r.statut,
        clientId:  r.clientId,
        date:      r.date,
        confirmeA: r.confirmeA,
      })),
      total,
    };
  }

  /**
   * Lignes de distributions pour le rapport.
   * Chaque ligne correspond à une distribution vers un acteur.
   */
  private async fetchDistributionRows(
    filter: ReportFilter,
    skip:   number,
    take:   number,
  ): Promise<{ rows: ReportRow[]; total: number }> {
    const qb = this.distRepo
      .createQueryBuilder('pd')
      .select([
        'pd.id                    AS "id"',
        'pd.commandeNumero        AS "commande"',
        'pd.acteurType            AS "acteurType"',
        'pd.acteurNom             AS "acteurNom"',
        'pd.montant               AS "montant"',
        'pd.commandeMontantTotal  AS "montantCommande"',
        'pd.tauxCommission        AS "taux"',
        'pd.status                AS "statut"',
        'pd.createdAt             AS "date"',
        'pd.releasedAt            AS "libereA"',
      ])
      .where('pd.createdAt BETWEEN :from AND :to', {
        from: filter.dateFrom, to: filter.dateTo,
      })
      .orderBy('pd.createdAt', 'DESC')
      .skip(skip)
      .take(take);

    if (filter.userId)       qb.andWhere('pd.acteurUserId = :uid', { uid: filter.userId });
    if (filter.partenaireId) qb.andWhere('pd.partenaireUserId = :pid', { pid: filter.partenaireId });
    if (filter.adminId)      qb.andWhere('pd.adminUserId = :aid', { aid: filter.adminId });

    const [rawRows, total] = await Promise.all([
      qb.getRawMany(),
      qb.getCount(),
    ]);

    return {
      rows: rawRows.map(r => ({
        id:            r.id,
        commande:      r.commande,
        acteurType:    r.acteurType,
        acteurNom:     r.acteurNom,
        montant:       +r.montant          || 0,
        montantCommande: +r.montantCommande|| 0,
        taux:          r.taux              !== null ? +r.taux : null,
        statut:        r.statut,
        date:          r.date,
        libereA:       r.libereA,
      })),
      total,
    };
  }

  /**
   * Lignes de retraits pour le rapport.
   */
  private async fetchRetraitRows(
    filter: ReportFilter,
    skip:   number,
    take:   number,
  ): Promise<{ rows: ReportRow[]; total: number }> {
    const qb = this.retraitRepo
      .createQueryBuilder('r')
      .select([
        'r.id                 AS "id"',
        'r.reference          AS "reference"',
        'r.userId             AS "userId"',
        'r.montant            AS "montant"',
        'r.frais              AS "frais"',
        'r.montantNet         AS "montantNet"',
        'r.methode            AS "methode"',
        'r.numeroDestinataire AS "destination"',
        'r.status             AS "statut"',
        'r.requestedAt        AS "demandeLe"',
        'r.completedAt        AS "completeLe"',
        'r.attempts           AS "tentatives"',
      ])
      .where('r.requestedAt BETWEEN :from AND :to', {
        from: filter.dateFrom, to: filter.dateTo,
      })
      .orderBy('r.requestedAt', 'DESC')
      .skip(skip)
      .take(take);

    if (filter.userId) qb.andWhere('r.userId = :uid', { uid: filter.userId });

    const [rawRows, total] = await Promise.all([
      qb.getRawMany(),
      qb.getCount(),
    ]);

    return {
      rows: rawRows.map(r => ({
        id:          r.id,
        reference:   r.reference,
        userId:      r.userId,
        montant:     +r.montant    || 0,
        frais:       +r.frais      || 0,
        montantNet:  +r.montantNet || 0,
        methode:     r.methode,
        destination: r.destination,
        statut:      r.statut,
        demandeLe:   r.demandeLe,
        completeLe:  r.completeLe,
        tentatives:  +r.tentatives || 0,
      })),
      total,
    };
  }

  /**
   * Lignes de litiges pour le rapport.
   */
  private async fetchDisputeRows(
    filter: ReportFilter,
    skip:   number,
    take:   number,
  ): Promise<{ rows: ReportRow[]; total: number }> {
    const qb = this.disputeRepo
      .createQueryBuilder('d')
      .select([
        'd.id                 AS "id"',
        'd.reference          AS "reference"',
        'd.commandeNumero     AS "commande"',
        'd.clientUserId       AS "clientId"',
        'd.adminUserId        AS "adminId"',
        'd.motif              AS "motif"',
        'd.montantConteste    AS "montantConteste"',
        'd.montantRembourse   AS "montantRembourse"',
        'd.status             AS "statut"',
        'd.decision           AS "decision"',
        'd.openedAt           AS "ouvertLe"',
        'd.resolvedAt         AS "resoluLe"',
        'd.closedAt           AS "fermerLe"',
      ])
      .where('d.openedAt BETWEEN :from AND :to', {
        from: filter.dateFrom, to: filter.dateTo,
      })
      .orderBy('d.openedAt', 'DESC')
      .skip(skip)
      .take(take);

    if (filter.adminId)     qb.andWhere('d.adminUserId  = :aid', { aid: filter.adminId });
    if (filter.clientUserId)qb.andWhere('d.clientUserId = :cid', { cid: filter.clientUserId });

    const [rawRows, total] = await Promise.all([
      qb.getRawMany(),
      qb.getCount(),
    ]);

    return {
      rows: rawRows.map(r => ({
        id:              r.id,
        reference:       r.reference,
        commande:        r.commande,
        clientId:        r.clientId,
        adminId:         r.adminId,
        motif:           r.motif,
        montantConteste: +r.montantConteste  || 0,
        montantRembourse: r.montantRembourse !== null ? +r.montantRembourse : null,
        statut:          r.statut,
        decision:        r.decision,
        ouvertLe:        r.ouvertLe,
        resoluLe:        r.resoluLe,
        fermerLe:        r.fermerLe,
      })),
      total,
    };
  }
}

/* ============================================================
 * HELPERS DE DATES
 * ============================================================ */

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(date: Date): Date {
  const d   = new Date(date);
  const day = d.getDay(); // 0 = dim, 1 = lun
  const diff = (day === 0) ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return startOfDay(d);
}

function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end   = new Date(start);
  end.setDate(end.getDate() + 6);
  return endOfDay(end);
}
