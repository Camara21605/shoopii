/* ============================================================
 * FICHIER      : src/modules/reporting-engine/services/audit-report.service.ts
 * MODULE       : ReportingEngine
 * ROLE         : Rapports d'audit depuis le journal FinancialAuditLog
 * RESPONSABILITES :
 *   - Interroger FinancialAuditLog pour les rapports de conformité
 *   - Filtrer par type d'événement, sévérité, acteur, commande
 *   - Produire des résumés d'activité suspecte
 *   - Pagination et exports des entrées d'audit
 * DEPENDANCES  :
 *   FinancialAuditLog (repository direct)
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FinancialAuditLog }  from '../../../database/entities/paiement/financial-audit-log.entity';

import {
  AuditReportFilter,
  PaginatedResult,
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
export class AuditReportService {

  constructor(
    @InjectRepository(FinancialAuditLog)
    private readonly auditRepo: Repository<FinancialAuditLog>,
  ) {}

  /* ==========================================================
   * RECHERCHE PAGINÉE
   * ========================================================== */

  /**
   * Retourne les entrées d'audit filtrées et paginées.
   * Toutes les colonnes sensibles (before/after) sont retournées
   * uniquement pour les Super Admin (vérification à faire en amont
   * dans le controller/orchestrateur).
   */
  async findAuditLogs(
    filter: AuditReportFilter,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const take = Math.min(
      filter.limit  ?? DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    );
    const skip = ((filter.page ?? 1) - 1) * take;

    const qb = this.auditRepo
      .createQueryBuilder('al')
      .select([
        'al.id',
        'al.eventType',
        'al.severity',
        'al.actorUserId',
        'al.actorRole',
        'al.commandeId',
        'al.walletId',
        'al.sessionId',
        'al.montant',
        'al.devise',
        'al.entityType',
        'al.entityId',
        'al.ipAddress',
        'al.createdAt',
      ])
      .orderBy('al.createdAt', 'DESC')
      .skip(skip)
      .take(take);

    /* Filtre temporel */
    if (filter.dateFrom) {
      qb.andWhere('al.createdAt >= :from', { from: filter.dateFrom });
    }
    if (filter.dateTo) {
      qb.andWhere('al.createdAt <= :to',   { to: filter.dateTo });
    }

    /* Filtre par type d'événement */
    if (filter.eventTypes?.length) {
      qb.andWhere('al.eventType IN (:...types)', { types: filter.eventTypes });
    }

    /* Filtre par sévérité */
    if (filter.severities?.length) {
      qb.andWhere('al.severity IN (:...sevs)', { sevs: filter.severities });
    }

    /* Filtre par acteur */
    if (filter.actorUserId) {
      qb.andWhere('al.actorUserId = :actor', { actor: filter.actorUserId });
    }

    /* Filtre par commande */
    if (filter.commandeId) {
      qb.andWhere('al.commandeId = :cmd', { cmd: filter.commandeId });
    }

    /* Filtre par wallet */
    if (filter.walletId) {
      qb.andWhere('al.walletId = :wid', { wid: filter.walletId });
    }

    /* Filtre par rôle acteur */
    if (filter.actorRole) {
      qb.andWhere('al.actorRole = :role', { role: filter.actorRole });
    }

    const [entities, total] = await qb.getManyAndCount();

    const items = entities.map(e => ({
      id:          e.id,
      eventType:   e.eventType,
      severity:    e.severity,
      actorUserId: e.actorUserId,
      actorRole:   e.actorRole,
      commandeId:  e.commandeId,
      walletId:    e.walletId,
      sessionId:   e.sessionId,
      montant:     e.montant,
      devise:      e.devise,
      entityType:  e.entityType,
      entityId:    e.entityId,
      ipAddress:   e.ipAddress,
      createdAt:   e.createdAt,
    }));

    return {
      items,
      total,
      page:  filter.page  ?? 1,
      limit: take,
      pages: Math.ceil(total / take),
    };
  }

  /* ==========================================================
   * RÉSUMÉ PAR ACTEUR
   * ========================================================== */

  /**
   * Résumé des événements d'audit regroupés par acteur.
   * Identifie les acteurs les plus actifs ou suspects sur la période.
   * Limité aux CRITICAL et HIGH pour réduire le bruit.
   */
  async getAuditSummaryByActor(
    filter: AuditReportFilter,
  ): Promise<Array<{
    actorUserId: string;
    actorRole:   string;
    nbEvents:    number;
    nbCritical:  number;
    nbHigh:      number;
    dernierEvenement: Date;
  }>> {
    const rows = await this.auditRepo
      .createQueryBuilder('al')
      .select('al.actorUserId',  'actorUserId')
      .addSelect('al.actorRole', 'actorRole')
      .addSelect('COUNT(*)',     'nbEvents')
      .addSelect(
        `COUNT(CASE WHEN al.severity = 'critical' THEN 1 END)`,
        'nbCritical',
      )
      .addSelect(
        `COUNT(CASE WHEN al.severity = 'high' THEN 1 END)`,
        'nbHigh',
      )
      .addSelect('MAX(al.createdAt)', 'dernierEvenement')
      .where('al.severity IN (:...sevs)', { sevs: ['critical', 'high'] })
      .andWhere('al.createdAt BETWEEN :from AND :to', {
        from: filter.dateFrom, to: filter.dateTo,
      })
      .groupBy('al.actorUserId, al.actorRole')
      .orderBy('nbCritical', 'DESC')
      .addOrderBy('nbEvents', 'DESC')
      .limit(50)
      .getRawMany();

    return rows.map(r => ({
      actorUserId:       r.actorUserId,
      actorRole:         r.actorRole,
      nbEvents:          +r.nbEvents   || 0,
      nbCritical:        +r.nbCritical || 0,
      nbHigh:            +r.nbHigh     || 0,
      dernierEvenement:  new Date(r.dernierEvenement),
    }));
  }

  /* ==========================================================
   * EVENTS SUSPECTS (SÉCURITÉ)
   * ========================================================== */

  /**
   * Retourne les événements de sécurité critiques des dernières 24h.
   * Inclut : double paiement bloqué, mismatch de montant, signature webhook invalide,
   * gel de wallet.
   *
   * Utilisé pour les alertes de sécurité dans le dashboard Super Admin.
   */
  async getSecurityEvents(hours = 24): Promise<Array<{
    id:        string;
    eventType: string;
    severity:  string;
    actorUserId: string;
    commandeId: string | null;
    montant:   number | null;
    ipAddress: string | null;
    createdAt: Date;
  }>> {
    const SECURITY_EVENTS = [
      'WEBHOOK_SIGNATURE_INVALID',
      'DOUBLE_PAYMENT_BLOCKED',
      'AMOUNT_MISMATCH_DETECTED',
      'WALLET_FROZEN',
    ];

    const rows = await this.auditRepo
      .createQueryBuilder('al')
      .select([
        'al.id',
        'al.eventType',
        'al.severity',
        'al.actorUserId',
        'al.commandeId',
        'al.montant',
        'al.ipAddress',
        'al.createdAt',
      ])
      .where('al.eventType IN (:...events)', { events: SECURITY_EVENTS })
      .andWhere(`al.createdAt >= NOW() - INTERVAL '${hours} hours'`)
      .orderBy('al.createdAt', 'DESC')
      .limit(100)
      .getMany();

    return rows.map(r => ({
      id:          r.id,
      eventType:   r.eventType,
      severity:    r.severity,
      actorUserId: r.actorUserId ?? '',
      commandeId:  r.commandeId,
      montant:     r.montant,
      ipAddress:   r.ipAddress,
      createdAt:   r.createdAt,
    }));
  }

  /* ==========================================================
   * STATISTIQUES D'AUDIT
   * ========================================================== */

  /**
   * Statistiques globales du journal d'audit sur la période.
   * Répartition par type d'événement et par sévérité.
   */
  async getAuditStats(filter: AuditReportFilter): Promise<{
    total:          number;
    parSeverite:    Record<string, number>;
    parEventType:   Array<{ eventType: string; nb: number }>;
    topIpAddresses: Array<{ ip: string; nb: number }>;
  }> {
    const [
      totalRaw,
      bySeverity,
      byEventType,
      byIp,
    ] = await Promise.all([
      this.auditRepo.manager.query(
        `SELECT COUNT(*) AS nb FROM "financial_audit_logs"
         WHERE "createdAt" BETWEEN $1 AND $2`,
        [filter.dateFrom, filter.dateTo],
      ),
      this.auditRepo.manager.query(
        `SELECT "severity", COUNT(*) AS nb
         FROM "financial_audit_logs"
         WHERE "createdAt" BETWEEN $1 AND $2
         GROUP BY "severity"`,
        [filter.dateFrom, filter.dateTo],
      ),
      this.auditRepo.manager.query(
        `SELECT "eventType", COUNT(*) AS nb
         FROM "financial_audit_logs"
         WHERE "createdAt" BETWEEN $1 AND $2
         GROUP BY "eventType"
         ORDER BY nb DESC
         LIMIT 20`,
        [filter.dateFrom, filter.dateTo],
      ),
      this.auditRepo.manager.query(
        `SELECT "ipAddress" AS ip, COUNT(*) AS nb
         FROM "financial_audit_logs"
         WHERE "createdAt" BETWEEN $1 AND $2
           AND "ipAddress" IS NOT NULL
         GROUP BY "ipAddress"
         ORDER BY nb DESC
         LIMIT 10`,
        [filter.dateFrom, filter.dateTo],
      ),
    ]);

    const parSeverite: Record<string, number> = {};
    for (const row of bySeverity) {
      parSeverite[row.severity] = +row.nb || 0;
    }

    return {
      total:        +totalRaw[0]?.nb || 0,
      parSeverite,
      parEventType: byEventType.map((r: Record<string, unknown>) => ({
        eventType: r.eventType as string,
        nb:        Number(r.nb as string),
      })),
      topIpAddresses: byIp.map((r: Record<string, unknown>) => ({
        ip: r.ip as string,
        nb: Number(r.nb as string),
      })),
    };
  }
}
