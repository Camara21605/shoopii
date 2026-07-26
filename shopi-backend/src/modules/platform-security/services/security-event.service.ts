/* ============================================================
 * FICHIER      : src/modules/platform-security/services/security-event.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Journal centralisé des événements de sécurité.
 * Persiste chaque événement sensible dans security_event_logs
 * et fournit les méthodes de requête pour les rapports admin.
 *
 * SÉCURITÉ
 * ─────────────────────────────────────────────────────────────
 * - Aucune donnée sensible (password, token) dans `details`
 * - Les erreurs de persistance ne doivent jamais lever d'exception
 *   vers l'appelant (fire-and-forget pour les logs)
 *
 * DÉPENDANCES
 * ─────────────────────────────────────────────────────────────
 *   TypeORM  → Repository<SecurityEventLog>
 *
 * MODULES CONCERNÉS
 * ─────────────────────────────────────────────────────────────
 *   PlatformSecurityModule → provider
 *   AlertManagerService    → appelle log() pour les alertes
 *   AnomalyDetectorService → appelle log() pour les anomalies
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository, LessThan, FindOptionsWhere } from 'typeorm';

import {
  SecurityEventLog,
  SecurityEventType,
  SecuritySeverity,
} from '../../../database/entities/security/security-event-log.entity';

import {
  LogSecurityEventDto,
  SecurityEventFilter,
  SecuritySummary,
} from '../types/security.types';

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class SecurityEventService {

  private readonly logger = new Logger(SecurityEventService.name);

  constructor(
    @InjectRepository(SecurityEventLog)
    private readonly repo: Repository<SecurityEventLog>,
  ) {}

  /* ==========================================================
   * ÉCRITURE
   * ========================================================== */

  /**
   * Persiste un événement de sécurité.
   * Ne lève jamais d'exception — les erreurs de log ne doivent pas
   * interrompre les flux métier.
   */
  async log(dto: LogSecurityEventDto): Promise<SecurityEventLog | null> {
    try {
      const event = this.repo.create({
        eventType:     dto.eventType,
        severity:      dto.severity,
        actorId:       dto.actorId      ?? null,
        actorRole:     dto.actorRole    ?? null,
        ipAddress:     dto.ipAddress    ?? null,
        userAgent:     dto.userAgent    ?? null,
        resource:      dto.resource     ?? null,
        action:        dto.action       ?? null,
        correlationId: dto.correlationId ?? null,
        details:       dto.details      ?? null,
        resolvedAt:    null,
      });
      return await this.repo.save(event);
    } catch (err) {
      this.logger.error(`[SecurityEvent] Impossible de persister l'événement ${dto.eventType}`, err);
      return null;
    }
  }

  /**
   * Raccourci fire-and-forget : ne retourne pas la promesse.
   * Utilisé par les handlers qui ne peuvent pas attendre la persistence.
   */
  logAsync(dto: LogSecurityEventDto): void {
    this.log(dto).catch(err => {
      this.logger.error('[SecurityEvent] logAsync error', err);
    });
  }

  /* ==========================================================
   * LECTURE
   * ========================================================== */

  /**
   * Récupère les événements de sécurité avec filtres optionnels.
   * Triés par date décroissante (les plus récents en premier).
   */
  async getEvents(filter: SecurityEventFilter = {}): Promise<SecurityEventLog[]> {
    const qb = this.repo.createQueryBuilder('e')
      .orderBy('e.createdAt', 'DESC')
      .take(filter.limit ?? 100);

    if (filter.eventType) qb.andWhere('e.eventType = :t', { t: filter.eventType });
    if (filter.severity)  qb.andWhere('e.severity = :s',  { s: filter.severity });
    if (filter.actorId)   qb.andWhere('e.actorId = :a',   { a: filter.actorId });
    if (filter.ipAddress) qb.andWhere('e.ipAddress = :ip', { ip: filter.ipAddress });
    if (filter.from)      qb.andWhere('e.createdAt >= :from', { from: filter.from });
    if (filter.to)        qb.andWhere('e.createdAt <= :to',   { to: filter.to });

    return qb.getMany();
  }

  /**
   * Compte les événements d'un type donné depuis une date.
   * Utilisé par AnomalyDetectorService pour la détection.
   */
  async countByType(type: SecurityEventType, since: Date): Promise<number> {
    return this.repo.count({
      where: {
        eventType: type,
        createdAt: LessThan(since) as any,  // TypeORM: MoreThan pour la date
      },
    });
  }

  /**
   * Compte les événements d'un acteur depuis une date.
   * Utilisé pour la détection de brute force.
   */
  async countByActorSince(actorId: string, type: SecurityEventType, since: Date): Promise<number> {
    return this.repo.count({
      where: {
        actorId,
        eventType: type,
      } as FindOptionsWhere<SecurityEventLog>,
    });
  }

  /**
   * Calcule le résumé de sécurité pour le tableau de bord.
   */
  async getSummary(): Promise<Omit<SecuritySummary, 'activeAlerts' | 'openIncidents'>> {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [last24h, critical, bruteForce, anomalies] = await Promise.all([
      this.repo.count({ where: { createdAt: LessThan(since24h) as any } }),
      this.repo.count({ where: { severity: SecuritySeverity.CRITICAL } }),
      this.repo.count({ where: { eventType: SecurityEventType.BRUTE_FORCE_DETECTED } }),
      this.repo.count({ where: { eventType: SecurityEventType.ANOMALY_DETECTED } }),
    ]);

    return {
      last24hEvents:     last24h,
      criticalEvents:    critical,
      bruteForceBlocks:  bruteForce,
      anomaliesDetected: anomalies,
    };
  }

  /* ==========================================================
   * MAINTENANCE
   * ========================================================== */

  /**
   * Supprime les événements plus anciens que la date fournie.
   * Appelé par le SecurityScheduler selon la politique de rétention.
   * Retourne le nombre d'enregistrements supprimés.
   */
  async purgeOlderThan(date: Date): Promise<number> {
    try {
      const result = await this.repo
        .createQueryBuilder()
        .delete()
        .from(SecurityEventLog)
        .where('createdAt < :date', { date })
        .execute();

      const deleted = result.affected ?? 0;

      if (deleted > 0) {
        this.logger.log(`[SecurityEvent] Purge : ${deleted} événements supprimés (antérieurs au ${date.toISOString()})`);
        /* Auto-log de la purge pour la traçabilité */
        await this.log({
          eventType: SecurityEventType.RETENTION_CLEANUP,
          severity:  SecuritySeverity.INFO,
          action:    'purge',
          details:   { deleted, beforeDate: date.toISOString() },
        });
      }

      return deleted;
    } catch (err) {
      this.logger.error('[SecurityEvent] Erreur lors de la purge', err);
      return 0;
    }
  }

  /**
   * Compte les événements par type — utilisé pour les rapports.
   */
  async countByTypeGrouped(from: Date, to: Date): Promise<Record<string, number>> {
    const rows = await this.repo
      .createQueryBuilder('e')
      .select('e.eventType', 'eventType')
      .addSelect('COUNT(*)', 'count')
      .where('e.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('e.eventType')
      .getRawMany<{ eventType: string; count: string }>();

    return Object.fromEntries(rows.map(r => [r.eventType, Number(r.count)]));
  }

  /**
   * Compte les événements par sévérité — utilisé pour les rapports.
   */
  async countBySeverityGrouped(from: Date, to: Date): Promise<Record<string, number>> {
    const rows = await this.repo
      .createQueryBuilder('e')
      .select('e.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .where('e.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('e.severity')
      .getRawMany<{ severity: string; count: string }>();

    return Object.fromEntries(rows.map(r => [r.severity, Number(r.count)]));
  }

  /**
   * Top IPs par nombre d'événements — détection d'attaques.
   */
  async topIps(from: Date, to: Date, limit = 10): Promise<Array<{ ip: string; count: number }>> {
    const rows = await this.repo
      .createQueryBuilder('e')
      .select('e.ipAddress', 'ip')
      .addSelect('COUNT(*)', 'count')
      .where('e.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere('e.ipAddress IS NOT NULL')
      .groupBy('e.ipAddress')
      .orderBy('count', 'DESC')
      .take(limit)
      .getRawMany<{ ip: string; count: string }>();

    return rows.map(r => ({ ip: r.ip, count: Number(r.count) }));
  }
}
