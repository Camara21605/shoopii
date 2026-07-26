/* ============================================================
 * FICHIER : src/modules/escrow-engine/services/escrow-history.service.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Service de lecture uniquement.
 * Fournit l'historique, les filtres et les stats des séquestres.
 * NE modifie AUCUN enregistrement.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';

import { Escrow, EscrowStatus } from '../../../database/entities/paiement/escrow.entity';
import { EscrowHistory } from '../../../database/entities/paiement/escrow-history.entity';
import { EscrowFilter, EscrowPage, EscrowErreur, EscrowErreurType } from '../types/escrow-engine.types';

@Injectable()
export class EscrowHistoryService {

  private readonly logger = new Logger(EscrowHistoryService.name);

  constructor(
    @InjectRepository(Escrow)
    private readonly escrowRepo: Repository<Escrow>,

    @InjectRepository(EscrowHistory)
    private readonly historyRepo: Repository<EscrowHistory>,
  ) {}

  /* ==========================================================
   * LECTURE ESCROW
   * ========================================================== */

  async getById(escrowId: string): Promise<Escrow> {
    const escrow = await this.escrowRepo.findOne({ where: { id: escrowId } });
    if (!escrow) {
      throw new EscrowErreur(EscrowErreurType.ESCROW_INTROUVABLE, `Escrow introuvable : ${escrowId}`, { escrowId });
    }
    return escrow;
  }

  async getByCommandeId(commandeId: string): Promise<Escrow | null> {
    return this.escrowRepo.findOne({ where: { commandeId } });
  }

  async getBySessionId(sessionId: string): Promise<Escrow | null> {
    return this.escrowRepo.findOne({ where: { sessionId } });
  }

  /* ==========================================================
   * LISTE FILTRÉE + PAGINATION
   * ========================================================== */

  async lister(filter: EscrowFilter): Promise<EscrowPage<Escrow>> {
    const page  = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20));
    const skip  = (page - 1) * limit;

    const where: FindManyOptions<Escrow>['where'] = {};
    if (filter.commandeId)   (where as any).commandeId   = filter.commandeId;
    if (filter.clientUserId) (where as any).clientUserId = filter.clientUserId;
    if (filter.status)       (where as any).status       = filter.status;
    if (filter.dateDebut && filter.dateFin) {
      (where as any).createdAt = Between(filter.dateDebut, filter.dateFin);
    } else if (filter.dateDebut) {
      (where as any).createdAt = MoreThanOrEqual(filter.dateDebut);
    } else if (filter.dateFin) {
      (where as any).createdAt = LessThanOrEqual(filter.dateFin);
    }

    const [data, total] = await this.escrowRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  /* ==========================================================
   * HISTORIQUE DES TRANSITIONS
   * ========================================================== */

  async getHistorique(escrowId: string): Promise<EscrowHistory[]> {
    return this.historyRepo.find({
      where: { escrowId },
      order: { createdAt: 'ASC' },
    });
  }

  /* ==========================================================
   * ESCROWS EN ATTENTE D'AUTO-RELEASE (pour scheduler)
   * ========================================================== */

  async getEscrowsAutoReleaseExpires(): Promise<Escrow[]> {
    return this.escrowRepo
      .createQueryBuilder('e')
      .where('e.status = :status', { status: EscrowStatus.WAITING_VALIDATION })
      .andWhere('e.autoReleaseAt IS NOT NULL')
      .andWhere('e.autoReleaseAt <= :now', { now: new Date() })
      .getMany();
  }

  /* ==========================================================
   * STATISTIQUES
   * ========================================================== */

  async getStats(dateDebut: Date, dateFin: Date): Promise<{
    totalEscrows: number;
    totalReleased: number;
    totalRefunded: number;
    totalFailed: number;
    montantTotal: number;
    montantDistribue: number;
    montantRembourse: number;
  }> {
    const result = await this.escrowRepo
      .createQueryBuilder('e')
      .select([
        'COUNT(*)                           AS "totalEscrows"',
        'SUM(CASE WHEN e.status = :released THEN 1 ELSE 0 END) AS "totalReleased"',
        'SUM(CASE WHEN e.status = :refunded THEN 1 ELSE 0 END) AS "totalRefunded"',
        'SUM(CASE WHEN e.status = :failed   THEN 1 ELSE 0 END) AS "totalFailed"',
        'SUM(e.montantTotal)                AS "montantTotal"',
        'SUM(e.montantDistribue)            AS "montantDistribue"',
        'SUM(e.montantRembourse)            AS "montantRembourse"',
      ])
      .where('e.createdAt BETWEEN :dateDebut AND :dateFin', { dateDebut, dateFin })
      .setParameters({
        released: EscrowStatus.RELEASED,
        refunded: EscrowStatus.REFUNDED,
        failed:   EscrowStatus.FAILED,
      })
      .getRawOne();

    return {
      totalEscrows:     parseInt(result.totalEscrows ?? '0', 10),
      totalReleased:    parseInt(result.totalReleased ?? '0', 10),
      totalRefunded:    parseInt(result.totalRefunded ?? '0', 10),
      totalFailed:      parseInt(result.totalFailed ?? '0', 10),
      montantTotal:     parseFloat(result.montantTotal ?? '0'),
      montantDistribue: parseFloat(result.montantDistribue ?? '0'),
      montantRembourse: parseFloat(result.montantRembourse ?? '0'),
    };
  }
}
