/* ============================================================
 * FICHIER : src/modules/resolution-engine/services/resolution-history.service.ts
 *
 * RÔLE    : Journal immuable des transitions de statut.
 *           Chaque appel crée une ligne DisputeHistory non modifiable.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import { DisputeHistory, DisputeActorRole } from '../../../database/entities/paiement/dispute-history.entity';
import { DisputeStatus }                    from '../../../database/entities/paiement/dispute.entity';

export interface HistoryEntryCtx {
  disputeId:   string;
  fromStatus:  DisputeStatus | null;
  toStatus:    DisputeStatus;
  actorUserId: string | null;
  actorRole:   DisputeActorRole | null;
  note?:       string | null;
  metadata?:   Record<string, unknown> | null;
}

@Injectable()
export class ResolutionHistoryService {

  private readonly logger = new Logger(ResolutionHistoryService.name);

  constructor(
    @InjectRepository(DisputeHistory)
    private readonly historyRepo: Repository<DisputeHistory>,
  ) {}

  /* Création d'une entrée immuable. Ne lève jamais d'erreur. */
  async enregistrer(ctx: HistoryEntryCtx): Promise<void> {
    try {
      const entry = this.historyRepo.create({
        disputeId:   ctx.disputeId,
        fromStatus:  ctx.fromStatus,
        toStatus:    ctx.toStatus,
        actorUserId: ctx.actorUserId ?? null,
        actorRole:   ctx.actorRole   ?? null,
        note:        ctx.note        ?? null,
        metadata:    ctx.metadata    ?? null,
      });
      await this.historyRepo.save(entry);
    } catch (err) {
      this.logger.error(`[History] Impossible de créer l'entrée :`, err);
    }
  }

  async getHistorique(disputeId: string): Promise<DisputeHistory[]> {
    return this.historyRepo.find({
      where: { disputeId },
      order: { createdAt: 'ASC' },
    });
  }
}
