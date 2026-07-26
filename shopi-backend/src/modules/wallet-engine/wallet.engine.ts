/* ============================================================
 * FICHIER : src/modules/wallet-engine/wallet.engine.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Orchestrateur principal du Wallet Engine.
 * Point d'entrée UNIQUE pour tous les mouvements financiers.
 *
 * PIPELINE (pipeline 8 étapes)
 * ------------------------------------------------------------
 * 1. Vérifier idempotence (doublon → rejet immédiat)
 * 2. Acquérir le verrou pessimiste (SELECT FOR UPDATE)
 * 3. Valider les préconditions (statut, solde, limites)
 * 4. Dispatcher vers WalletMovementService (opération métier)
 * 5. Enregistrer l'audit (fire-and-forget)
 * 6. Émettre l'événement (fire-and-forget)
 * 7. Retourner WalletOperationResult
 *
 * DÉLÉGUÉS PUBLICS
 * ------------------------------------------------------------
 * - executer()      — opération standard (9 types)
 * - transferer()    — virement interne entre deux wallets
 * - getEtat()       — snapshot des soldes
 * - getHistorique() — transactions paginées
 *
 * ERREURS
 * ------------------------------------------------------------
 * Toutes les erreurs métier sont WalletErreur.
 * Les erreurs inconnues sont wrappées en WalletErreur(ERREUR_INTERNE).
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WalletTransaction } from '../../database/entities/wallet-transaction.entity';
import { Wallet } from '../../database/entities/wallet.entity';

import {
  WalletOperationContext,
  WalletOperationResult,
  WalletTransferContext,
  WalletTransferResult,
  WalletEtat,
  WalletTransactionFilter,
  WalletTransactionPage,
  WalletErreur,
  WalletErreurType,
  WalletOperationType,
  BalanceType,
} from './types/wallet-engine.types';

import { WalletLockService }      from './services/wallet-lock.service';
import { WalletValidatorService } from './services/wallet-validator.service';
import { WalletMovementService }  from './services/wallet-movement.service';
import { WalletHistoryService }   from './services/wallet-history.service';
import { WalletAuditService }     from './services/wallet-audit.service';
import { WalletEventBus, WALLET_EVENTS } from './events/wallet-event-bus.service';
import {
  WalletOperationSuccessEvent,
  WalletOperationFailedEvent,
  EscrowCreditedEvent,
  EscrowReleasedEvent,
  EscrowCancelledEvent,
  WithdrawalInitiatedEvent,
  WithdrawalConfirmedEvent,
  WithdrawalFailedEvent,
} from './events/wallet.events';

/* ============================================================
 * MAP : opération → méthode WalletMovementService + isDebit
 * ============================================================ */

type MovementMethod = (
  wallet: Wallet,
  ctx: WalletOperationContext,
  qr: import('typeorm').QueryRunner,
) => Promise<WalletOperationResult>;

@Injectable()
export class WalletEngine {

  private readonly logger = new Logger(WalletEngine.name);

  constructor(
    @InjectRepository(WalletTransaction)
    private readonly txRepo: Repository<WalletTransaction>,
    private readonly lockService:      WalletLockService,
    private readonly validatorService: WalletValidatorService,
    private readonly movementService:  WalletMovementService,
    private readonly historyService:   WalletHistoryService,
    private readonly auditService:     WalletAuditService,
    private readonly eventBus:         WalletEventBus,
  ) {}

  /* ==========================================================
   * EXÉCUTER UNE OPÉRATION
   * ========================================================== */

