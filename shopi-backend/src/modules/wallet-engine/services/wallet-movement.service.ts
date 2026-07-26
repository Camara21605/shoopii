/* ============================================================
 * FICHIER : src/modules/wallet-engine/services/wallet-movement.service.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Exécute tous les mouvements financiers du Wallet Engine.
 *
 * Ce service est le SEUL autorisé à modifier les soldes d'un Wallet.
 *
 * 9 TYPES DE MOUVEMENTS
 * ------------------------------------------------------------
 * 1. crediter        — CREDIT vers balance ou pendingBalance
 * 2. debiter         — DÉBIT depuis balance
 * 3. bloquer         — balance → blockedBalance (gel admin)
 * 4. debloquer       — blockedBalance → balance (dégel admin)
 * 5. reserver        — balance → reservedBalance (autorisation)
 * 6. liberer         — reservedBalance → balance (annulation)
 * 7. initierRetrait  — reservedBalance → withdrawingBalance
 * 8. confirmerRetrait— withdrawingBalance → 0 (fonds envoyés)
 * 9. echouerRetrait  — withdrawingBalance → balance (rollback)
 *
 * PROTECTION ANTI-RACE
 * ------------------------------------------------------------
 * Chaque méthode exige un QueryRunner actif + wallet verrouillé
 * (SELECT FOR UPDATE via WalletLockService).
 *
 * Ne jamais appeler sans transaction SQL active.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';

import { Wallet } from '../../../database/entities/wallet.entity';
import { WalletTransaction, TransactionType, TransactionStatus } from '../../../database/entities/wallet-transaction.entity';
import { WalletLedgerEntry, LedgerEntryDirection } from '../../../database/entities/wallet-ledger-entry.entity';
import {
  WalletOperationType,
  BalanceType,
  WalletOperationContext,
  WalletOperationResult,
  WalletTransferContext,
  WalletTransferResult,
  WalletEtat,
  WalletErreur,
  WalletErreurType,
} from '../types/wallet-engine.types';
import { WalletLedgerService } from './wallet-ledger.service';
import { WalletValidatorService } from './wallet-validator.service';

@Injectable()
export class WalletMovementService {

  private readonly logger = new Logger(WalletMovementService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private readonly txRepo: Repository<WalletTransaction>,
    private readonly ledgerService: WalletLedgerService,
    private readonly validatorService: WalletValidatorService,
  ) {}

  /* ==========================================================
   * 1. CRÉDIT (DEPOSIT, COMMISSION, REFUND, ESCROW_RELEASE…)
   * ========================================================== */

  async crediter(
    wallet: Wallet,
    ctx: WalletOperationContext,
    qr: QueryRunner,
  ): Promise<WalletOperationResult> {
    this.validatorService.validerMontant(ctx.amount);
    this.validatorService.validerStatutWallet(wallet);

    const targetBalance = ctx.balanceType ?? BalanceType.BALANCE;
    const balanceBefore = this.getSolde(wallet, targetBalance);
    const balanceAfter  = balanceBefore + ctx.amount;

    this.setSolde(wallet, targetBalance, balanceAfter);
    wallet.totalCredited += ctx.amount;
    wallet.lastTransactionAt = new Date();

    const savedWallet = await qr.manager.save(Wallet, wallet);

    const tx = await this.creerTransaction(wallet.id, {
      type:         TransactionType.CREDIT,
      amount:       ctx.amount,
      balanceBefore,
      balanceAfter,
      operationType:ctx.operationType,
      balanceType:  targetBalance,
      idempotencyKey: ctx.idempotencyKey ?? null,
      performedBy:  ctx.performedByUserId ?? null,
      performedByRole: ctx.performedByRole ?? null,
      note:         ctx.note ?? null,
      ipAddress:    ctx.ipAddress ?? null,
      description:  ctx.description ?? null,
      referenceType:ctx.referenceType ?? null,
      referenceId:  ctx.referenceId   ?? null,
      metadata:     ctx.metadata      ?? null,
    }, qr);

    const ledgerEntry = await this.ledgerService.enregistrerCredit({
      walletId: wallet.id,
      transactionId: tx.id,
      operationType: ctx.operationType,
      amount:       ctx.amount,
      currency:     savedWallet.currency,
      balanceType:  targetBalance,
      balanceBefore,
      balanceAfter,
      description:  ctx.description  ?? null,
      referenceType:ctx.referenceType ?? null,
      referenceId:  ctx.referenceId   ?? null,
      performedByUserId: ctx.performedByUserId ?? null,
      performedByRole:   ctx.performedByRole   ?? null,
      ipAddress:    ctx.ipAddress ?? null,
      metadata:     ctx.metadata  ?? null,
    }, qr);

    await this.completerTransaction(tx.id, qr);

    return this.buildResult(tx.id, ledgerEntry.id, ctx, targetBalance, balanceBefore, balanceAfter, savedWallet);
  }

  /* ==========================================================
   * 2. DÉBIT (WITHDRAWAL_INIT, TRANSFER_OUT…)
   * ========================================================== */

  async debiter(
    wallet: Wallet,
    ctx: WalletOperationContext,
    qr: QueryRunner,
  ): Promise<WalletOperationResult> {
    const sourceBalance = ctx.balanceType ?? BalanceType.BALANCE;
    this.validatorService.validerTout(wallet, ctx, true);

    if (
      ctx.operationType === WalletOperationType.WITHDRAWAL_INIT ||
      ctx.operationType === WalletOperationType.WITHDRAWAL_CONFIRM
    ) {
      this.validatorService.validerLimiteRetrait(wallet, ctx.amount);
    }

    const balanceBefore = this.getSolde(wallet, sourceBalance);
    const balanceAfter  = balanceBefore - ctx.amount;

    this.setSolde(wallet, sourceBalance, balanceAfter);
    wallet.totalDebited += ctx.amount;
    wallet.lastTransactionAt = new Date();

    const savedWallet = await qr.manager.save(Wallet, wallet);

    const tx = await this.creerTransaction(wallet.id, {
      type:         TransactionType.DEBIT,
      amount:       ctx.amount,
      balanceBefore,
      balanceAfter,
      operationType: ctx.operationType,
      balanceType:   sourceBalance,
      idempotencyKey: ctx.idempotencyKey ?? null,
      performedBy:   ctx.performedByUserId ?? null,
      performedByRole: ctx.performedByRole ?? null,
      note:          ctx.note     ?? null,
      ipAddress:     ctx.ipAddress ?? null,
      description:   ctx.description  ?? null,
      referenceType: ctx.referenceType ?? null,
      referenceId:   ctx.referenceId   ?? null,
      metadata:      ctx.metadata      ?? null,
    }, qr);

    const ledgerEntry = await this.ledgerService.enregistrerDebit({
      walletId: wallet.id,
      transactionId: tx.id,
      operationType: ctx.operationType,
      amount:       ctx.amount,
      currency:     savedWallet.currency,
      balanceType:  sourceBalance,
      balanceBefore,
      balanceAfter,
      description:  ctx.description  ?? null,
      referenceType:ctx.referenceType ?? null,
      referenceId:  ctx.referenceId   ?? null,
      performedByUserId: ctx.performedByUserId ?? null,
      performedByRole:   ctx.performedByRole   ?? null,
      ipAddress:    ctx.ipAddress ?? null,
      metadata:     ctx.metadata  ?? null,
    }, qr);

    await this.completerTransaction(tx.id, qr);

    return this.buildResult(tx.id, ledgerEntry.id, ctx, sourceBalance, balanceBefore, balanceAfter, savedWallet);
  }

  /* ==========================================================
   * 3. BLOQUER (balance → blockedBalance)
   * ========================================================== */

  async bloquer(
    wallet: Wallet,
    ctx: WalletOperationContext,
    qr: QueryRunner,
  ): Promise<WalletOperationResult> {
    this.validatorService.validerNoteObligatoire(ctx);
    this.validatorService.validerSolde(wallet, ctx.amount, BalanceType.BALANCE);

    const balanceBefore    = wallet.balance;
    const balanceAfter     = balanceBefore - ctx.amount;
    const blockedBefore    = wallet.blockedBalance;
    const blockedAfter     = blockedBefore + ctx.amount;

    wallet.balance        = balanceAfter;
    wallet.blockedBalance = blockedAfter;
    wallet.lastTransactionAt = new Date();
    const savedWallet = await qr.manager.save(Wallet, wallet);

    const tx = await this.creerTransaction(wallet.id, {
      type: TransactionType.DEBIT,
      amount: ctx.amount,
      balanceBefore,
      balanceAfter,
      operationType: WalletOperationType.BLOCK,
      balanceType: BalanceType.BALANCE,
      idempotencyKey: ctx.idempotencyKey ?? null,
      performedBy: ctx.performedByUserId ?? null,
      performedByRole: ctx.performedByRole ?? null,
      note:        ctx.note     ?? null,
      ipAddress:   ctx.ipAddress ?? null,
      description: ctx.description  ?? 'Blocage administratif',
      referenceType: ctx.referenceType ?? null,
      referenceId:   ctx.referenceId   ?? null,
      metadata:      ctx.metadata      ?? null,
    }, qr);

    const ledgerEntry = await this.ledgerService.enregistrerDebit({
      walletId: wallet.id,
      transactionId: tx.id,
      operationType: WalletOperationType.BLOCK,
      amount: ctx.amount,
      currency: savedWallet.currency,
      balanceType: BalanceType.BALANCE,
      balanceBefore,
      balanceAfter,
      description: ctx.description ?? 'Blocage administratif',
      referenceType: ctx.referenceType ?? null,
      referenceId:   ctx.referenceId   ?? null,
      performedByUserId: ctx.performedByUserId ?? null,
      performedByRole:   ctx.performedByRole   ?? null,
      ipAddress: ctx.ipAddress ?? null,
      metadata: { ...ctx.metadata, blockedBefore, blockedAfter },
    }, qr);

    await this.completerTransaction(tx.id, qr);

    return this.buildResult(tx.id, ledgerEntry.id, ctx, BalanceType.BALANCE, balanceBefore, balanceAfter, savedWallet);
  }

  /* ==========================================================
   * 4. DÉBLOQUER (blockedBalance → balance)
   * ========================================================== */

  async debloquer(
    wallet: Wallet,
    ctx: WalletOperationContext,
    qr: QueryRunner,
  ): Promise<WalletOperationResult> {
    this.validatorService.validerNoteObligatoire(ctx);
    this.validatorService.validerSolde(wallet, ctx.amount, BalanceType.BLOCKED);

    const blockedBefore = wallet.blockedBalance;
    const blockedAfter  = blockedBefore - ctx.amount;
    const balanceBefore = wallet.balance;
    const balanceAfter  = balanceBefore + ctx.amount;

    wallet.blockedBalance = blockedAfter;
    wallet.balance        = balanceAfter;
    wallet.lastTransactionAt = new Date();
    const savedWallet = await qr.manager.save(Wallet, wallet);

    const tx = await this.creerTransaction(wallet.id, {
      type: TransactionType.CREDIT,
      amount: ctx.amount,
      balanceBefore: blockedBefore,
      balanceAfter:  blockedAfter,
      operationType: WalletOperationType.UNBLOCK,
      balanceType: BalanceType.BLOCKED,
      idempotencyKey: ctx.idempotencyKey ?? null,
      performedBy: ctx.performedByUserId ?? null,
      performedByRole: ctx.performedByRole ?? null,
      note:        ctx.note     ?? null,
      ipAddress:   ctx.ipAddress ?? null,
      description: ctx.description ?? 'Déblocage administratif',
      referenceType: ctx.referenceType ?? null,
      referenceId:   ctx.referenceId   ?? null,
      metadata:      ctx.metadata      ?? null,
    }, qr);

    const ledgerEntry = await this.ledgerService.enregistrerCredit({
      walletId: wallet.id,
      transactionId: tx.id,
      operationType: WalletOperationType.UNBLOCK,
      amount: ctx.amount,
      currency: savedWallet.currency,
      balanceType: BalanceType.BALANCE,
      balanceBefore,
      balanceAfter,
      description: ctx.description ?? 'Déblocage administratif',
      referenceType: ctx.referenceType ?? null,
      referenceId:   ctx.referenceId   ?? null,
      performedByUserId: ctx.performedByUserId ?? null,
      performedByRole:   ctx.performedByRole   ?? null,
      ipAddress: ctx.ipAddress ?? null,
      metadata: { ...ctx.metadata, blockedBefore, blockedAfter },
    }, qr);

    await this.completerTransaction(tx.id, qr);

    return this.buildResult(tx.id, ledgerEntry.id, ctx, BalanceType.BLOCKED, blockedBefore, blockedAfter, savedWallet);
  }

  /* ==========================================================
   * 5. RÉSERVER (balance → reservedBalance)
   * ========================================================== */

  async reserver(
    wallet: Wallet,
    ctx: WalletOperationContext,
    qr: QueryRunner,
  ): Promise<WalletOperationResult> {
    this.validatorService.validerSolde(wallet, ctx.amount, BalanceType.BALANCE);

    const balanceBefore  = wallet.balance;
    const balanceAfter   = balanceBefore - ctx.amount;
    const reservedBefore = wallet.reservedBalance;
    const reservedAfter  = reservedBefore + ctx.amount;

    wallet.balance         = balanceAfter;
    wallet.reservedBalance = reservedAfter;
    wallet.lastTransactionAt = new Date();
    const savedWallet = await qr.manager.save(Wallet, wallet);

    const tx = await this.creerTransaction(wallet.id, {
      type: TransactionType.DEBIT,
      amount: ctx.amount,
      balanceBefore,
      balanceAfter,
      operationType: WalletOperationType.RESERVE,
      balanceType: BalanceType.BALANCE,
      idempotencyKey: ctx.idempotencyKey ?? null,
      performedBy: ctx.performedByUserId ?? null,
      performedByRole: ctx.performedByRole ?? null,
      note:        ctx.note     ?? null,
      ipAddress:   ctx.ipAddress ?? null,
      description: ctx.description ?? 'Réservation de fonds',
      referenceType: ctx.referenceType ?? null,
      referenceId:   ctx.referenceId   ?? null,
      metadata:      ctx.metadata      ?? null,
    }, qr);

    const ledgerEntry = await this.ledgerService.enregistrerDebit({
      walletId: wallet.id,
      transactionId: tx.id,
      operationType: WalletOperationType.RESERVE,
      amount: ctx.amount,
      currency: savedWallet.currency,
      balanceType: BalanceType.BALANCE,
      balanceBefore,
      balanceAfter,
      description: ctx.description ?? 'Réservation de fonds',
      referenceType: ctx.referenceType ?? null,
      referenceId:   ctx.referenceId   ?? null,
      performedByUserId: ctx.performedByUserId ?? null,
      performedByRole:   ctx.performedByRole   ?? null,
      ipAddress: ctx.ipAddress ?? null,
      metadata: { ...ctx.metadata, reservedBefore, reservedAfter },
    }, qr);

    await this.completerTransaction(tx.id, qr);

    return this.buildResult(tx.id, ledgerEntry.id, ctx, BalanceType.BALANCE, balanceBefore, balanceAfter, savedWallet);
  }

  /* ==========================================================
   * 6. LIBÉRER (reservedBalance → balance)
   * ========================================================== */

  async liberer(
    wallet: Wallet,
    ctx: WalletOperationContext,
    qr: QueryRunner,
  ): Promise<WalletOperationResult> {
    this.validatorService.validerSolde(wallet, ctx.amount, BalanceType.RESERVED);

    const reservedBefore = wallet.reservedBalance;
    const reservedAfter  = reservedBefore - ctx.amount;
    const balanceBefore  = wallet.balance;
    const balanceAfter   = balanceBefore + ctx.amount;

    wallet.reservedBalance = reservedAfter;
    wallet.balance         = balanceAfter;
    wallet.lastTransactionAt = new Date();
    const savedWallet = await qr.manager.save(Wallet, wallet);

    const tx = await this.creerTransaction(wallet.id, {
      type: TransactionType.CREDIT,
      amount: ctx.amount,
      balanceBefore: reservedBefore,
      balanceAfter:  reservedAfter,
      operationType: WalletOperationType.RELEASE,
      balanceType: BalanceType.RESERVED,
      idempotencyKey: ctx.idempotencyKey ?? null,
      performedBy: ctx.performedByUserId ?? null,
      performedByRole: ctx.performedByRole ?? null,
      note:        ctx.note     ?? null,
      ipAddress:   ctx.ipAddress ?? null,
      description: ctx.description ?? 'Libération de réservation',
      referenceType: ctx.referenceType ?? null,
      referenceId:   ctx.referenceId   ?? null,
      metadata:      ctx.metadata      ?? null,
    }, qr);

    const ledgerEntry = await this.ledgerService.enregistrerCredit({
      walletId: wallet.id,
      transactionId: tx.id,
      operationType: WalletOperationType.RELEASE,
      amount: ctx.amount,
      currency: savedWallet.currency,
      balanceType: BalanceType.BALANCE,
      balanceBefore,
      balanceAfter,
      description: ctx.description ?? 'Libération de réservation',
      referenceType: ctx.referenceType ?? null,
      referenceId:   ctx.referenceId   ?? null,
      performedByUserId: ctx.performedByUserId ?? null,
      performedByRole:   ctx.performedByRole   ?? null,
      ipAddress: ctx.ipAddress ?? null,
      metadata: { ...ctx.metadata, reservedBefore, reservedAfter },
    }, qr);

    await this.completerTransaction(tx.id, qr);

    return this.buildResult(tx.id, ledgerEntry.id, ctx, BalanceType.RESERVED, reservedBefore, reservedAfter, savedWallet);
  }

  /* ==========================================================
   * 7. INITIER RETRAIT (reservedBalance → withdrawingBalance)
   * ========================================================== */

  async initierRetrait(
    wallet: Wallet,
    ctx: WalletOperationContext,
    qr: QueryRunner,
  ): Promise<WalletOperationResult> {
    this.validatorService.validerSolde(wallet, ctx.amount, BalanceType.RESERVED);
    this.validatorService.validerLimiteRetrait(wallet, ctx.amount);

    const reservedBefore    = wallet.reservedBalance;
    const reservedAfter     = reservedBefore - ctx.amount;
    const withdrawingBefore = wallet.withdrawingBalance;
    const withdrawingAfter  = withdrawingBefore + ctx.amount;

    wallet.reservedBalance    = reservedAfter;
    wallet.withdrawingBalance = withdrawingAfter;
    wallet.todayWithdrawAmount += ctx.amount;
    wallet.lastTransactionAt = new Date();
    const savedWallet = await qr.manager.save(Wallet, wallet);

    const tx = await this.creerTransaction(wallet.id, {
      type: TransactionType.DEBIT,
      amount: ctx.amount,
      balanceBefore: reservedBefore,
      balanceAfter:  reservedAfter,
      operationType: WalletOperationType.WITHDRAWAL_INIT,
      balanceType: BalanceType.RESERVED,
      idempotencyKey: ctx.idempotencyKey ?? null,
      performedBy: ctx.performedByUserId ?? null,
      performedByRole: ctx.performedByRole ?? null,
      note:        ctx.note     ?? null,
      ipAddress:   ctx.ipAddress ?? null,
      description: ctx.description ?? 'Initiation retrait',
      referenceType: ctx.referenceType ?? null,
      referenceId:   ctx.referenceId   ?? null,
      metadata:      ctx.metadata      ?? null,
    }, qr);

    const ledgerEntry = await this.ledgerService.enregistrerDebit({
      walletId: wallet.id,
      transactionId: tx.id,
      operationType: WalletOperationType.WITHDRAWAL_INIT,
      amount: ctx.amount,
      currency: savedWallet.currency,
      balanceType: BalanceType.RESERVED,
      balanceBefore: reservedBefore,
      balanceAfter:  reservedAfter,
      description: ctx.description ?? 'Initiation retrait',
      referenceType: ctx.referenceType ?? null,
      referenceId:   ctx.referenceId   ?? null,
      performedByUserId: ctx.performedByUserId ?? null,
      performedByRole:   ctx.performedByRole   ?? null,
      ipAddress: ctx.ipAddress ?? null,
      metadata: { ...ctx.metadata, withdrawingBefore, withdrawingAfter },
    }, qr);

    await this.completerTransaction(tx.id, qr);

    return this.buildResult(tx.id, ledgerEntry.id, ctx, BalanceType.RESERVED, reservedBefore, reservedAfter, savedWallet);
  }

  /* ==========================================================
   * 8. CONFIRMER RETRAIT (withdrawingBalance → 0)
   * ========================================================== */

  async confirmerRetrait(
    wallet: Wallet,
    ctx: WalletOperationContext,
    qr: QueryRunner,
  ): Promise<WalletOperationResult> {
    this.validatorService.validerSolde(wallet, ctx.amount, BalanceType.WITHDRAWING);

    const withdrawingBefore = wallet.withdrawingBalance;
    const withdrawingAfter  = withdrawingBefore - ctx.amount;

    wallet.withdrawingBalance = withdrawingAfter;
    wallet.totalDebited      += ctx.amount;
    wallet.lastTransactionAt = new Date();
    const savedWallet = await qr.manager.save(Wallet, wallet);

    const tx = await this.creerTransaction(wallet.id, {
      type: TransactionType.DEBIT,
      amount: ctx.amount,
      balanceBefore: withdrawingBefore,
      balanceAfter:  withdrawingAfter,
      operationType: WalletOperationType.WITHDRAWAL_CONFIRM,
      balanceType: BalanceType.WITHDRAWING,
      idempotencyKey: ctx.idempotencyKey ?? null,
      performedBy: ctx.performedByUserId ?? null,
      performedByRole: ctx.performedByRole ?? null,
      note:        ctx.note     ?? null,
      ipAddress:   ctx.ipAddress ?? null,
      description: ctx.description ?? 'Confirmation retrait',
      referenceType: ctx.referenceType ?? null,
      referenceId:   ctx.referenceId   ?? null,
      metadata:      ctx.metadata      ?? null,
    }, qr);

    const ledgerEntry = await this.ledgerService.enregistrerDebit({
      walletId: wallet.id,
      transactionId: tx.id,
      operationType: WalletOperationType.WITHDRAWAL_CONFIRM,
      amount: ctx.amount,
      currency: savedWallet.currency,
      balanceType: BalanceType.WITHDRAWING,
      balanceBefore: withdrawingBefore,
      balanceAfter:  withdrawingAfter,
      description: ctx.description ?? 'Confirmation retrait',
      referenceType: ctx.referenceType ?? null,
      referenceId:   ctx.referenceId   ?? null,
      performedByUserId: ctx.performedByUserId ?? null,
      performedByRole:   ctx.performedByRole   ?? null,
      ipAddress: ctx.ipAddress ?? null,
      metadata:  ctx.metadata  ?? null,
    }, qr);

    await this.completerTransaction(tx.id, qr);

    return this.buildResult(tx.id, ledgerEntry.id, ctx, BalanceType.WITHDRAWING, withdrawingBefore, withdrawingAfter, savedWallet);
  }

  /* ==========================================================
   * 9. ÉCHEC RETRAIT (withdrawingBalance → balance)
   * ========================================================== */

  async echouerRetrait(
    wallet: Wallet,
    ctx: WalletOperationContext,
    qr: QueryRunner,
  ): Promise<WalletOperationResult> {
    this.validatorService.validerSolde(wallet, ctx.amount, BalanceType.WITHDRAWING);

    const withdrawingBefore = wallet.withdrawingBalance;
    const withdrawingAfter  = withdrawingBefore - ctx.amount;
    const balanceBefore     = wallet.balance;
    const balanceAfter      = balanceBefore + ctx.amount;

    wallet.withdrawingBalance = withdrawingAfter;
    wallet.balance            = balanceAfter;
    wallet.todayWithdrawAmount = Math.max(0, wallet.todayWithdrawAmount - ctx.amount);
    wallet.lastTransactionAt = new Date();
    const savedWallet = await qr.manager.save(Wallet, wallet);

    const tx = await this.creerTransaction(wallet.id, {
      type: TransactionType.CREDIT,
      amount: ctx.amount,
      balanceBefore,
      balanceAfter,
      operationType: WalletOperationType.WITHDRAWAL_FAIL,
      balanceType: BalanceType.BALANCE,
      idempotencyKey: ctx.idempotencyKey ?? null,
      performedBy: ctx.performedByUserId ?? null,
      performedByRole: ctx.performedByRole ?? null,
      note:        ctx.note     ?? null,
      ipAddress:   ctx.ipAddress ?? null,
      description: ctx.description ?? 'Échec retrait — fonds retournés',
      referenceType: ctx.referenceType ?? null,
      referenceId:   ctx.referenceId   ?? null,
      metadata:      ctx.metadata      ?? null,
    }, qr);

    const ledgerEntry = await this.ledgerService.enregistrerCredit({
      walletId: wallet.id,
      transactionId: tx.id,
      operationType: WalletOperationType.WITHDRAWAL_FAIL,
      amount: ctx.amount,
      currency: savedWallet.currency,
      balanceType: BalanceType.BALANCE,
      balanceBefore,
      balanceAfter,
      description: ctx.description ?? 'Échec retrait — fonds retournés',
      referenceType: ctx.referenceType ?? null,
      referenceId:   ctx.referenceId   ?? null,
      performedByUserId: ctx.performedByUserId ?? null,
      performedByRole:   ctx.performedByRole   ?? null,
      ipAddress: ctx.ipAddress ?? null,
      metadata: { ...ctx.metadata, withdrawingBefore, withdrawingAfter },
    }, qr);

    await this.completerTransaction(tx.id, qr);

    return this.buildResult(tx.id, ledgerEntry.id, ctx, BalanceType.BALANCE, balanceBefore, balanceAfter, savedWallet);
  }

  /* ==========================================================
   * HELPERS PRIVÉS
   * ========================================================== */

  private getSolde(wallet: Wallet, type: BalanceType): number {
    switch (type) {
      case BalanceType.BALANCE:     return wallet.balance;
      case BalanceType.PENDING:     return wallet.pendingBalance;
      case BalanceType.BLOCKED:     return wallet.blockedBalance;
      case BalanceType.RESERVED:    return wallet.reservedBalance;
      case BalanceType.WITHDRAWING: return wallet.withdrawingBalance;
      default:                       return wallet.balance;
    }
  }

  private setSolde(wallet: Wallet, type: BalanceType, value: number): void {
    switch (type) {
      case BalanceType.BALANCE:     wallet.balance            = value; break;
      case BalanceType.PENDING:     wallet.pendingBalance     = value; break;
      case BalanceType.BLOCKED:     wallet.blockedBalance     = value; break;
      case BalanceType.RESERVED:    wallet.reservedBalance    = value; break;
      case BalanceType.WITHDRAWING: wallet.withdrawingBalance = value; break;
    }
  }

  private async creerTransaction(
    walletId: string,
    data: {
      type: TransactionType;
      amount: number;
      balanceBefore: number;
      balanceAfter: number;
      operationType: WalletOperationType;
      balanceType: BalanceType;
      idempotencyKey: string | null;
      performedBy: string | null;
      performedByRole: string | null;
      note: string | null;
      ipAddress: string | null;
      description: string | null;
      referenceType: string | null;
      referenceId: string | null;
      metadata: Record<string, unknown> | null;
    },
    qr: QueryRunner,
  ): Promise<WalletTransaction> {
    const tx = qr.manager.create(WalletTransaction, {
      walletId,
      type:           data.type,
      status:         TransactionStatus.PENDING,
      amount:         data.amount,
      balanceBefore:  data.balanceBefore,
      balanceAfter:   data.balanceAfter,
      operationType:  data.operationType,
      balanceType:    data.balanceType,
      idempotencyKey: data.idempotencyKey,
      performedBy:    data.performedBy,
      performedByRole:data.performedByRole,
      note:           data.note,
      ipAddress:      data.ipAddress,
      description:    data.description,
      referenceType:  data.referenceType,
      referenceId:    data.referenceId,
      metadata:       data.metadata,
      relatedWalletId:null,
    });

    return qr.manager.save(WalletTransaction, tx);
  }

  private async completerTransaction(txId: string, qr: QueryRunner): Promise<void> {
    await qr.manager.update(WalletTransaction, txId, {
      status: TransactionStatus.COMPLETED,
    });
  }

  private buildResult(
    transactionId: string,
    ledgerEntryId: string,
    ctx: WalletOperationContext,
    balanceType: BalanceType,
    balanceBefore: number,
    balanceAfter: number,
    wallet: Wallet,
  ): WalletOperationResult {
    const walletApres: WalletEtat = {
      id:                wallet.id,
      walletType:        wallet.walletType,
      userId:            wallet.userId,
      currency:          wallet.currency,
      status:            wallet.status,
      balance:           wallet.balance,
      pendingBalance:    wallet.pendingBalance,
      blockedBalance:    wallet.blockedBalance,
      reservedBalance:   wallet.reservedBalance,
      withdrawingBalance:wallet.withdrawingBalance,
      totalBalance:      wallet.balance + wallet.pendingBalance + wallet.blockedBalance + wallet.reservedBalance + wallet.withdrawingBalance,
      version:           wallet.version,
      lastTransactionAt: wallet.lastTransactionAt,
      updatedAt:         wallet.updatedAt,
    };

    return {
      transactionId,
      ledgerEntryId,
      walletApres,
      operationType: ctx.operationType,
      amount:        ctx.amount,
      balanceType,
      idempotencyKey: ctx.idempotencyKey ?? null,
      executedAt:    new Date(),
    };
  }
}
