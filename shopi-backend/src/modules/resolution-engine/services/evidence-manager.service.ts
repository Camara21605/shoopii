/* ============================================================
 * FICHIER : src/modules/resolution-engine/services/evidence-manager.service.ts
 *
 * RÔLE    : Gestion des pièces justificatives d'un litige.
 *           Soumettre, valider, lister.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import { DisputeEvidence }          from '../../../database/entities/paiement/dispute-evidence.entity';
import { Dispute, DisputeStatus }   from '../../../database/entities/paiement/dispute.entity';
import { PlatformSettings }         from '../../../database/entities/platform-settings.entity';
import { DisputeActorRole }         from '../../../database/entities/paiement/dispute-history.entity';

import { ResolutionEventBus } from '../events/resolution-event-bus.service';
import { RESOLUTION_EVENTS, EvidenceSubmittedEvent, EvidenceValidatedEvent } from '../events/resolution.events';
import { ResolutionHistoryService } from './resolution-history.service';
import {
  ResolutionErreur, ResolutionErreurType,
  EvidenceSubmissionContext, EvidenceValidationContext,
  DisputeEvidenceResult,
  DISPUTE_FINAL_STATES,
} from '../types/resolution-engine.types';

@Injectable()
export class EvidenceManagerService {

  private readonly logger = new Logger(EvidenceManagerService.name);

  constructor(
    @InjectRepository(DisputeEvidence)
    private readonly evidenceRepo: Repository<DisputeEvidence>,

    @InjectRepository(Dispute)
    private readonly disputeRepo: Repository<Dispute>,

    @InjectRepository(PlatformSettings)
    private readonly settingsRepo: Repository<PlatformSettings>,

    private readonly eventBus:       ResolutionEventBus,
    private readonly historyService: ResolutionHistoryService,
  ) {}

  /* ════════════════════════════════════════════════════════
   * SOUMETTRE UNE PREUVE
   ════════════════════════════════════════════════════════ */

  async soumettre(ctx: EvidenceSubmissionContext): Promise<DisputeEvidenceResult> {
    const dispute = await this.disputeRepo.findOne({ where: { id: ctx.disputeId } });
    if (!dispute) {
      throw new ResolutionErreur(
        ResolutionErreurType.DISPUTE_INTROUVABLE,
        `Litige introuvable : ${ctx.disputeId}`,
      );
    }

    if (DISPUTE_FINAL_STATES.has(dispute.status)) {
      throw new ResolutionErreur(
        ResolutionErreurType.ETAT_FINAL_IRREVOCABLE,
        `Impossible de soumettre une preuve sur un litige clôturé`,
      );
    }

    /* Vérifier la limite max de preuves */
    const settings   = await this.settingsRepo.findOne({ where: { id: 1 } });
    const maxEv      = settings?.maxEvidencesPerDispute ?? 10;
    const countExist = await this.evidenceRepo.count({ where: { disputeId: ctx.disputeId } });
    if (countExist >= maxEv) {
      throw new ResolutionErreur(
        ResolutionErreurType.MAX_EVIDENCES_ATTEINT,
        `Limite de ${maxEv} preuves atteinte pour ce litige`,
      );
    }

    /* Créer la preuve */
    const evidence = this.evidenceRepo.create({
      disputeId:        ctx.disputeId,
      uploadedByUserId: ctx.uploadedByUserId,
      submittedBy:      ctx.submittedBy,
      type:             ctx.type,
      url:              ctx.url,
      originalFileName: ctx.originalFileName ?? null,
      fileSizeBytes:    ctx.fileSizeBytes    ?? null,
      description:      ctx.description      ?? null,
      validatedAt:      null,
      validatedByUserId: null,
    });
    const saved = await this.evidenceRepo.save(evidence);

    this.eventBus.emit(
      RESOLUTION_EVENTS.EVIDENCE_SUBMITTED,
      new EvidenceSubmittedEvent(
        ctx.disputeId,
        dispute.commandeId,
        saved.id,
        ctx.uploadedByUserId,
        ctx.type,
      ),
    );

    this.logger.log(`[Evidence] ✅ Preuve soumise — ${saved.id} (${ctx.type}) sur litige ${ctx.disputeId}`);

    return {
      evidenceId: saved.id,
      disputeId:  ctx.disputeId,
      type:       ctx.type,
      url:        ctx.url,
    };
  }

  /* ════════════════════════════════════════════════════════
   * VALIDER UNE PREUVE (admin)
   ════════════════════════════════════════════════════════ */

  async valider(ctx: EvidenceValidationContext): Promise<DisputeEvidence> {
    const evidence = await this.evidenceRepo.findOne({ where: { id: ctx.evidenceId } });
    if (!evidence) {
      throw new ResolutionErreur(
        ResolutionErreurType.EVIDENCE_INTROUVABLE,
        `Preuve introuvable : ${ctx.evidenceId}`,
      );
    }

    if (evidence.validatedAt) {
      return evidence;
    }

    evidence.validatedAt        = new Date();
    evidence.validatedByUserId  = ctx.adminUserId;
    const saved = await this.evidenceRepo.save(evidence);

    const dispute = await this.disputeRepo.findOne({ where: { id: evidence.disputeId } });

    this.eventBus.emit(
      RESOLUTION_EVENTS.EVIDENCE_VALIDATED,
      new EvidenceValidatedEvent(
        evidence.disputeId,
        dispute?.commandeId ?? '',
        evidence.id,
        ctx.adminUserId,
      ),
    );

    setImmediate(() => {
      this.historyService.enregistrer({
        disputeId:   evidence.disputeId,
        fromStatus:  dispute?.status ?? DisputeStatus.OPEN,
        toStatus:    dispute?.status ?? DisputeStatus.OPEN,
        actorUserId: ctx.adminUserId,
        actorRole:   DisputeActorRole.ADMIN,
        note:        `Preuve validée : ${evidence.id}`,
        metadata:    { evidenceId: evidence.id, evidenceType: evidence.type },
      }).catch(() => {});
    });

    return saved;
  }

  /* ════════════════════════════════════════════════════════
   * LISTAGE
   ════════════════════════════════════════════════════════ */

  async listerParDispute(disputeId: string): Promise<DisputeEvidence[]> {
    return this.evidenceRepo.find({
      where: { disputeId },
      order: { createdAt: 'ASC' },
    });
  }
}
