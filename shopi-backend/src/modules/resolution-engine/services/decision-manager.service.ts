/* ============================================================
 * FICHIER : src/modules/resolution-engine/services/decision-manager.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Rend la décision finale sur un litige.
 *
 * PIPELINE
 * ─────────────────────────────────────────────────────────────
 * 1. Charger et valider le dispute (DECISION_PENDING requis)
 * 2. Vérifier l'immuabilité (décision déjà rendue → erreur)
 * 3. Enregistrer la décision sur le Dispute
 * 4. Appeler EscrowEngine.resoudreLitige() pour les mouvements wallet
 * 5. Transition selon décision :
 *    - REMBOURSEMENT_TOTAL / PARTIEL → APPROVED → REFUND_PENDING
 *    - REJET                         → REJECTED → CLOSED
 *    - RE_LIVRAISON / AVOIR_WALLET   → APPROVED → CLOSED
 * 6. Émettre événement + audit
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Dispute, DisputeStatus, DisputeDecision } from '../../../database/entities/paiement/dispute.entity';
import { Escrow }   from '../../../database/entities/paiement/escrow.entity';
import { DisputeActorRole }  from '../../../database/entities/paiement/dispute-history.entity';

import { EscrowEngine }  from '../../escrow-engine/escrow.engine';
import { EscrowTrigger } from '../../../database/entities/paiement/escrow.entity';

import { ResolutionEventBus } from '../events/resolution-event-bus.service';
import {
  RESOLUTION_EVENTS,
  DecisionApprovedEvent,
  DecisionRejectedEvent,
} from '../events/resolution.events';
import { ResolutionHistoryService } from './resolution-history.service';
import { ResolutionAuditService }   from './resolution-audit.service';
import {
  ResolutionErreur, ResolutionErreurType,
  DecisionContext, DisputeDecisionResult,
  DISPUTE_TRANSITIONS,
} from '../types/resolution-engine.types';

@Injectable()
export class DecisionManagerService {

  private readonly logger = new Logger(DecisionManagerService.name);

  /* Décisions qui impliquent un remboursement provider-side */
  private static readonly DECISIONS_AVEC_REMBOURSEMENT = new Set([
    DisputeDecision.REMBOURSEMENT_TOTAL,
    DisputeDecision.REMBOURSEMENT_PARTIEL,
  ]);

  constructor(
    @InjectRepository(Dispute)
    private readonly disputeRepo: Repository<Dispute>,

    @InjectRepository(Escrow)
    private readonly escrowRepo: Repository<Escrow>,

    private readonly escrowEngine:    EscrowEngine,
    private readonly eventBus:        ResolutionEventBus,
    private readonly historyService:  ResolutionHistoryService,
    private readonly auditService:    ResolutionAuditService,
    private readonly dataSource:      DataSource,
  ) {}

  /* ════════════════════════════════════════════════════════
   * RENDRE UNE DÉCISION
   ════════════════════════════════════════════════════════ */

  async rendreDecision(ctx: DecisionContext): Promise<DisputeDecisionResult> {
    /* ── 1. Charger et valider ──────────────────────────── */
    const dispute = await this.disputeRepo.findOne({ where: { id: ctx.disputeId } });
    if (!dispute) {
      throw new ResolutionErreur(
        ResolutionErreurType.DISPUTE_INTROUVABLE,
        `Litige introuvable : ${ctx.disputeId}`,
      );
    }

    if (dispute.status !== DisputeStatus.DECISION_PENDING) {
      throw new ResolutionErreur(
        ResolutionErreurType.TRANSITION_INVALIDE,
        `La décision ne peut être rendue qu'en statut DECISION_PENDING. Statut actuel : ${dispute.status}`,
      );
    }

    /* ── 2. Immuabilité — décision déjà rendue ──────────── */
    if (dispute.decision !== null) {
      throw new ResolutionErreur(
        ResolutionErreurType.DECISION_DEJA_RENDUE,
        `Une décision a déjà été rendue sur ce litige : ${dispute.decision}`,
      );
    }

    /* ── 3. Valider le montant si remboursement partiel ─── */
    if (ctx.decision === DisputeDecision.REMBOURSEMENT_PARTIEL) {
      if (!ctx.montantRembourse || ctx.montantRembourse <= 0) {
        throw new ResolutionErreur(
          ResolutionErreurType.MONTANT_INVALIDE,
          'Un montant de remboursement > 0 est requis pour REMBOURSEMENT_PARTIEL',
        );
      }
      if (ctx.montantRembourse > dispute.montantConteste) {
        throw new ResolutionErreur(
          ResolutionErreurType.MONTANT_INVALIDE,
          `Le montant remboursé (${ctx.montantRembourse}) dépasse le montant contesté (${dispute.montantConteste})`,
        );
      }
    }

    const montantRembourse = ctx.decision === DisputeDecision.REMBOURSEMENT_TOTAL
      ? dispute.montantConteste
      : (ctx.montantRembourse ?? null);

    /* ── 4. Déterminer la transition cible ──────────────── */
    const needsRefund = DecisionManagerService.DECISIONS_AVEC_REMBOURSEMENT.has(ctx.decision);
    const targetStatus = ctx.decision === DisputeDecision.REJET
      ? DisputeStatus.REJECTED
      : needsRefund
        ? DisputeStatus.APPROVED          // REFUND_PENDING viendra après
        : DisputeStatus.APPROVED;         // RE_LIVRAISON / AVOIR_WALLET → APPROVED → CLOSED

    /* ── 5. Enregistrer la décision en transaction ──────── */
    await this.dataSource.transaction(async (manager) => {
      await manager.update(Dispute, ctx.disputeId, {
        decision:         ctx.decision,
        decisionMotif:    ctx.decisionMotif,
        montantRembourse: montantRembourse ?? undefined,
        status:           targetStatus,
        resolvedAt:       new Date(),
      });
    });

    dispute.decision         = ctx.decision;
    dispute.decisionMotif    = ctx.decisionMotif;
    dispute.montantRembourse = montantRembourse;
    dispute.status           = targetStatus;

    /* ── 6. EscrowEngine.resoudreLitige() ───────────────── */
    const escrow = await this.escrowRepo.findOne({ where: { commandeId: dispute.commandeId } });
    if (escrow) {
      try {
        /* Mapper DisputeDecision → EscrowResolveContext.decision */
        const escrowDecision = ctx.decision === DisputeDecision.AVOIR_WALLET
          ? 'REJET'   // wallets libérés, AVOIR géré séparément
          : ctx.decision.toUpperCase() as 'REMBOURSEMENT_TOTAL' | 'REMBOURSEMENT_PARTIEL' | 'REJET' | 'RE_LIVRAISON';

        await this.escrowEngine.resoudreLitige({
          escrowId:         escrow.id,
          disputeId:        dispute.id,
          decision:         escrowDecision,
          montantRembourse: montantRembourse ?? undefined,
          adminUserId:      ctx.adminUserId,
          note:             ctx.decisionMotif,
        });

        this.logger.log(`[Decision] EscrowEngine.resoudreLitige() OK — ${dispute.reference}`);
      } catch (err) {
        this.logger.error(`[Decision] EscrowEngine.resoudreLitige() échoué :`, err);
        throw new ResolutionErreur(
          ResolutionErreurType.ESCROW_ERREUR,
          `EscrowEngine.resoudreLitige() échoué : ${(err as Error).message}`,
          { escrowId: escrow.id, disputeId: dispute.id },
        );
      }
    } else {
      this.logger.warn(`[Decision] Aucun escrow pour commande ${dispute.commandeId}`);
    }

    /* ── 7. Transition vers REFUND_PENDING ou CLOSED ────── */
    let newStatus = targetStatus;
    if (needsRefund) {
      dispute.status = DisputeStatus.REFUND_PENDING;
      await this.disputeRepo.update(ctx.disputeId, { status: DisputeStatus.REFUND_PENDING });
      newStatus = DisputeStatus.REFUND_PENDING;
    } else if (!needsRefund && ctx.decision !== DisputeDecision.REJET) {
      /* RE_LIVRAISON / AVOIR_WALLET → clore directement */
      dispute.status  = DisputeStatus.CLOSED;
      dispute.closedAt = new Date();
      await this.disputeRepo.update(ctx.disputeId, {
        status:   DisputeStatus.CLOSED,
        closedAt: dispute.closedAt,
      });
      newStatus = DisputeStatus.CLOSED;
    } else if (ctx.decision === DisputeDecision.REJET) {
      dispute.status  = DisputeStatus.CLOSED;
      dispute.closedAt = new Date();
      await this.disputeRepo.update(ctx.disputeId, {
        status:   DisputeStatus.CLOSED,
        closedAt: dispute.closedAt,
      });
      newStatus = DisputeStatus.CLOSED;
    }

    /* ── 8. Événements + audit ───────────────────────────── */
    if (ctx.decision === DisputeDecision.REJET) {
      this.eventBus.emit(
        RESOLUTION_EVENTS.DECISION_REJECTED,
        new DecisionRejectedEvent(
          dispute.id, dispute.commandeId,
          ctx.adminUserId, ctx.decisionMotif,
          dispute.clientUserId,
        ),
      );
    } else {
      this.eventBus.emit(
        RESOLUTION_EVENTS.DECISION_APPROVED,
        new DecisionApprovedEvent(
          dispute.id, dispute.commandeId,
          ctx.adminUserId, ctx.decision,
          montantRembourse,
          dispute.clientUserId,
        ),
      );
    }

    setImmediate(() => {
      this.auditService.logDecision(
        dispute.id, dispute.commandeId,
        ctx.adminUserId, ctx.decision, montantRembourse,
      );
      this.historyService.enregistrer({
        disputeId:   dispute.id,
        fromStatus:  DisputeStatus.DECISION_PENDING,
        toStatus:    newStatus,
        actorUserId: ctx.adminUserId,
        actorRole:   DisputeActorRole.ADMIN,
        note:        `Décision : ${ctx.decision} — ${ctx.decisionMotif}`,
        metadata:    { decision: ctx.decision, montantRembourse },
      }).catch(() => {});
    });

    this.logger.log(
      `[Decision] ✅ Décision ${ctx.decision} rendue sur ${dispute.reference} → ${newStatus}`,
    );

    return {
      disputeId:        dispute.id,
      decision:         ctx.decision,
      montantRembourse: montantRembourse,
      newStatus,
    };
  }
}
