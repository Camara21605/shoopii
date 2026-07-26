/* ============================================================
 * FICHIER      : src/modules/platform-security/services/incident-manager.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Gestion du cycle de vie complet des incidents opérationnels.
 * Création, investigation, mitigation, résolution et clôture
 * avec timeline complète et traçabilité.
 *
 * MACHINE À ÉTATS
 * ─────────────────────────────────────────────────────────────
 * OPEN → INVESTIGATING → MITIGATED → RESOLVED → CLOSED
 *                                  ↘ POST_MORTEM → CLOSED
 *
 * RÉFÉRENCES
 * ─────────────────────────────────────────────────────────────
 * Format : INC-YYYY-NNNNN (ex: INC-2026-00001)
 * Le compteur est basé sur le nombre d'incidents de l'année courante.
 *
 * RÈGLES MÉTIER
 * ─────────────────────────────────────────────────────────────
 * - Les incidents P1/P2 doivent avoir rootCause + remediation avant CLOSED
 * - La timeline est immuable (append-only)
 *
 * DÉPENDANCES
 * ─────────────────────────────────────────────────────────────
 *   TypeORM → Repository<PlatformIncident>
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';

import {
  PlatformIncident,
  IncidentStatus,
  IncidentSeverity,
  IncidentTimelineEntry,
} from '../../../database/entities/security/platform-incident.entity';

import {
  OpenIncidentDto,
  UpdateIncidentDto,
  IncidentFilter,
} from '../types/security.types';

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class IncidentManagerService {

  private readonly logger = new Logger(IncidentManagerService.name);

  constructor(
    @InjectRepository(PlatformIncident)
    private readonly repo: Repository<PlatformIncident>,
  ) {}

  /* ==========================================================
   * CRÉATION
   * ========================================================== */

  /**
   * Ouvre un nouvel incident.
   * Génère automatiquement la référence lisible.
   */
  async open(dto: OpenIncidentDto): Promise<PlatformIncident> {
    const reference  = await this.generateReference();
    const detectedAt = dto.detectedAt ?? new Date();

    const firstEntry: IncidentTimelineEntry = {
      timestamp: new Date().toISOString(),
      actor:     dto.createdBy ?? 'system',
      message:   `Incident ouvert — ${dto.title}`,
      status:    IncidentStatus.OPEN,
    };

    const incident = this.repo.create({
      reference,
      title:              dto.title,
      description:        dto.description,
      severity:           dto.severity,
      status:             IncidentStatus.OPEN,
      affectedComponents: dto.affectedComponents,
      timeline:           [firstEntry],
      createdBy:          dto.createdBy ?? null,
      detectedAt,
      resolvedAt:         null,
      closedAt:           null,
      rootCause:          null,
      remediation:        null,
    });

    const saved = await this.repo.save(incident);

    this.logger.warn(
      `[IncidentManager] Incident ouvert — ${reference} severity=${dto.severity} ` +
      `components=${dto.affectedComponents.join(', ')}`,
    );

    return saved;
  }

  /* ==========================================================
   * MISE À JOUR
   * ========================================================== */

  /**
   * Met à jour les champs d'un incident existant.
   * Ajoute automatiquement une entrée de timeline si le statut change.
   */
  async update(
    id:     string,
    dto:    UpdateIncidentDto,
    actor?: string,
  ): Promise<PlatformIncident> {
    const incident = await this.findOrFail(id);

    /* Détecte un changement de statut pour la timeline */
    const statusChanged = dto.status && dto.status !== incident.status;

    Object.assign(incident, {
      title:              dto.title              ?? incident.title,
      description:        dto.description        ?? incident.description,
      severity:           dto.severity           ?? incident.severity,
      status:             dto.status             ?? incident.status,
      affectedComponents: dto.affectedComponents ?? incident.affectedComponents,
      rootCause:          dto.rootCause          ?? incident.rootCause,
      remediation:        dto.remediation        ?? incident.remediation,
    });

    if (statusChanged) {
      incident.timeline = [
        ...incident.timeline,
        {
          timestamp: new Date().toISOString(),
          actor:     actor ?? 'system',
          message:   `Statut changé en ${dto.status}`,
          status:    dto.status,
        },
      ];
    }

    return this.repo.save(incident);
  }

  /**
   * Ajoute une entrée dans la timeline sans changer le statut.
   * Utile pour documenter des découvertes en cours d'investigation.
   */
  async addTimeline(
    id:      string,
    message: string,
    actor?:  string,
  ): Promise<void> {
    const incident = await this.findOrFail(id);

    incident.timeline = [
      ...incident.timeline,
      {
        timestamp: new Date().toISOString(),
        actor:     actor ?? 'system',
        message,
      },
    ];

    await this.repo.save(incident);
  }

  /* ==========================================================
   * RÉSOLUTION
   * ========================================================== */

  /**
   * Résout l'incident : cause racine + actions correctives obligatoires.
   * Passe au statut RESOLVED.
   */
  async resolve(
    id:          string,
    rootCause:   string,
    remediation: string,
    resolvedBy:  string,
  ): Promise<PlatformIncident> {
    const incident = await this.findOrFail(id);

    if (incident.status === IncidentStatus.CLOSED) {
      throw new BadRequestException(`L'incident ${incident.reference} est déjà clôturé.`);
    }
    if (incident.status === IncidentStatus.RESOLVED) {
      throw new BadRequestException(`L'incident ${incident.reference} est déjà résolu.`);
    }

    incident.status      = IncidentStatus.RESOLVED;
    incident.resolvedAt  = new Date();
    incident.resolvedBy  = resolvedBy;
    incident.rootCause   = rootCause;
    incident.remediation = remediation;
    incident.timeline    = [
      ...incident.timeline,
      {
        timestamp: new Date().toISOString(),
        actor:     resolvedBy,
        message:   `Incident résolu — Cause : ${rootCause}`,
        status:    IncidentStatus.RESOLVED,
      },
    ];

    this.logger.log(`[IncidentManager] Incident résolu — ${incident.reference} by=${resolvedBy}`);

    return this.repo.save(incident);
  }

  /**
   * Clôture définitivement l'incident.
   * Vérifie que rootCause est documenté pour P1 et P2.
   */
  async close(id: string, actor?: string): Promise<PlatformIncident> {
    const incident = await this.findOrFail(id);

    if (incident.status === IncidentStatus.CLOSED) {
      throw new BadRequestException(`L'incident ${incident.reference} est déjà clôturé.`);
    }

    const requiresPostMortem = [
      IncidentSeverity.P1_CRITICAL,
      IncidentSeverity.P2_HIGH,
    ].includes(incident.severity);

    if (requiresPostMortem && !incident.rootCause) {
      throw new BadRequestException(
        `Les incidents P1/P2 nécessitent un rootCause documenté avant clôture (${incident.reference}).`,
      );
    }

    incident.status    = IncidentStatus.CLOSED;
    incident.closedAt  = new Date();
    incident.timeline  = [
      ...incident.timeline,
      {
        timestamp: new Date().toISOString(),
        actor:     actor ?? 'system',
        message:   'Incident clôturé',
        status:    IncidentStatus.CLOSED,
      },
    ];

    this.logger.log(`[IncidentManager] Incident clôturé — ${incident.reference}`);

    return this.repo.save(incident);
  }

  /* ==========================================================
   * LECTURE
   * ========================================================== */

  /** Récupère les incidents avec filtres optionnels. */
  async list(filter: IncidentFilter = {}): Promise<PlatformIncident[]> {
    const qb = this.repo.createQueryBuilder('i')
      .orderBy('i.detectedAt', 'DESC')
      .take(filter.limit ?? 50);

    if (filter.status)   qb.andWhere('i.status = :s',   { s: filter.status });
    if (filter.severity) qb.andWhere('i.severity = :sv', { sv: filter.severity });
    if (filter.from && filter.to) {
      qb.andWhere('i.detectedAt BETWEEN :from AND :to', {
        from: filter.from, to: filter.to,
      });
    }

    return qb.getMany();
  }

  /** Retourne un incident par ID ou lève NotFoundException. */
  async findOrFail(id: string): Promise<PlatformIncident> {
    const incident = await this.repo.findOne({ where: { id } });
    if (!incident) {
      throw new NotFoundException(`Incident introuvable : ${id}`);
    }
    return incident;
  }

  /** Retourne le nombre d'incidents ouverts. */
  async countOpen(): Promise<number> {
    return this.repo.count({
      where: { status: IncidentStatus.OPEN },
    });
  }

  /** Calcule le temps moyen de résolution (heures) sur la période. */
  async avgResolutionHours(from: Date, to: Date): Promise<number | null> {
    const resolved = await this.repo.find({
      where: {
        status:      IncidentStatus.RESOLVED,
        resolvedAt:  Between(from, to) as any,
      },
    });

    if (resolved.length === 0) return null;

    const totalMs = resolved.reduce((sum, i) => {
      if (!i.resolvedAt) return sum;
      return sum + (i.resolvedAt.getTime() - i.detectedAt.getTime());
    }, 0);

    return Math.round(totalMs / resolved.length / 3_600_000);
  }

  /* ==========================================================
   * UTILITAIRES
   * ========================================================== */

  /**
   * Génère la référence unique INC-YYYY-NNNNN.
   * Basée sur le nombre d'incidents de l'année courante.
   */
  private async generateReference(): Promise<string> {
    const year  = new Date().getFullYear();
    const count = await this.repo.count();
    const seq   = String(count + 1).padStart(5, '0');
    return `INC-${year}-${seq}`;
  }
}