  /**
   * Point d'entrée principal pour toutes les opérations wallet.
   *
   * @throws WalletErreur — erreur métier structurée
   */
  async executer(ctx: WalletOperationContext): Promise<WalletOperationResult> {
    try {
      // 1. IDEMPOTENCE — doublon immédiatement rejeté avant le lock
      if (ctx.idempotencyKey) {
        await this.verifierIdempotence(ctx);
      }

      // 2-4. LOCK + VALIDATION + MOUVEMENT (dans une seule transaction SQL)
      const result = await this.lockService.runWithLockedWallet(
        ctx.walletId,
        async (wallet, qr) => {
          // 3. Validation préconditions
          const isDebit = this.isDebitOperation(ctx.operationType);
          this.validatorService.validerTout(wallet, ctx, isDebit);

          // 4. Dispatcher vers la méthode métier
          const method = this.resolveMethod(ctx.operationType);
          return method.call(this.movementService, wallet, ctx, qr);
        },
      );

      // 5. Audit (fire-and-forget)
      this.auditService.logOperationReussie({
        walletId:       ctx.walletId,
        operationType:  ctx.operationType,
        transactionId:  result.transactionId,
        amount:         ctx.amount,
        balanceBefore:  result.walletApres.balance,  // approximate — ledger has exact
        balanceAfter:   result.walletApres.balance,
        actorUserId:    ctx.performedByUserId ?? null,
        actorRole:      ctx.performedByRole   ?? null,
        ipAddress:      ctx.ipAddress         ?? null,
        referenceType:  ctx.referenceType     ?? null,
        referenceId:    ctx.referenceId       ?? null,
        metadata:       ctx.metadata          ?? null,
      });

      // 6. Événements (fire-and-forget)
      this.emettreEvenementSucces(ctx, result);

      return result;

    } catch (err) {
      // Audit d'échec
      this.auditService.logOperationEchouee({
        walletId:      ctx.walletId,
        operationType: ctx.operationType,
        erreurType:    err instanceof WalletErreur ? err.type : WalletErreurType.ERREUR_INTERNE,
        erreurMessage: err instanceof Error ? err.message : String(err),
        actorUserId:   ctx.performedByUserId ?? null,
        actorRole:     ctx.performedByRole   ?? null,
        ipAddress:     ctx.ipAddress         ?? null,
        metadata:      ctx.metadata          ?? null,
      });

      // Événement d'échec
      this.eventBus.emit(
        WALLET_EVENTS.OPERATION_FAILED,
        new WalletOperationFailedEvent(
          ctx.walletId,
          ctx.operationType,
          err instanceof WalletErreur ? err.type : WalletErreurType.ERREUR_INTERNE,
          err instanceof Error ? err.message : String(err),
          ctx.idempotencyKey ?? null,
          ctx.metadata ?? null,
        ),
      );

      // Wrapper les erreurs inconnues
      if (err instanceof WalletErreur) throw err;
      throw new WalletErreur(
        WalletErreurType.ERREUR_INTERNE,
        `Erreur interne wallet : ${err instanceof Error ? err.message : String(err)}`,
        { walletId: ctx.walletId, operationType: ctx.operationType },
      );
    }
  }

  /* ==========================================================
   * TRANSFERT INTERNE (deux wallets)
   * ========================================================== */

  /**
   * Virement interne entre deux wallets Shopi.
   * Génère deux transactions + deux entrées ledger.
   * Verrou déterministe (ordre UUID) pour éviter les deadlocks.
   */
  async transferer(ctx: WalletTransferContext): Promise<WalletTransferResult> {
    this.validatorService.validerParametresTransfert(ctx);

    return this.lockService.runWithLockedDualWallets(
      ctx.sourceWalletId,
      ctx.targetWalletId,
      async (sourceWallet, targetWallet, qr) => {
        this.validatorService.validerDevise(sourceWallet, targetWallet);
        this.validatorService.validerSolde(sourceWallet, ctx.amount, BalanceType.BALANCE);
        this.validatorService.validerStatutWallet(sourceWallet);
        this.validatorService.validerStatutWallet(targetWallet);

        const outCtx: WalletOperationContext = {
          walletId:        ctx.sourceWalletId,
          amount:          ctx.amount,
          operationType:   WalletOperationType.TRANSFER_OUT,
          balanceType:     BalanceType.BALANCE,
          idempotencyKey:  ctx.idempotencyKey ? `${ctx.idempotencyKey}-out` : null,
          description:     ctx.description ?? 'Transfert sortant',
          note:            ctx.note            ?? null,
          referenceType:   ctx.referenceType   ?? null,
          referenceId:     ctx.referenceId     ?? null,
          performedByUserId: ctx.performedByUserId ?? null,
          performedByRole:   ctx.performedByRole   ?? null,
          ipAddress:       ctx.ipAddress       ?? null,
          metadata:        ctx.metadata        ?? null,
        };

        const inCtx: WalletOperationContext = {
          walletId:        ctx.targetWalletId,
          amount:          ctx.amount,
          operationType:   WalletOperationType.TRANSFER_IN,
          balanceType:     BalanceType.BALANCE,
          idempotencyKey:  ctx.idempotencyKey ? `${ctx.idempotencyKey}-in` : null,
          description:     ctx.description ?? 'Transfert entrant',
          note:            ctx.note            ?? null,
          referenceType:   ctx.referenceType   ?? null,
          referenceId:     ctx.referenceId     ?? null,
          performedByUserId: ctx.performedByUserId ?? null,
          performedByRole:   ctx.performedByRole   ?? null,
          ipAddress:       ctx.ipAddress       ?? null,
          metadata:        ctx.metadata        ?? null,
        };

        const outResult = await this.movementService.debiter(sourceWallet, outCtx, qr);
        const inResult  = await this.movementService.crediter(targetWallet, inCtx, qr);

        return {
          outTransactionId:  outResult.transactionId,
          inTransactionId:   inResult.transactionId,
          outLedgerEntryId:  outResult.ledgerEntryId,
          inLedgerEntryId:   inResult.ledgerEntryId,
          amount:            ctx.amount,
          sourceWalletApres: outResult.walletApres,
          targetWalletApres: inResult.walletApres,
          executedAt:        new Date(),
        };
      },
    );
  }

