/* ============================================================
 * FICHIER : src/modules/payment-engine/services/payment-refund.service.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Orchestre les remboursements provider-side.
 *
 * PIPELINE
 * ------------------------------------------------------------
 * 1. Valider que la session est CONFIRMED
 * 2. Appeler provider.refund() pour rembourser côté provider
 * 3. Appeler EscrowEngine.rembourser() pour restituer les fonds
 *    aux acteurs (annuler les escrows) et créditer le client
 * 4. Mettre la session à REFUNDED ou PARTIALLY_REFUNDED
 * 5. Émettre l'événement approprié
 * ============================================================ */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  PaiementSession,
  PaiementSessionStatus,
} from '../../../database/entities/paiement/paiement-session.entity';
import { Escrow } from '../../../database/entities/paiement/escrow.entity';

import { PaymentProviderFactory } from '../../paiement/providers/payment-provider.factory';
import { EscrowEngine }           from '../../escrow-engine/escrow.engine';
import { EscrowTrigger }          from '../../../database/entities/paiement/escrow.entity';

import { PaymentEventBus } from '../events/payment-event-bus.service';
import {
  PAYMENT_EVENTS,
  PaymentRefundInitiatedEvent,
  PaymentRefundedEvent,
  PaymentPartiallyRefundedEvent,
} from '../events/payment.events';
import {
  PaymentErreur,
  PaymentErreurType,
  PaymentRefundContext,
  PaymentRefundResult,
} from '../types/payment-engine.types';

@Injectable()
export class PaymentRefundService {

  private readonly logger = new Logger(PaymentRefundService.name);

  constructor(
    @InjectRepository(PaiementSession)
    private readonly sessionRepo: Repository<PaiementSession>,

    @InjectRepository(Escrow)
    private readonly escrowRepo: Repository<Escrow>,

    private readonly providerFactory: PaymentProviderFactory,
    private readonly escrowEngine:    EscrowEngine,
    private readonly eventBus:        PaymentEventBus,
  ) {}

  /* ════════════════════════════════════════════════════════
   * REMBOURSEMENT PRINCIPAL
   ════════════════════════════════════════════════════════ */

  async rembourser(ctx: PaymentRefundContext): Promise<PaymentRefundResult> {
    /* ── 1. Charger et valider la session ─────────────────── */
    const session = await this.sessionRepo.findOne({ where: { id: ctx.sessionId } });
    if (!session) {
      throw new PaymentErreur(
        PaymentErreurType.SESSION_INTROUVABLE,
        `Session introuvable : ${ctx.sessionId}`,
      );
    }

    if (session.status !== PaiementSessionStatus.CONFIRMED &&
        session.status !== PaiementSessionStatus.DISPUTED &&
        session.status !== PaiementSessionStatus.PARTIALLY_REFUNDED) {
      throw new PaymentErreur(
        PaymentErreurType.REMBOURSEMENT_IMPOSSIBLE,
        `Remboursement impossible depuis le statut "${session.status}"`,
        { sessionId: ctx.sessionId, status: session.status },
      );
    }

    const montantTotal = Number(session.montant);
    const montantARemb = ctx.montant ?? montantTotal;
    const estTotal     = !ctx.montant || Math.abs(ctx.montant - montantTotal) <= 1;

    if (montantARemb <= 0 || montantARemb > montantTotal) {
      throw new PaymentErreur(
        PaymentErreurType.MONTANT_INVALIDE,
        `Montant de remboursement invalide : ${montantARemb} (total session : ${montantTotal})`,
      );
    }

    /* ── 2. Émettre l'événement d'initiation ──────────────── */
    this.eventBus.emit(
      PAYMENT_EVENTS.REFUND_INITIATED,
      new PaymentRefundInitiatedEvent(
        session.id,
        session.commandeId,
        montantARemb,
        !estTotal,
        ctx.adminUserId,
        ctx.raison,
      ),
    );

    /* ── 3. Remboursement côté provider ──────────────────── */
    let providerRefundId: string | undefined;
    try {
      const provider = this.providerFactory.resolveByName(session.provider);
      if (session.providerTransactionId && provider.refund) {
        const refundResult = await provider.refund(
          session.providerTransactionId,
          montantARemb,
          ctx.raison ?? 'Remboursement Shopi',
        );
        providerRefundId = refundResult?.providerRefundId ?? undefined;
        this.logger.log(
          `[Refund] Provider ${session.provider} remboursé — ` +
          `refundId: ${providerRefundId ?? 'N/A'}`,
        );
      }
    } catch (err) {
      this.logger.error(`[Refund] Erreur provider refund:`, err);
    }

    /* ── 4. EscrowEngine — rembourser les acteurs + client ── */
    const escrow = await this.escrowRepo.findOne({
      where: { commandeId: session.commandeId },
    });

    if (escrow) {
      try {
        await this.escrowEngine.rembourser({
          escrowId:          escrow.id,
          triggeredBy:       EscrowTrigger.ADMIN,
          triggeredByUserId: ctx.adminUserId,
          montantRembourse:  estTotal ? undefined : montantARemb,
          total:             estTotal,
          raison:            ctx.raison ?? 'Remboursement initié',
        });
      } catch (err) {
        this.logger.error(`[Refund] EscrowEngine.rembourser() échoué:`, err);
        throw new PaymentErreur(
          PaymentErreurType.ESCROW_ERREUR,
          `Erreur lors du remboursement EscrowEngine : ${(err as Error).message}`,
          { escrowId: escrow?.id },
        );
      }
    } else {
      this.logger.warn(`[Refund] Aucun escrow trouvé pour commande ${session.commandeId}`);
    }

    /* ── 5. Mettre la session à jour ─────────────────────── */
    const newStatus = estTotal
      ? PaiementSessionStatus.REFUNDED
      : PaiementSessionStatus.PARTIALLY_REFUNDED;

    session.status = newStatus;
    await this.sessionRepo.save(session);

    /* ── 6. Événements ───────────────────────────────────── */
    if (estTotal) {
      this.eventBus.emit(
        PAYMENT_EVENTS.REFUNDED,
        new PaymentRefundedEvent(session.id, session.commandeId, montantARemb, providerRefundId),
      );
    } else {
      this.eventBus.emit(
        PAYMENT_EVENTS.PARTIALLY_REFUNDED,
        new PaymentPartiallyRefundedEvent(
          session.id, session.commandeId, montantARemb, montantTotal, providerRefundId,
        ),
      );
    }

    this.logger.log(
      `[Refund] ✅ Session ${session.id} — ${montantARemb} GNF remboursés (${newStatus})`,
    );

    return {
      sessionId:        session.id,
      commandeId:       session.commandeId,
      montantRembourse: montantARemb,
      partiel:          !estTotal,
      providerRefundId,
    };
  }
}
