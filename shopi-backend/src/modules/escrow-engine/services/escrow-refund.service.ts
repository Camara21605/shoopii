/* ============================================================
 * FICHIER : src/modules/escrow-engine/services/escrow-refund.service.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Gestion des remboursements du séquestre vers le client.
 *
 * DEUX MODES
 * ------------------------------------------------------------
 * 1. Remboursement TOTAL   — annule toutes les distributions ESCROW
 *                            + crédite le client du montant total
 * 2. Remboursement PARTIEL — crédite le client d'un sous-montant
 *                            (les acteurs gardent le reste)
 *
 * FLUX TOTAL
 * ------------------------------------------------------------
 *   Pour chaque distribution ESCROW :
 *     WalletEngine(ESCROW_CANCEL) → pendingBalance -= montant
 *   Puis :
 *     WalletEngine(REFUND) → client.balance += montantTotal
 *
 * FLUX PARTIEL
 * ------------------------------------------------------------
 *   WalletEngine(REFUND) → client.balance += montantPartiel
 *   (Les distributions restantes restent en ESCROW jusqu'à RELEASED)
 *
 * IDEMPOTENCE
 * ------------------------------------------------------------
 * Clé WalletEngine : "escrow-cancel-<escrowId>-<distId>"
 *                   "escrow-refund-<escrowId>"
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Escrow, EscrowStatus, EscrowTrigger } from '../../../database/entities/paiement/escrow.entity';
import { EscrowHistory } from '../../../database/entities/paiement/escrow-history.entity';
import { PaiementDistribution, DistributionStatus } from '../../../database/entities/paiement/paiement-distribution.entity';
import { Wallet } from '../../../database/entities/wallet.entity';
import { WalletEngine } from '../../wallet-engine/wallet.engine';
import { WalletOperationType, BalanceType } from '../../wallet-engine/types/wallet-engine.types';
import { EscrowValidatorService } from './escrow-validator.service';
import { EscrowEventBus } from '../events/escrow-event-bus.service';
import { ESCROW_EVENTS, EscrowRefundInitiatedEvent, EscrowRefundedEvent } from '../events/escrow.events';
import {
  EscrowRefundContext,
  EscrowRefundResult,
  EscrowErreur,
  EscrowErreurType,
} from '../types/escrow-engine.types';

@Injectable()
export class EscrowRefundService {

  private readonly logger = new Logger(EscrowRefundService.name);

  constructor(
    @InjectRepository(Escrow)
    private readonly escrowRepo: Repository<Escrow>,

    @InjectRepository(EscrowHistory)
    private readonly historyRepo: Repository<EscrowHistory>,

    @InjectRepository(PaiementDistribution)
    private readonly distributionRepo: Repository<PaiementDistribution>,

    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    private readonly walletEngine: WalletEngine,
    private readonly validator: EscrowValidatorService,
    private readonly events: EscrowEventBus,
  ) {}

  /* ==========================================================
   * INITIER LE REMBOURSEMENT (→ REFUND_PENDING)
   * ========================================================== */

  /**
   * Initie un remboursement : passe l'escrow en REFUND_PENDING.
   * Ne modifie pas les wallets — déclenche seulement la transition.
   * Le remboursement effectif se fait via confirmerRemboursement().
   */
  async initierRemboursement(ctx: EscrowRefundContext): Promise<EscrowRefundResult> {
    this.logger.log(`[Refund] Initiation remboursement escrow ${ctx.escrowId} — raison: ${ctx.raison}`);

    const escrow = await this.chargerEscrow(ctx.escrowId);

    this.validator.validerPasDoubleRefund(escrow);
    this.validator.validerTransition(escrow, EscrowStatus.REFUND_PENDING);

    const montantRembourse = ctx.total
      ? escrow.montantTotal
      : (ctx.montantRembourse ?? escrow.montantTotal);

    this.validator.validerMontantRemboursement(ctx, escrow.montantTotal);

    const from = escrow.status;
    escrow.status = EscrowStatus.REFUND_PENDING;
    escrow.lastTrigger = ctx.triggeredBy;
    escrow.refundInitiatedAt = new Date();
    escrow.montantRembourse = montantRembourse;

    await this.escrowRepo.save(escrow);

    await this.historyRepo.save(
      this.historyRepo.create({
        escrowId:          escrow.id,
        commandeId:        escrow.commandeId,
        fromStatus:        from,
        toStatus:          EscrowStatus.REFUND_PENDING,
        triggeredBy:       ctx.triggeredBy,
        triggeredByUserId: ctx.triggeredByUserId ?? null,
        montant:           montantRembourse,
        currency:          escrow.currency,
        note:              ctx.note ?? ctx.raison,
        metadata:          { total: ctx.total, raison: ctx.raison },
      }),
    );

    this.events.emit(
      ESCROW_EVENTS.REFUND_INITIATED,
      new EscrowRefundInitiatedEvent(
        escrow.id, escrow.commandeId, escrow.clientUserId, montantRembourse, ctx.raison,
      ),
    );

    /* Exécuter le remboursement immédiatement */
    return this.executerRemboursement(escrow, ctx, montantRembourse);
  }

  /* ==========================================================
   * EXÉCUTER LE REMBOURSEMENT (→ REFUNDED)
   * ========================================================== */

  private async executerRemboursement(
    escrow: Escrow,
    ctx: EscrowRefundContext,
    montantRembourse: number,
  ): Promise<EscrowRefundResult> {

    /* ── A. Annuler les distributions ESCROW ─────────────── */
    if (ctx.total) {
      const distributions = await this.distributionRepo.find({
        where: {
          commandeId: escrow.commandeId,
          status: DistributionStatus.ESCROW,
        },
      });

      for (const dist of distributions) {
        try {
          await this.walletEngine.executer({
            walletId:         dist.walletId,
            amount:           dist.montant,
            operationType:    WalletOperationType.ESCROW_CANCEL,
            balanceType:      BalanceType.PENDING,
            idempotencyKey:   `escrow-cancel-${escrow.id}-${dist.id}`,
            referenceType:    'escrow',
            referenceId:      escrow.id,
            performedByRole:  'SYSTEM',
            performedByUserId: ctx.triggeredByUserId ?? null,
            description:      `Annulation séquestre commande ${escrow.commandeNumero} — ${dist.acteurType}`,
            metadata:         { distributionId: dist.id, raison: ctx.raison, escrowId: escrow.id },
          });

          dist.status = DistributionStatus.CANCELLED;
          dist.cancelledAt = new Date();
          dist.cancelRaison = ctx.raison;
          dist.actionParUserId = ctx.triggeredByUserId ?? null;
          await this.distributionRepo.save(dist);

        } catch (err) {
          this.logger.error(
            `[Refund] Erreur ESCROW_CANCEL distribution ${dist.id} : ${(err as Error).message}`,
          );
          throw new EscrowErreur(
            EscrowErreurType.WALLET_ENGINE_ERREUR,
            `Échec annulation distribution ${dist.id} : ${(err as Error).message}`,
            { distributionId: dist.id, escrowId: escrow.id },
          );
        }
      }
    }

    /* ── B. Créditer le client en balance disponible ──────── */
    const clientWalletId = await this.resolverWalletClient(escrow);

    let walletTransactionId: string;
    try {
      const result = await this.walletEngine.executer({
        walletId:         clientWalletId,
        amount:           montantRembourse,
        operationType:    WalletOperationType.REFUND,
        balanceType:      BalanceType.BALANCE,
        idempotencyKey:   `escrow-refund-${escrow.id}`,
        referenceType:    'escrow',
        referenceId:      escrow.id,
        performedByRole:  'SYSTEM',
        performedByUserId: ctx.triggeredByUserId ?? null,
        description:      `Remboursement commande ${escrow.commandeNumero} — ${ctx.raison}`,
        metadata:         {
          total:      ctx.total,
          raison:     ctx.raison,
          escrowId:   escrow.id,
          commandeId: escrow.commandeId,
        },
      });
      walletTransactionId = result.transactionId;

    } catch (err) {
      this.logger.error(`[Refund] Erreur REFUND client : ${(err as Error).message}`);
      throw new EscrowErreur(
        EscrowErreurType.WALLET_ENGINE_ERREUR,
        `Échec remboursement client : ${(err as Error).message}`,
        { escrowId: escrow.id, clientWalletId },
      );
    }

    /* ── C. Marquer l'escrow REFUNDED ────────────────────── */
    const from = escrow.status;
    escrow.status = EscrowStatus.REFUNDED;
    escrow.refundedAt = new Date();
    await this.escrowRepo.save(escrow);

    await this.historyRepo.save(
      this.historyRepo.create({
        escrowId:          escrow.id,
        commandeId:        escrow.commandeId,
        fromStatus:        from,
        toStatus:          EscrowStatus.REFUNDED,
        triggeredBy:       ctx.triggeredBy,
        triggeredByUserId: ctx.triggeredByUserId ?? null,
        montant:           montantRembourse,
        currency:          escrow.currency,
        note:              ctx.note ?? `Remboursé : ${ctx.raison}`,
        metadata:          { walletTransactionId, total: ctx.total },
      }),
    );

    this.events.emit(
      ESCROW_EVENTS.REFUNDED,
      new EscrowRefundedEvent(
        escrow.id, escrow.commandeId, escrow.clientUserId, montantRembourse, walletTransactionId,
      ),
    );

    this.logger.log(
      `[Refund] Escrow ${escrow.id} remboursé — ${montantRembourse} ${escrow.currency} → client ${clientWalletId}`,
    );

    return {
      escrowId:              escrow.id,
      commandeId:            escrow.commandeId,
      fromStatus:            from,
      toStatus:              EscrowStatus.REFUNDED,
      timestamp:             new Date(),
      montantRembourse,
      walletTransactionId,
    };
  }

  /* ==========================================================
   * HELPERS PRIVÉS
   * ========================================================== */

  private async chargerEscrow(escrowId: string): Promise<Escrow> {
    const escrow = await this.escrowRepo.findOne({ where: { id: escrowId } });
    if (!escrow) {
      throw new EscrowErreur(
        EscrowErreurType.ESCROW_INTROUVABLE,
        `Escrow introuvable : ${escrowId}`,
        { escrowId },
      );
    }
    return escrow;
  }

  private async resolverWalletClient(escrow: Escrow): Promise<string> {
    /* Snapshot de la création */
    if (escrow.clientWalletId) return escrow.clientWalletId;

    /* Fallback : chercher le wallet du client */
    const wallet = await this.walletRepo.findOne({
      where: { userId: escrow.clientUserId },
    });

    if (!wallet) {
      throw new EscrowErreur(
        EscrowErreurType.WALLET_ENGINE_ERREUR,
        `Wallet client introuvable pour userId ${escrow.clientUserId}`,
        { escrowId: escrow.id, clientUserId: escrow.clientUserId },
      );
    }

    return wallet.id;
  }
}