  /* ==========================================================
   * DÉLÉGUÉS READ-ONLY
   * ========================================================== */

  async getEtat(walletId: string): Promise<WalletEtat> {
    return this.historyService.getEtat(walletId);
  }

  async getHistorique(
    filter: WalletTransactionFilter,
  ): Promise<WalletTransactionPage<WalletTransaction>> {
    return this.historyService.getTransactions(filter);
  }

  /* ==========================================================
   * HELPERS PRIVÉS
   * ========================================================== */

  /**
   * Vérifie qu'aucune transaction avec la même idempotencyKey n'existe.
   */
  private async verifierIdempotence(ctx: WalletOperationContext): Promise<void> {
    const existing = await this.txRepo.findOne({
      where: { idempotencyKey: ctx.idempotencyKey! },
    });

    if (existing) {
      this.auditService.logDoublonIdempotency({
        walletId:       ctx.walletId,
        idempotencyKey: ctx.idempotencyKey!,
        operationType:  ctx.operationType,
        actorUserId:    ctx.performedByUserId ?? null,
        ipAddress:      ctx.ipAddress         ?? null,
      });

      throw new WalletErreur(
        WalletErreurType.DOUBLON_IDEMPOTENCY,
        `Opération déjà traitée. Clé d'idempotence : ${ctx.idempotencyKey}`,
        { idempotencyKey: ctx.idempotencyKey, existingTxId: existing.id },
      );
    }
  }

  /**
   * Détermine si l'opération est un débit (solde source décroît).
   */
  private isDebitOperation(op: WalletOperationType): boolean {
    const debits: WalletOperationType[] = [
      WalletOperationType.WITHDRAWAL_INIT,
      WalletOperationType.BLOCK,
      WalletOperationType.RESERVE,
      WalletOperationType.TRANSFER_OUT,
      WalletOperationType.ESCROW_CREDIT,
    ];
    return debits.includes(op);
  }

  /**
   * Route l'opération vers la méthode WalletMovementService correspondante.
   */
  private resolveMethod(op: WalletOperationType): MovementMethod {
    const map: Partial<Record<WalletOperationType, MovementMethod>> = {
      [WalletOperationType.DEPOSIT]:            this.movementService.crediter.bind(this.movementService),
      [WalletOperationType.COMMISSION]:         this.movementService.crediter.bind(this.movementService),
      [WalletOperationType.REFUND]:             this.movementService.crediter.bind(this.movementService),
      [WalletOperationType.TRANSFER_IN]:        this.movementService.crediter.bind(this.movementService),
      [WalletOperationType.ADJUSTMENT]:         this.movementService.crediter.bind(this.movementService),
      [WalletOperationType.ESCROW_RELEASE]:     this.movementService.crediter.bind(this.movementService),
      [WalletOperationType.ESCROW_CREDIT]:      this.movementService.crediter.bind(this.movementService),
      [WalletOperationType.TRANSFER_OUT]:       this.movementService.debiter.bind(this.movementService),
      [WalletOperationType.WITHDRAWAL_INIT]:    this.movementService.initierRetrait.bind(this.movementService),
      [WalletOperationType.WITHDRAWAL_CONFIRM]: this.movementService.confirmerRetrait.bind(this.movementService),
      [WalletOperationType.WITHDRAWAL_FAIL]:    this.movementService.echouerRetrait.bind(this.movementService),
      [WalletOperationType.BLOCK]:              this.movementService.bloquer.bind(this.movementService),
      [WalletOperationType.UNBLOCK]:            this.movementService.debloquer.bind(this.movementService),
      [WalletOperationType.RESERVE]:            this.movementService.reserver.bind(this.movementService),
      [WalletOperationType.RELEASE]:            this.movementService.liberer.bind(this.movementService),
      [WalletOperationType.ESCROW_CANCEL]:      this.movementService.liberer.bind(this.movementService),
      [WalletOperationType.CORRECTION]:         this.movementService.crediter.bind(this.movementService),
    };

    const method = map[op];
    if (!method) {
      throw new WalletErreur(
        WalletErreurType.OPERATION_NON_AUTORISEE,
        `Type d'opération non pris en charge : ${op}`,
        { operationType: op },
      );
    }
    return method;
  }

