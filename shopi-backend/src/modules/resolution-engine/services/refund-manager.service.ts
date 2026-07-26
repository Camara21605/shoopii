/* ============================================================
 * FICHIER : src/modules/resolution-engine/services/refund-manager.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Traite le remboursement provider-side pour les litiges
 * en statut REFUND_PENDING.
 *
 * SÉPARATION DES RESPONSABILITÉS
 * ─────────────────────────────────────────────────────────────
 * - EscrowEngine.resoudreLitige() → déjà appelé par DecisionManagerService
 *   → gère les mouvements de wallets (crédit/débit acteurs)
 * - Ce service → appelle uniquement provider.refund() (mobile money)
 *   → met à jour le statut session + dispute
 *
 * PIPELINE
 * ─────────────────────────────────────────────────────────────
 * 1. Charger dispute (REFUND_PENDING requis)
 * 2. Trouver la PaiementSession liée
 * 3. Appeler provider.refund() via PaymentProviderFactory
 * 4. Mettre la session à REFUNDED
 * 5. Mettre le dispute à REFUNDED → CLOSED
 * 6. Émettre événements + audit
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import { Dispute, DisputeStatus } from '../../../database/entities/paiement/dispute.entity';
import {
  PaiementSession,
  PaiementSessionStatus,
} from '../../../database/entities/paiement/paiement-session.entity';
import { DisputeActorRole } from '../../../database/entities/paiement/dispute-history.entity';

import { PaymentProviderFactory } from '../../paiement/providers/payment-provider.factory';

import { ResolutionEventBus } from '../events/resolution-event-bus.service';
import {
  RESOLUTION_EVENTS,
  RefundRequestedEvent,
  RefundCompletedEvent,
  ResolutionClosedEvent,
} from '../events/resolution.events';
import { ResolutionHistoryService } from './resolution-history.service';
import { ResolutionAuditService }   from './resolution-audit.service';
import {
  ResolutionErreur, ResolutionErreurType,
  RemboursementContext, DisputeRemboursementResult,
} from '../types/resolution-engine.types';

@Injectable()
export class RefundManagerService {

  private readonly logger = new Logger(RefundManagerService.name);

  constructor(
    @InjectRepository(Dispute)
    private readonly disputeRepo: Repository<Dispute>,

    @InjectRepository(PaiementSession)
    private readonly sessionRepo: Repository<PaiementSession>,

    private readonly providerFactory: PaymentProviderFactory,
    private readonly eventBus:        ResolutionEventBus,
    private readonly historyService:  ResolutionHistoryService,
    private readonly auditService:    ResolutionAuditService,
  ) {}

  /* ════════════════════════════════════════════════════════
   * TRAITER LE REMBOURSEMENT
   ════════════════════════════════════════════════════════ */

  async traiterRemboursement(ctx: RemboursementContext): Promise<DisputeRemboursementResult> {
    /* ── 1. Charger le dispute ──────────────────────────── */
    const dispute = await this.disputeRepo.findOne({ where: { id: ctx.disputeId } });
    if (!dispute) {
      throw new ResolutionErreur(
        ResolutionErreurType.DISPUTE_INTROUVABLE,
        `Litige introuvable : ${ctx.disputeId}`,
      );
    }

    if (dispute.status !== DisputeStatus.REFUND_PENDING) {
      throw new ResolutionErreur(
        ResolutionErreurType.TRANSITION_INVALIDE,
        `Le remboursement ne peut être traité qu'en statut REFUND_PENDING. Statut : ${dispute.status}`,
      );
    }

    const montantRembourse = dispute.montantRembourse ?? dispute.montantConteste;

    /* ── 2. Émettre la demande de remboursement ─────────── */
    this.eventBus.emit(
      RESOLUTION_EVENTS.REFUND_REQUESTED,
      new RefundRequestedEvent(
        dispute.id, dispute.commandeId,
        ctx.adminUserId, montantRembourse,
      ),
    );

    /* ── 3. Trouver la PaiementSession liée ─────────────── */
    let providerRefundId: string | undefined;
    let session: PaiementSession | null = null;

    if (dispute.sessionId) {
      session = await this.sessionRepo.findOne({ where: { id: dispute.sessionId } });
    } else {
      /* Fallback : chercher la session CONFIRMED pour cette commande */
      session = await this.sessionRepo.findOne({
        where: {
          commandeId: dispute.commandeId,
          status: PaiementSessionStatus.CONFIRMED,
        },
      });
    }

    /* ── 4. Remboursement côté provider ─────────────────── */
    if (session?.providerTransactionId) {
      try {
        const provider = this.providerFactory.resolveByName(session.provider);
        if (provider.refund) {
          const result = await provider.refund(
            session.providerTransactionId,
            montantRembourse,
            `Litige ${dispute.reference} — ${dispute.decision}`,
          );
          providerRefundId = result?.providerRefundId ?? undefined;
          this.logger.log(
            `[Refund] Provider ${session.provider} remboursé — refundId: ${providerRefundId ?? 'N/A'}`,
          );
        }
      } catch (err) {
        /* Non-bloquant : le wallet client a déjà été crédité par EscrowEngine */
        this.logger.error(`[Refund] Provider refund échoué (non bloquant) :`, err);
      }
    } else {
      this.logger.warn(`[Refund] Aucune session de paiement pour commande ${dispute.commandeId}`);
    }

    /* ── 5. Mettre la session à REFUNDED ────────────────── */
    if (session) {
      try {
        await this.sessionRepo.update(session.id, {
          status: PaiementSessionStatus.REFUNDED,
        });
      } catch (err) {
        this.logger.warn(`[Refund] Impossible de mettre la session ${session.id} à REFUNDED :`, err);
      }
    }

    /* ── 6. Dispute : REFUND_PENDING → REFUNDED → CLOSED ── */
    const now = new Date();
    await this.disputeRepo.update(ctx.disputeId, {
      status:   DisputeStatus.REFUNDED,
    });

    /* Fermeture immédiate après confirmation du remboursement */
    await this.disputeRepo.update(ctx.disputeId, {
      status:   DisputeStatus.CLOSED,
      closedAt: now,
    });

    /* ── 7. Événements + audit ───────────────────────────── */
    this.eventBus.emit(
      RESOLUTION_EVENTS.REFUND_COMPLETED,
      new RefundCompletedEvent(
        dispute.id, dispute.commandeId,
        montantRembourse, providerRefundId,
      ),
    );

    this.eventBus.emit(
      RESOLUTION_EVENTS.RESOLUTION_CLOSED,
      new ResolutionClosedEvent(
        dispute.id, dispute.commandeId,
        ctx.adminUserId, dispute.decision,
      ),
    );

    setImmediate(() => {
      this.auditService.logRemboursement(
        dispute.id, dispute.commandeId,
        ctx.adminUserId, montantRembourse, providerRefundId,
      );
      this.historyService.enregistrer({
        disputeId:   dispute.id,
        fromStatus:  DisputeStatus.REFUND_PENDING,
        toStatus:    DisputeStatus.CLOSED,
        actorUserId: ctx.adminUserId,
        actorRole:   DisputeActorRole.ADMIN,
        note:        `Remboursement ${montantRembourse} GNF — ${providerRefundId ?? 'interne'}`,
        metadata:    { montantRembourse, providerRefundId },
      }).catch(() => {});
    });

    this.logger.log(
      `[Refund] ✅ Litige ${dispute.reference} remboursé (${montantRembourse} GNF) et clôturé`,
    );

    return {
      disputeId:        dispute.id,
      montantRembourse,
      providerRefundId,
      finalStatus:      DisputeStatus.CLOSED,
    };
  }
}
