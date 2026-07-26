/* ============================================================
 * FICHIER : src/modules/wallet-engine/events/wallet.events.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Classes d'événements typés émis par le Wallet Engine.
 * Chaque événement est une classe immuable (readonly).
 *
 * Convention : constructeur reçoit le contexte complet
 * pour permettre aux handlers de prendre des décisions.
 * ============================================================ */

import { WalletOperationType, BalanceType } from '../types/wallet-engine.types';

/* ============================================================
 * BASE
 * ============================================================ */

/**
 * Données communes à tous les événements wallet.
 */
interface WalletEventBase {
  readonly walletId: string;
  readonly operationType: WalletOperationType;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown> | null;
}

/* ============================================================
 * 1. OPÉRATION RÉUSSIE
 * ============================================================ */

export class WalletOperationSuccessEvent implements WalletEventBase {
  readonly timestamp = new Date();

  constructor(
    public readonly walletId: string,
    public readonly operationType: WalletOperationType,
    public readonly transactionId: string,
    public readonly ledgerEntryId: string,
    public readonly amount: number,
    public readonly balanceType: BalanceType,
    public readonly balanceBefore: number,
    public readonly balanceAfter: number,
    public readonly idempotencyKey: string | null,
    public readonly referenceType: string | null,
    public readonly referenceId: string | null,
    public readonly metadata?: Record<string, unknown> | null,
  ) {}
}

/* ============================================================
 * 2. OPÉRATION ÉCHOUÉE
 * ============================================================ */

export class WalletOperationFailedEvent implements WalletEventBase {
  readonly timestamp = new Date();

  constructor(
    public readonly walletId: string,
    public readonly operationType: WalletOperationType,
    public readonly erreurType: string,
    public readonly erreurMessage: string,
    public readonly idempotencyKey: string | null,
    public readonly metadata?: Record<string, unknown> | null,
  ) {}
}

/* ============================================================
 * 3. WALLET GELÉ
 * ============================================================ */

export class WalletFrozenEvent implements WalletEventBase {
  readonly operationType = WalletOperationType.BLOCK;
  readonly timestamp = new Date();

  constructor(
    public readonly walletId: string,
    public readonly userId: string,
    public readonly motif: string,
    public readonly performedByUserId: string,
    public readonly performedByRole: string,
    public readonly metadata?: Record<string, unknown> | null,
  ) {}
}

/* ============================================================
 * 4. WALLET DÉGELÉ
 * ============================================================ */

export class WalletUnfrozenEvent implements WalletEventBase {
  readonly operationType = WalletOperationType.UNBLOCK;
  readonly timestamp = new Date();

  constructor(
    public readonly walletId: string,
    public readonly userId: string,
    public readonly performedByUserId: string,
    public readonly performedByRole: string,
    public readonly metadata?: Record<string, unknown> | null,
  ) {}
}

/* ============================================================
 * 5. SÉQUESTRE CRÉDITÉ
 * ============================================================ */

export class EscrowCreditedEvent implements WalletEventBase {
  readonly operationType = WalletOperationType.ESCROW_CREDIT;
  readonly timestamp = new Date();

  constructor(
    public readonly walletId: string,
    public readonly amount: number,
    public readonly commandeId: string,
    public readonly transactionId: string,
    public readonly idempotencyKey: string | null,
    public readonly metadata?: Record<string, unknown> | null,
  ) {}
}

/* ============================================================
 * 6. SÉQUESTRE LIBÉRÉ
 * ============================================================ */

export class EscrowReleasedEvent implements WalletEventBase {
  readonly operationType = WalletOperationType.ESCROW_RELEASE;
  readonly timestamp = new Date();

  constructor(
    public readonly walletId: string,
    public readonly amount: number,
    public readonly commandeId: string,
    public readonly transactionId: string,
    public readonly idempotencyKey: string | null,
    public readonly metadata?: Record<string, unknown> | null,
  ) {}
}

/* ============================================================
 * 7. SÉQUESTRE ANNULÉ
 * ============================================================ */

export class EscrowCancelledEvent implements WalletEventBase {
  readonly operationType = WalletOperationType.ESCROW_CANCEL;
  readonly timestamp = new Date();

  constructor(
    public readonly walletId: string,
    public readonly amount: number,
    public readonly commandeId: string,
    public readonly transactionId: string,
    public readonly idempotencyKey: string | null,
    public readonly metadata?: Record<string, unknown> | null,
  ) {}
}

/* ============================================================
 * 8. RETRAIT INITIÉ
 * ============================================================ */

export class WithdrawalInitiatedEvent implements WalletEventBase {
  readonly operationType = WalletOperationType.WITHDRAWAL_INIT;
  readonly timestamp = new Date();

  constructor(
    public readonly walletId: string,
    public readonly userId: string,
    public readonly amount: number,
    public readonly transactionId: string,
    public readonly provider: string,
    public readonly method: string,
    public readonly idempotencyKey: string | null,
    public readonly metadata?: Record<string, unknown> | null,
  ) {}
}

/* ============================================================
 * 9. RETRAIT CONFIRMÉ
 * ============================================================ */

export class WithdrawalConfirmedEvent implements WalletEventBase {
  readonly operationType = WalletOperationType.WITHDRAWAL_CONFIRM;
  readonly timestamp = new Date();

  constructor(
    public readonly walletId: string,
    public readonly userId: string,
    public readonly amount: number,
    public readonly transactionId: string,
    public readonly providerReference: string,
    public readonly metadata?: Record<string, unknown> | null,
  ) {}
}

/* ============================================================
 * 10. RETRAIT ÉCHOUÉ
 * ============================================================ */

export class WithdrawalFailedEvent implements WalletEventBase {
  readonly operationType = WalletOperationType.WITHDRAWAL_FAIL;
  readonly timestamp = new Date();

  constructor(
    public readonly walletId: string,
    public readonly userId: string,
    public readonly amount: number,
    public readonly transactionId: string,
    public readonly failureReason: string,
    public readonly metadata?: Record<string, unknown> | null,
  ) {}
}