  /**
   * Émet l'événement sémantique approprié après une opération réussie.
   */
  private emettreEvenementSucces(
    ctx: WalletOperationContext,
    result: WalletOperationResult,
  ): void {
    try {
      // Événement générique
      this.eventBus.emit(
        WALLET_EVENTS.OPERATION_SUCCESS,
        new WalletOperationSuccessEvent(
          ctx.walletId,
          ctx.operationType,
          result.transactionId,
          result.ledgerEntryId,
          ctx.amount,
          result.balanceType,
          0,
          result.walletApres.balance,
          ctx.idempotencyKey ?? null,
          ctx.referenceType  ?? null,
          ctx.referenceId    ?? null,
          ctx.metadata       ?? null,
        ),
      );

      // Événements sémantiques spécialisés
      const commandeId = ctx.referenceId ?? '';

      switch (ctx.operationType) {
        case WalletOperationType.ESCROW_CREDIT:
          this.eventBus.emit(
            WALLET_EVENTS.ESCROW_CREDITED,
            new EscrowCreditedEvent(ctx.walletId, ctx.amount, commandeId, result.transactionId, ctx.idempotencyKey ?? null, ctx.metadata ?? null),
          );
          break;

        case WalletOperationType.ESCROW_RELEASE:
          this.eventBus.emit(
            WALLET_EVENTS.ESCROW_RELEASED,
            new EscrowReleasedEvent(ctx.walletId, ctx.amount, commandeId, result.transactionId, ctx.idempotencyKey ?? null, ctx.metadata ?? null),
          );
          break;

        case WalletOperationType.ESCROW_CANCEL:
          this.eventBus.emit(
            WALLET_EVENTS.ESCROW_CANCELLED,
            new EscrowCancelledEvent(ctx.walletId, ctx.amount, commandeId, result.transactionId, ctx.idempotencyKey ?? null, ctx.metadata ?? null),
          );
          break;

        case WalletOperationType.WITHDRAWAL_INIT:
          this.eventBus.emit(
            WALLET_EVENTS.WITHDRAWAL_INITIATED,
            new WithdrawalInitiatedEvent(
              ctx.walletId,
              '',
              ctx.amount,
              result.transactionId,
              (ctx.metadata?.['provider'] as string) ?? 'unknown',
              (ctx.metadata?.['method']   as string) ?? 'unknown',
              ctx.idempotencyKey ?? null,
              ctx.metadata ?? null,
            ),
          );
          break;

        case WalletOperationType.WITHDRAWAL_CONFIRM:
          this.eventBus.emit(
            WALLET_EVENTS.WITHDRAWAL_CONFIRMED,
            new WithdrawalConfirmedEvent(
              ctx.walletId,
              '',
              ctx.amount,
              result.transactionId,
              (ctx.metadata?.['providerReference'] as string) ?? '',
              ctx.metadata ?? null,
            ),
          );
          break;

        case WalletOperationType.WITHDRAWAL_FAIL:
          this.eventBus.emit(
            WALLET_EVENTS.WITHDRAWAL_FAILED,
            new WithdrawalFailedEvent(
              ctx.walletId,
              '',
              ctx.amount,
              result.transactionId,
              (ctx.metadata?.['failureReason'] as string) ?? 'unknown',
              ctx.metadata ?? null,
            ),
          );
          break;

        case WalletOperationType.BLOCK:
          this.eventBus.emit(WALLET_EVENTS.WALLET_FROZEN, {
            walletId: ctx.walletId,
            motif:    ctx.note ?? 'non spécifié',
          });
          break;

        case WalletOperationType.UNBLOCK:
          this.eventBus.emit(WALLET_EVENTS.WALLET_UNFROZEN, {
            walletId: ctx.walletId,
          });
          break;
      }
    } catch (err) {
      this.logger.error(`[WalletEngine] Erreur émission événement : ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
