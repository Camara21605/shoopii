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
 * 2. Remboursement PARTIEL — prélevé sur la part du VENDEUR (entreprise)
 *                            uniquement ; livreur, plateforme et partenaires
 *                            sont payés normalement. Le séquestre reste
 *                            ouvert : le reste est libéré par le flux normal.
 *
 * FLUX TOTAL
 * ------------------------------------------------------------
 *   Pour chaque distribution ESCROW :
 *     WalletEngine(ESCROW_CANCEL) → pendingBalance -= montant
 *   Puis :
 *     WalletEngine(REFUND) → client.balance += montantTotal
 *
 * FLUX PARTIEL (décision produit : prélevé sur le vendeur)
 * ------------------------------------------------------------
 *   WalletEngine(ESCROW_CANCEL) → pendingBalance vendeur -= montantPartiel
 *   WalletEngine(REFUND)        → client.balance      += montantPartiel
 *   Distribution vendeur : montant réduit d'autant (tracé dans l'historique
 *   du séquestre, avant/après). Refusé si le montant dépasse la part du
 *   vendeur → utiliser un remboursement total.
 *
 *   ⚠️ BUG CORRIGÉ — auparavant le client était crédité SANS réduire aucune
 *   part en attente, et le séquestre passait en REFUNDED (état final) :
 *   argent créé (client remboursé + acteurs intégralement dus) et parts des
 *   acteurs bloquées à vie en pendingBalance.
 *
 * IDEMPOTENCE
 * ------------------------------------------------------------
 * Clé WalletEngine : "escrow-cancel-<escrowId>-<distId>"
 *                   "escrow-refund-<escrowId>"
 *                   "escrow-partial-cancel-<escrowId>-<distId>-<déjàRemboursé>"
 *                   "escrow-partial-refund-<escrowId>-<déjàRemboursé>"
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Escrow, EscrowStatus, EscrowTrigger } from '../../../database/entities/paiement/escrow.entity';
import { EscrowHistory } from '../../../database/entities/paiement/escrow-history.entity';
import { PaiementDistribution, DistributionStatus, DistributionActeurType } from '../../../database/entities/paiement/paiement-distribution.entity';
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
    if (!ctx.total) return this.rembourserPartiellement(ctx);

    this.logger.log(`[Refund] Initiation remboursement escrow ${ctx.escrowId} — raison: ${ctx.raison}`);

    const escrow = await this.chargerEscrow(ctx.escrowId);

    this.validator.validerPasDoubleRefund(escrow);
    this.validator.validerTransition(escrow, EscrowStatus.REFUND_PENDING);

    /* Ici toujours un remboursement TOTAL (le partiel est traité par
     * rembourserPartiellement, voir le début de la méthode). */
    const montantRembourse = escrow.montantTotal;

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

    /* ── A. Annuler toutes les distributions ESCROW (remboursement total) ── */
    {
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

  /* ==========================================================
   * REMBOURSEMENT PARTIEL — prélevé sur la part du vendeur
   * ========================================================== */

  async rembourserPartiellement(ctx: EscrowRefundContext): Promise<EscrowRefundResult> {
    const escrow = await this.chargerEscrow(ctx.escrowId);
    this.validator.validerPasDoubleRefund(escrow);
    /* Les parts ne sont en attente (pendingBalance) qu'une fois verrouillées */
    this.validator.validerEtatAttendu(
      escrow, EscrowStatus.LOCKED, EscrowStatus.WAITING_VALIDATION, EscrowStatus.RESOLVED,
    );

    /* Un montant explicite est obligatoire : sans lui, l'ancien code
     * remboursait silencieusement la TOTALITÉ sans rien annuler. */
    const montant = ctx.montantRembourse ?? NaN;
    this.validator.validerMontant(montant, 'Montant remboursé');

    const partsVendeur = (await this.distributionRepo.find({
      where: { commandeId: escrow.commandeId, status: DistributionStatus.ESCROW },
    })).filter(d => d.acteurType === DistributionActeurType.ENTREPRISE);
    const partVendeur = partsVendeur.reduce((s, d) => s + Number(d.montant), 0);

    if (montant > partVendeur) {
      throw new EscrowErreur(
        EscrowErreurType.MONTANT_INSUFFISANT,
        `Remboursement partiel (${montant}) supérieur à la part du vendeur encore en séquestre (${partVendeur}). ` +
        'Utiliser un remboursement total.',
        { escrowId: escrow.id, montant, partVendeur },
      );
    }

    /* Plan de prélèvement calculé AVANT toute écriture */
    const dejaRembourse = Number(escrow.montantRembourse) || 0;
    let reste = montant;
    const prelevements = partsVendeur.map(dist => {
      const prise = Math.min(reste, Number(dist.montant));
      reste -= prise;
      return { dist, prise, avant: Number(dist.montant), apres: Number(dist.montant) - prise };
    }).filter(p => p.prise > 0);

    /* 1. Mouvements wallet (idempotents : une reprise après panne ne rejoue rien) */
    for (const p of prelevements) {
      await this.executerWallet(escrow, {
        walletId:       p.dist.walletId,
        amount:         p.prise,
        operationType:  WalletOperationType.ESCROW_CANCEL,
        balanceType:    BalanceType.PENDING,
        idempotencyKey: `escrow-partial-cancel-${escrow.id}-${p.dist.id}-${dejaRembourse}`,
        description:    `Remboursement partiel commande ${escrow.commandeNumero} — part vendeur`,
        metadata:       { distributionId: p.dist.id, raison: ctx.raison, escrowId: escrow.id },
      }, ctx);
    }
    const clientWalletId = await this.resolverWalletClient(escrow);
    const { transactionId: walletTransactionId } = await this.executerWallet(escrow, {
      walletId:       clientWalletId,
      amount:         montant,
      operationType:  WalletOperationType.REFUND,
      balanceType:    BalanceType.BALANCE,
      idempotencyKey: `escrow-partial-refund-${escrow.id}-${dejaRembourse}`,
      description:    `Remboursement partiel commande ${escrow.commandeNumero} — ${ctx.raison}`,
      metadata:       { total: false, raison: ctx.raison, escrowId: escrow.id, commandeId: escrow.commandeId },
    }, ctx);

    /* 2. Parts du vendeur réduites (le reste sera payé par le flux normal) */
    for (const p of prelevements) {
      p.dist.montant = p.apres;
      if (p.apres === 0) {
        p.dist.status      = DistributionStatus.CANCELLED;
        p.dist.cancelledAt = new Date();
        p.dist.cancelRaison = `Remboursement partiel : ${ctx.raison}`;
      }
      p.dist.actionParUserId = ctx.triggeredByUserId ?? null;
      await this.distributionRepo.save(p.dist);
    }

    /* 3. Séquestre : cumul remboursé, état INCHANGÉ (reste à libérer) */
    escrow.montantRembourse = dejaRembourse + montant;
    escrow.lastTrigger = ctx.triggeredBy;
    await this.escrowRepo.save(escrow);

    await this.historyRepo.save(
      this.historyRepo.create({
        escrowId:          escrow.id,
        commandeId:        escrow.commandeId,
        fromStatus:        escrow.status,
        toStatus:          escrow.status,
        triggeredBy:       ctx.triggeredBy,
        triggeredByUserId: ctx.triggeredByUserId ?? null,
        montant,
        currency:          escrow.currency,
        note:              ctx.note ?? `Remboursement partiel : ${ctx.raison}`,
        metadata:          {
          partiel: true, walletTransactionId,
          prelevements: prelevements.map(p => ({ distributionId: p.dist.id, avant: p.avant, apres: p.apres })),
        },
      }),
    );

    this.events.emit(
      ESCROW_EVENTS.REFUNDED,
      new EscrowRefundedEvent(escrow.id, escrow.commandeId, escrow.clientUserId, montant, walletTransactionId),
    );
    this.logger.log(`[Refund] Remboursement partiel escrow ${escrow.id} — ${montant} ${escrow.currency} prélevés sur le vendeur`);

    return {
      escrowId:            escrow.id,
      commandeId:          escrow.commandeId,
      fromStatus:          escrow.status,
      toStatus:            escrow.status,
      timestamp:           new Date(),
      montantRembourse:    montant,
      walletTransactionId,
    };
  }

  /** Appel WalletEngine avec les champs communs et une erreur métier explicite. */
  private async executerWallet(
    escrow: Escrow,
    op: {
      walletId: string; amount: number; operationType: WalletOperationType; balanceType: BalanceType;
      idempotencyKey: string; description: string; metadata: Record<string, unknown>;
    },
    ctx: EscrowRefundContext,
  ): Promise<{ transactionId: string }> {
    try {
      return await this.walletEngine.executer({
        ...op,
        referenceType:     'escrow',
        referenceId:       escrow.id,
        performedByRole:   'SYSTEM',
        performedByUserId: ctx.triggeredByUserId ?? null,
      });
    } catch (err) {
      this.logger.error(`[Refund] Erreur ${op.operationType} wallet ${op.walletId} : ${(err as Error).message}`);
      throw new EscrowErreur(
        EscrowErreurType.WALLET_ENGINE_ERREUR,
        `Échec ${op.operationType} : ${(err as Error).message}`,
        { escrowId: escrow.id, walletId: op.walletId },
      );
    }
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
