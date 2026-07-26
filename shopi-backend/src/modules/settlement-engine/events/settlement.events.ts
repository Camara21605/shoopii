/* ============================================================
 * FICHIER : src/modules/settlement-engine/events/settlement.events.ts
 *
 * RÔLE    : Définit les 8 événements du Settlement Engine.
 *           Utilisés par SettlementEventBus (Node.js EventEmitter).
 * ============================================================ */

import { RetraitMethode } from '../types/settlement-engine.types';

/* ── Clés d'événements ──────────────────────────────────── */
export const SETTLEMENT_EVENTS = {
  WITHDRAWAL_REQUESTED:  'settlement.withdrawal.requested',
  WITHDRAWAL_VALIDATED:  'settlement.withdrawal.validated',
  WITHDRAWAL_REJECTED:   'settlement.withdrawal.rejected',
  PAYOUT_STARTED:        'settlement.payout.started',
  PAYOUT_SUCCEEDED:      'settlement.payout.succeeded',
  PAYOUT_FAILED:         'settlement.payout.failed',
  SETTLEMENT_COMPLETED:  'settlement.batch.completed',
  SETTLEMENT_CANCELLED:  'settlement.batch.cancelled',
} as const;

/* ── Événement 1 : retrait demandé ───────────────────────── */
export class WithdrawalRequestedEvent {
  constructor(
    public readonly retraitId: string,
    public readonly walletId: string,
    public readonly userId: string,
    public readonly montant: number,
    public readonly methode: RetraitMethode,
    public readonly reference: string,
    public readonly requestedAt: Date,
  ) {}
}

/* ── Événement 2 : retrait validé (auto ou manuel) ───────── */
export class WithdrawalValidatedEvent {
  constructor(
    public readonly retraitId: string,
    public readonly walletId: string,
    public readonly montant: number,
    public readonly validatedByUserId: string | null,
    public readonly autoValidated: boolean,
    public readonly validatedAt: Date,
  ) {}
}

/* ── Événement 3 : retrait refusé ───────────────────────── */
export class WithdrawalRejectedEvent {
  constructor(
    public readonly retraitId: string,
    public readonly walletId: string,
    public readonly montant: number,
    public readonly rejectedByUserId: string | null,
    public readonly raison: string,
    public readonly rejectedAt: Date,
  ) {}
}

/* ── Événement 4 : payout initié vers le provider ────────── */
export class PayoutStartedEvent {
  constructor(
    public readonly retraitId: string,
    public readonly walletId: string,
    public readonly montant: number,
    public readonly methode: RetraitMethode,
    public readonly batchId: string | null,
    public readonly attempt: number,
    public readonly startedAt: Date,
  ) {}
}

/* ── Événement 5 : payout confirmé par le provider ──────── */
export class PayoutSucceededEvent {
  constructor(
    public readonly retraitId: string,
    public readonly walletId: string,
    public readonly montant: number,
    public readonly providerReference: string,
    public readonly methode: RetraitMethode,
    public readonly completedAt: Date,
  ) {}
}

/* ── Événement 6 : payout échoué ────────────────────────── */
export class PayoutFailedEvent {
  constructor(
    public readonly retraitId: string,
    public readonly walletId: string,
    public readonly montant: number,
    public readonly errorMessage: string,
    public readonly methode: RetraitMethode,
    public readonly attempt: number,
    public readonly failedAt: Date,
  ) {}
}

/* ── Événement 7 : batch complété ───────────────────────── */
export class SettlementCompletedEvent {
  constructor(
    public readonly batchId: string,
    public readonly reference: string,
    public readonly nbRetraits: number,
    public readonly nbCompleted: number,
    public readonly nbFailed: number,
    public readonly montantTotal: number,
    public readonly completedAt: Date,
  ) {}
}

/* ── Événement 8 : batch annulé ─────────────────────────── */
export class SettlementCancelledEvent {
  constructor(
    public readonly batchId: string,
    public readonly reference: string,
    public readonly raison: string,
    public readonly cancelledAt: Date,
  ) {}
}
