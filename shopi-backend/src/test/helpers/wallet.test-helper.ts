/* ============================================================
 * FICHIER : src/test/helpers/wallet.test-helper.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Factories de données de test pour les entités Wallet.
 * Utilisé dans tous les tests unitaires et d'intégration
 * impliquant WalletEngine, WalletValidatorService, etc.
 *
 * CONVENTIONS
 * ─────────────────────────────────────────────────────────────
 *   - makeWallet()    → Wallet prêt pour injection dans les mocks
 *   - makeWalletCtx() → WalletOperationContext prêt pour executer()
 *   - makeTransferCtx() → WalletTransferContext prêt pour transferer()
 *
 * VALEURS PAR DÉFAUT
 * ─────────────────────────────────────────────────────────────
 *   Wallet ACTIVE, solde 100 000 GNF, devise GNF, type CLIENT
 *   Toutes les valeurs sont surchargeable via partial override.
 * ============================================================ */

import { Wallet, WalletType, WalletStatus, WalletCurrency } from '../../database/entities/wallet.entity';
import {
  WalletOperationContext,
  WalletOperationType,
  BalanceType,
  WalletTransferContext,
} from '../../modules/wallet-engine/types/wallet-engine.types';

/* ============================================================
 * FACTORY — WALLET ENTITY
 * ============================================================ */

export function makeWallet(overrides: Partial<Wallet> = {}): Wallet {
  const wallet = new Wallet();
  wallet.id                  = overrides.id                  ?? 'wallet-uuid-001';
  wallet.userId              = overrides.userId              ?? 'user-uuid-001';
  wallet.walletType          = overrides.walletType          ?? WalletType.CLIENT;
  wallet.status              = overrides.status              ?? WalletStatus.ACTIVE;
  wallet.currency            = overrides.currency            ?? WalletCurrency.GNF;
  wallet.balance             = overrides.balance             ?? 100_000;
  wallet.pendingBalance      = overrides.pendingBalance      ?? 0;
  wallet.blockedBalance      = overrides.blockedBalance      ?? 0;
  wallet.reservedBalance     = overrides.reservedBalance     ?? 0;
  wallet.withdrawingBalance  = overrides.withdrawingBalance  ?? 0;
  wallet.dailyWithdrawLimit  = overrides.dailyWithdrawLimit  ?? 0;
  wallet.todayWithdrawAmount = overrides.todayWithdrawAmount ?? 0;
  wallet.freezeReason        = overrides.freezeReason        ?? null;
  wallet.version             = overrides.version             ?? 1;
  wallet.createdAt           = overrides.createdAt           ?? new Date('2025-01-01');
  wallet.updatedAt           = overrides.updatedAt           ?? new Date('2025-01-01');
  return wallet;
}

/* ============================================================
 * FACTORY — OPERATION CONTEXT
 * ============================================================ */

export function makeWalletCtx(
  overrides: Partial<WalletOperationContext> = {},
): WalletOperationContext {
  return {
    walletId:          overrides.walletId          ?? 'wallet-uuid-001',
    amount:            overrides.amount            ?? 10_000,
    operationType:     overrides.operationType     ?? WalletOperationType.DEPOSIT,
    balanceType:       overrides.balanceType       ?? BalanceType.BALANCE,
    idempotencyKey:    overrides.idempotencyKey    ?? null,
    description:       overrides.description       ?? 'Test deposit',
    note:              overrides.note              ?? null,
    referenceType:     overrides.referenceType     ?? null,
    referenceId:       overrides.referenceId       ?? null,
    performedByUserId: overrides.performedByUserId ?? 'user-uuid-admin',
    performedByRole:   overrides.performedByRole   ?? 'ADMIN',
    ipAddress:         overrides.ipAddress         ?? '127.0.0.1',
    metadata:          overrides.metadata          ?? null,
  };
}

/* ============================================================
 * FACTORY — TRANSFER CONTEXT
 * ============================================================ */

export function makeTransferCtx(
  overrides: Partial<WalletTransferContext> = {},
): WalletTransferContext {
  return {
    sourceWalletId:    overrides.sourceWalletId    ?? 'wallet-src-001',
    targetWalletId:    overrides.targetWalletId    ?? 'wallet-tgt-001',
    amount:            overrides.amount            ?? 5_000,
    currency:          overrides.currency          ?? WalletCurrency.GNF,
    idempotencyKey:    overrides.idempotencyKey    ?? null,
    description:       overrides.description       ?? 'Test transfer',
    note:              overrides.note              ?? null,
    referenceType:     overrides.referenceType     ?? null,
    referenceId:       overrides.referenceId       ?? null,
    performedByUserId: overrides.performedByUserId ?? 'user-uuid-admin',
    performedByRole:   overrides.performedByRole   ?? 'SYSTEM',
    ipAddress:         overrides.ipAddress         ?? null,
    metadata:          overrides.metadata          ?? null,
  };
}

/* ============================================================
 * FACTORY — WALLET OPERATION RESULT (pour mocks)
 * ============================================================ */

export function makeWalletOperationResult(
  walletId = 'wallet-uuid-001',
  operationType = WalletOperationType.DEPOSIT,
  amount = 10_000,
) {
  const wallet = makeWallet({ id: walletId, balance: 110_000 });
  return {
    transactionId:  'tx-uuid-001',
    ledgerEntryId:  'ledger-uuid-001',
    walletApres:    { ...wallet, totalBalance: wallet.balance },
    operationType,
    amount,
    balanceType:    BalanceType.BALANCE,
    idempotencyKey: null,
    executedAt:     new Date(),
  };
}
