/* ============================================================
 * FICHIER : src/modules/settlement-engine/services/settlement-history.service.ts
 *
 * RÔLE    : Lecture de l'historique des retraits et batches.
 *           Toutes les méthodes sont en lecture seule.
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between } from 'typeorm';

import { Retrait, RetraitStatus } from '../../../database/entities/paiement/retrait.entity';
import { SettlementBatch }        from '../../../database/entities/paiement/settlement-batch.entity';

export interface RetraitHistoriqueFilter {
  walletId?: string;
  userId?: string;
  status?: RetraitStatus;
  dateDebut?: Date;
  dateFin?: Date;
  page?: number;
  limite?: number;
}

export interface RetraitPage {
  data: Retrait[];
  total: number;
  page: number;
  limite: number;
  totalPages: number;
}

@Injectable()
export class SettlementHistoryService {

  constructor(
    @InjectRepository(Retrait)
    private readonly retraitRepo: Repository<Retrait>,
    @InjectRepository(SettlementBatch)
    private readonly batchRepo: Repository<SettlementBatch>,
  ) {}

  /** Récupère un retrait par son ID. */
  async getRetrait(retraitId: string): Promise<Retrait | null> {
    return this.retraitRepo.findOne({ where: { id: retraitId } });
  }

  /** Récupère un retrait par sa référence lisible. */
  async getRetraitByReference(reference: string): Promise<Retrait | null> {
    return this.retraitRepo.findOne({ where: { reference } });
  }

  /** Récupère tous les retraits paginés selon les filtres. */
  async getRetraits(filter: RetraitHistoriqueFilter): Promise<RetraitPage> {
    const page  = Math.max(filter.page  ?? 1, 1);
    const limite = Math.min(filter.limite ?? 20, 100);
    const skip  = (page - 1) * limite;

    const where: FindManyOptions<Retrait>['where'] = {};
    if (filter.walletId)  Object.assign(where, { walletId: filter.walletId });
    if (filter.userId)    Object.assign(where, { userId: filter.userId });
    if (filter.status)    Object.assign(where, { status: filter.status });
    if (filter.dateDebut && filter.dateFin) {
      Object.assign(where, { requestedAt: Between(filter.dateDebut, filter.dateFin) });
    }

    const [data, total] = await this.retraitRepo.findAndCount({
      where,
      order: { requestedAt: 'DESC' },
      skip,
      take: limite,
    });

    return { data, total, page, limite, totalPages: Math.ceil(total / limite) };
  }

  /** Récupère les retraits PENDING éligibles pour batch. */
  async getRetraitsPending(methodeFilter?: string[]): Promise<Retrait[]> {
    const qb = this.retraitRepo.createQueryBuilder('r')
      .where('r.status = :status', { status: RetraitStatus.PENDING });

    if (methodeFilter && methodeFilter.length > 0) {
      qb.andWhere('r.methode IN (:...methodes)', { methodes: methodeFilter });
    }

    return qb.orderBy('r.requestedAt', 'ASC').getMany();
  }

  /** Récupère un batch par ID. */
  async getBatch(batchId: string): Promise<SettlementBatch | null> {
    return this.batchRepo.findOne({ where: { id: batchId } });
  }

  /** Récupère les batches récents. */
  async getBatches(limit = 20): Promise<SettlementBatch[]> {
    return this.batchRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
