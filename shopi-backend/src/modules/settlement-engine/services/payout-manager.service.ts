/* ============================================================
 * FICHIER : src/modules/settlement-engine/services/payout-manager.service.ts
 *
 * RÔLE    : Orchestre l'exécution des payouts vers les providers.
 *
 * FLUX PAR TENTATIVE (idempotent via clé -aN) :
 *   1. Marquer PROCESSING (protection double-exécution)
 *   2. RESERVE  (balance → reservedBalance) via WalletEngine
 *   3. WITHDRAWAL_INIT (reservedBalance → withdrawingBalance)
 *   4. Appel provider.initierPaiement()
 *   5a. Succès → WITHDRAWAL_CONFIRM + COMPLETED
 *   5b. Échec  → WITHDRAWAL_FAIL (withdrawingBalance → balance) + FAILED
 *
 * SÉCURITÉ :
 *   - Idempotence : clé = "settlement-{op}-{retraitId}-a{attempt}"
 *   - Verrou pessimiste : WalletEngine.executer() acquiert le lock
 *   - Replay : WalletEngine rejette DOUBLON_IDEMPOTENCY si même clé
 *   - Limite de tentatives : maxWithdrawalAttempts dans PlatformSettings
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Retrait, RetraitStatus } from '../../../database/entities/paiement/retrait.entity';
import { SettlementBatch, SettlementBatchStatus } from '../../../database/entities/paiement/settlement-batch.entity';
import { PlatformSettings } from '../../../database/entities/platform-settings.entity';
import { WalletEngine }     from '../../wallet-engine/wallet.engine';
import {
  WalletOperationType,
  BalanceType,
} from '../../wallet-engine/types/wallet-engine.types';

import { PayoutProviderFactory } from '../providers/payout-provider.factory';
import { SettlementAuditService } from './settlement-audit.service';
import { SettlementEventBus }     from '../events/settlement-event-bus.service';
import {
  SETTLEMENT_EVENTS,
  PayoutStartedEvent,
  PayoutSucceededEvent,
  PayoutFailedEvent,
  SettlementCompletedEvent,
} from '../events/settlement.events';
import {
  ExecutePayoutContext,
  PayoutContext,
  PayoutExecutionResult,
  SettlementErreur,
  SettlementErreurType,
  SettlementBatchContext,
} from '../types/settlement-engine.types';
import { BatchRetraitReport } from '../types/settlement-engine.types';

@Injectable()
export class PayoutManagerService {

  private readonly logger = new Logger(PayoutManagerService.name);

  constructor(
    @InjectRepository(Retrait)
    private readonly retraitRepo: Repository<Retrait>,
    @InjectRepository(SettlementBatch)
    private readonly batchRepo: Repository<SettlementBatch>,
    @InjectRepository(PlatformSettings)
    private readonly settingsRepo: Repository<PlatformSettings>,
    private readonly walletEngine:   WalletEngine,
    private readonly providerFactory: PayoutProviderFactory,
    private readonly auditService:    SettlementAuditService,
    private readonly eventBus:        SettlementEventBus,
  ) {}

  /* ==========================================================
   * PAYOUT INDIVIDUEL
   * ========================================================== */

  /**
   * Exécute le payout pour un retrait PENDING.
   * Idempotent par numéro de tentative.
   */
  async executerPayout(ctx: ExecutePayoutContext): Promise<PayoutExecutionResult> {
    const retrait = await this.retraitRepo.findOne({ where: { id: ctx.retraitId } });
    if (!retrait) {
      throw new SettlementErreur(
        SettlementErreurType.RETRAIT_INTROUVABLE,
        `Retrait ${ctx.retraitId} introuvable.`,
        { retraitId: ctx.retraitId },
      );
    }

    if (retrait.status !== RetraitStatus.PENDING) {
      throw new SettlementErreur(
        SettlementErreurType.RETRAIT_DEJA_EN_COURS,
        `Retrait ${ctx.retraitId} n'est pas PENDING (statut : ${retrait.status}).`,
        { retraitId: ctx.retraitId, status: retrait.status },
      );
    }

    const settings = await this.settingsRepo.findOne({ where: { id: 1 } });
    if (!settings) throw new SettlementErreur(SettlementErreurType.ERREUR_INTERNE, 'PlatformSettings introuvable.');

    const provider = this.providerFactory.getProvider(retrait.methode, settings);
    const frais    = provider.calculerFrais(retrait.montant);
    const montantNet = retrait.montant - frais;
    const attempt  = retrait.attempts;

    // Mettre à jour les frais calculés
    retrait.frais     = frais;
    retrait.montantNet = montantNet;
    if (ctx.batchId) retrait.batchId = ctx.batchId;

    // Marquer PROCESSING (protection double-exécution)
    retrait.status      = RetraitStatus.PROCESSING;
    retrait.processedAt = new Date();
    if (ctx.triggeredByUserId) retrait.processedByUserId = ctx.triggeredByUserId;
    await this.retraitRepo.save(retrait);

    this.eventBus.emit(
      SETTLEMENT_EVENTS.PAYOUT_STARTED,
      new PayoutStartedEvent(
        retrait.id, retrait.walletId, retrait.montant,
        retrait.methode, ctx.batchId ?? null, attempt, new Date(),
      ),
    );

    setImmediate(() => {
      this.auditService.logWithdrawalProcessing({
        retraitId: retrait.id,
        walletId:  retrait.walletId,
        userId:    retrait.userId,
        montant:   retrait.montant,
        attempt,
      });
    });

    const ikey = (op: string) => `settlement-${op}-${retrait.id}-a${attempt}`;

    // Étape 2 : RESERVE (balance → reservedBalance)
    let reserveOk = false;
    try {
      await this.walletEngine.executer({
        walletId:         retrait.walletId,
        amount:           retrait.montant,
        operationType:    WalletOperationType.RESERVE,
        balanceType:      BalanceType.BALANCE,
        idempotencyKey:   ikey('reserve'),
        description:      `Réservation retrait ${retrait.reference}`,
        referenceType:    'retrait',
        referenceId:      retrait.id,
        performedByUserId: ctx.triggeredByUserId ?? 'SYSTEM',
        performedByRole:  'SYSTEM',
      });
      reserveOk = true;
    } catch (reserveErr) {
      return await this._echouerAvantInitiation(retrait, reserveErr, settings);
    }

    // Étape 3 : WITHDRAWAL_INIT (reservedBalance → withdrawingBalance)
    try {
      await this.walletEngine.executer({
        walletId:         retrait.walletId,
        amount:           retrait.montant,
        operationType:    WalletOperationType.WITHDRAWAL_INIT,
        balanceType:      BalanceType.RESERVED,
        idempotencyKey:   ikey('init'),
        description:      `Initiation retrait ${retrait.reference}`,
        referenceType:    'retrait',
        referenceId:      retrait.id,
        performedByUserId: ctx.triggeredByUserId ?? 'SYSTEM',
        performedByRole:  'SYSTEM',
        metadata:         { retraitReference: retrait.reference },
      });
    } catch (initErr) {
      // Annuler le RESERVE si WITHDRAWAL_INIT échoue
      if (reserveOk) {
        await this._relacherReserve(retrait, ikey('release'), ctx.triggeredByUserId);
      }
      return await this._echouerAvantInitiation(retrait, initErr, settings);
    }

    // Étape 4 : appel provider
    const payoutCtx: PayoutContext = {
      retraitId:          retrait.id,
      walletId:           retrait.walletId,
      userId:             retrait.userId,
      montant:            retrait.montant,
      montantNet,
      frais,
      methode:            retrait.methode,
      numeroDestinataire: retrait.numeroDestinataire,
      nomDestinataire:    retrait.nomDestinataire,
      reference:          retrait.reference,
      idempotencyKey:     ikey('provider'),
    };

    const result = await provider.initierPaiement(payoutCtx);

    if (result.success) {
      return await this._confirmerPayout(retrait, result.providerReference!, settings);
    } else {
      return await this._echouerPayout(retrait, result.errorMessage ?? 'Erreur provider', settings);
    }
  }

  /* ==========================================================
   * RETRY
   * ========================================================== */

  /**
   * Relance un payout FAILED si les tentatives ne sont pas épuisées.
   */
  async retryPayout(retraitId: string, triggeredByUserId?: string): Promise<PayoutExecutionResult> {
    const retrait = await this.retraitRepo.findOne({ where: { id: retraitId } });
    if (!retrait) {
      throw new SettlementErreur(SettlementErreurType.RETRAIT_INTROUVABLE, `Retrait ${retraitId} introuvable.`);
    }
    if (retrait.status !== RetraitStatus.FAILED) {
      throw new SettlementErreur(
        SettlementErreurType.RETRAIT_TERMINAL,
        `Retry impossible : statut actuel = ${retrait.status}`,
        { retraitId, status: retrait.status },
      );
    }

    const settings = await this.settingsRepo.findOne({ where: { id: 1 } });
    if (settings && retrait.attempts >= settings.maxWithdrawalAttempts) {
      throw new SettlementErreur(
        SettlementErreurType.MAX_TENTATIVES_ATTEINT,
        `Nombre maximal de tentatives atteint (${retrait.attempts}/${settings.maxWithdrawalAttempts}).`,
        { retraitId, attempts: retrait.attempts },
      );
    }

    retrait.status   = RetraitStatus.PENDING;
    retrait.attempts += 1;
    retrait.failureReason = null;
    await this.retraitRepo.save(retrait);

    return this.executerPayout({ retraitId, triggeredByUserId });
  }

  /* ==========================================================
   * BATCH
   * ========================================================== */

  /**
   * Crée et exécute un batch de retraits PENDING.
   */
  async executerBatch(batchCtx: SettlementBatchContext, retraits: Retrait[]): Promise<SettlementBatch> {
    const now   = new Date();
    const count = await this.batchRepo.count();
    const ref   = `BATCH-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(count + 1).padStart(3, '0')}`;

    const batch = this.batchRepo.create({
      reference:        ref,
      frequence:        batchCtx.frequence,
      triggeredByUserId: batchCtx.triggeredByUserId ?? null,
      status:           SettlementBatchStatus.PENDING,
      nbRetraits:       retraits.length,
      montantTotal:     retraits.reduce((s, r) => s + r.montant, 0),
      fraisTotal:       0,
    });
    await this.batchRepo.save(batch);

    if (retraits.length === 0) {
      batch.status = SettlementBatchStatus.COMPLETED;
      batch.completedAt = new Date();
      await this.batchRepo.save(batch);
      return batch;
    }

    batch.status     = SettlementBatchStatus.PROCESSING;
    batch.startedAt  = new Date();
    await this.batchRepo.save(batch);

    const rapport: BatchRetraitReport[] = [];
    let nbCompleted = 0;
    let nbFailed    = 0;
    let fraisTotal  = 0;

    for (const retrait of retraits) {
      try {
        const result = await this.executerPayout({
          retraitId:        retrait.id,
          batchId:          batch.id,
          triggeredByUserId: batchCtx.triggeredByUserId,
        });

        if (result.success) {
          nbCompleted++;
          fraisTotal += retrait.frais ?? 0;
          rapport.push({
            retraitId:        retrait.id,
            reference:        retrait.reference,
            status:           'completed',
            providerReference: result.providerReference,
            montant:          retrait.montant,
          });
        } else {
          nbFailed++;
          rapport.push({
            retraitId:        retrait.id,
            reference:        retrait.reference,
            status:           'failed',
            providerReference: null,
            montant:          retrait.montant,
            error:            result.errorMessage ?? 'Payout échoué',
          });
        }
      } catch (err) {
        nbFailed++;
        rapport.push({
          retraitId:        retrait.id,
          reference:        retrait.reference,
          status:           'failed',
          providerReference: null,
          montant:          retrait.montant,
          error:            err instanceof Error ? err.message : String(err),
        });
      }
    }

    batch.nbCompleted     = nbCompleted;
    batch.nbFailed        = nbFailed;
    batch.fraisTotal      = fraisTotal;
    batch.executionReport = rapport as unknown as Record<string, unknown>[];
    batch.completedAt     = new Date();
    batch.status          = nbFailed === 0
      ? SettlementBatchStatus.COMPLETED
      : nbCompleted === 0
        ? SettlementBatchStatus.FAILED
        : SettlementBatchStatus.PARTIAL;

    await this.batchRepo.save(batch);

    this.eventBus.emit(
      SETTLEMENT_EVENTS.SETTLEMENT_COMPLETED,
      new SettlementCompletedEvent(
        batch.id, batch.reference, batch.nbRetraits,
        nbCompleted, nbFailed, batch.montantTotal, batch.completedAt,
      ),
    );

    return batch;
  }

  /* ==========================================================
   * HELPERS PRIVÉS
   * ========================================================== */

  private async _confirmerPayout(
    retrait: Retrait,
    providerReference: string,
    settings: PlatformSettings,
  ): Promise<PayoutExecutionResult> {
    // WITHDRAWAL_CONFIRM : withdrawingBalance → 0 (fonds partis)
    await this.walletEngine.executer({
      walletId:         retrait.walletId,
      amount:           retrait.montant,
      operationType:    WalletOperationType.WITHDRAWAL_CONFIRM,
      balanceType:      BalanceType.WITHDRAWING,
      idempotencyKey:   `settlement-confirm-${retrait.id}-a${retrait.attempts}`,
      description:      `Confirmation retrait ${retrait.reference}`,
      referenceType:    'retrait',
      referenceId:      retrait.id,
      performedByUserId: 'SYSTEM',
      performedByRole:  'SYSTEM',
      metadata:         { providerReference },
    });

    retrait.status            = RetraitStatus.COMPLETED;
    retrait.providerReference = providerReference;
    retrait.completedAt       = new Date();
    await this.retraitRepo.save(retrait);

    setImmediate(() => {
      this.auditService.logWithdrawalCompleted({
        retraitId:         retrait.id,
        walletId:          retrait.walletId,
        userId:            retrait.userId,
        montant:           retrait.montant,
        providerReference,
      });
    });

    this.eventBus.emit(
      SETTLEMENT_EVENTS.PAYOUT_SUCCEEDED,
      new PayoutSucceededEvent(
        retrait.id, retrait.walletId, retrait.montant,
        providerReference, retrait.methode, retrait.completedAt!,
      ),
    );

    return {
      retraitId:         retrait.id,
      success:           true,
      providerReference,
      errorMessage:      null,
      attempts:          retrait.attempts,
      completedAt:       retrait.completedAt,
    };
  }

  private async _echouerPayout(
    retrait: Retrait,
    errorMessage: string,
    settings: PlatformSettings,
  ): Promise<PayoutExecutionResult> {
    // WITHDRAWAL_FAIL : withdrawingBalance → balance (rollback)
    try {
      await this.walletEngine.executer({
        walletId:         retrait.walletId,
        amount:           retrait.montant,
        operationType:    WalletOperationType.WITHDRAWAL_FAIL,
        balanceType:      BalanceType.WITHDRAWING,
        idempotencyKey:   `settlement-fail-${retrait.id}-a${retrait.attempts}`,
        description:      `Échec retrait ${retrait.reference} : ${errorMessage.substring(0, 100)}`,
        referenceType:    'retrait',
        referenceId:      retrait.id,
        performedByUserId: 'SYSTEM',
        performedByRole:  'SYSTEM',
      });
    } catch (rollbackErr) {
      this.logger.error(
        `[Payout] CRITIQUE : rollback WITHDRAWAL_FAIL échoué pour ${retrait.id} : ${rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)}`,
      );
    }

    retrait.status        = RetraitStatus.FAILED;
    retrait.failureReason = errorMessage;
    retrait.completedAt   = new Date();
    await this.retraitRepo.save(retrait);

    const definitive = retrait.attempts >= settings.maxWithdrawalAttempts;

    setImmediate(() => {
      this.auditService.logWithdrawalFailed({
        retraitId:  retrait.id,
        walletId:   retrait.walletId,
        userId:     retrait.userId,
        montant:    retrait.montant,
        raison:     errorMessage,
        attempt:    retrait.attempts,
        definitive,
      });
    });

    this.eventBus.emit(
      SETTLEMENT_EVENTS.PAYOUT_FAILED,
      new PayoutFailedEvent(
        retrait.id, retrait.walletId, retrait.montant,
        errorMessage, retrait.methode, retrait.attempts, new Date(),
      ),
    );

    return {
      retraitId:    retrait.id,
      success:      false,
      providerReference: null,
      errorMessage,
      attempts:     retrait.attempts,
      completedAt:  null,
    };
  }

  private async _echouerAvantInitiation(
    retrait: Retrait,
    err: unknown,
    settings: PlatformSettings,
  ): Promise<PayoutExecutionResult> {
    const msg = err instanceof Error ? err.message : String(err);
    retrait.status        = RetraitStatus.FAILED;
    retrait.failureReason = msg;
    retrait.completedAt   = new Date();
    await this.retraitRepo.save(retrait);

    const definitive = retrait.attempts >= settings.maxWithdrawalAttempts;
    setImmediate(() => {
      this.auditService.logWithdrawalFailed({
        retraitId:  retrait.id,
        walletId:   retrait.walletId,
        userId:     retrait.userId,
        montant:    retrait.montant,
        raison:     msg,
        attempt:    retrait.attempts,
        definitive,
      });
    });

    this.eventBus.emit(
      SETTLEMENT_EVENTS.PAYOUT_FAILED,
      new PayoutFailedEvent(
        retrait.id, retrait.walletId, retrait.montant,
        msg, retrait.methode, retrait.attempts, new Date(),
      ),
    );

    return {
      retraitId:    retrait.id,
      success:      false,
      providerReference: null,
      errorMessage: msg,
      attempts:     retrait.attempts,
      completedAt:  null,
    };
  }

  private async _relacherReserve(
    retrait: Retrait,
    idempotencyKey: string,
    triggeredByUserId?: string | null,
  ): Promise<void> {
    try {
      await this.walletEngine.executer({
        walletId:         retrait.walletId,
        amount:           retrait.montant,
        operationType:    WalletOperationType.RELEASE,
        balanceType:      BalanceType.RESERVED,
        idempotencyKey,
        description:      `Libération réserve retrait ${retrait.reference}`,
        referenceType:    'retrait',
        referenceId:      retrait.id,
        performedByUserId: triggeredByUserId ?? 'SYSTEM',
        performedByRole:  'SYSTEM',
      });
    } catch (err) {
      this.logger.error(
        `[Payout] Impossible de libérer la réserve pour ${retrait.id} : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
