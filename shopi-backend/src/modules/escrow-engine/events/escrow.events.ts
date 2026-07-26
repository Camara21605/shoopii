/* ============================================================
 * FICHIER : src/modules/escrow-engine/events/escrow.events.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Classes d'événements émis par l'EscrowEngine.
 * Chaque événement correspond à une transition d'état importante.
 * Consommés par d'autres modules via EscrowEventBus.
 * ============================================================ */

import { EscrowStatus, EscrowTrigger } from '../../../database/entities/paiement/escrow.entity';

/* ============================================================
 * EVENT NOMS (constantes)
 * ============================================================ */

export const ESCROW_EVENTS = {
  CREATED:              'escrow.created',
  FUNDS_RECEIVED:       'escrow.funds_received',
  LOCKED:               'escrow.locked',
  WAITING_VALIDATION:   'escrow.waiting_validation',
  RELEASED:             'escrow.released',
  REFUND_INITIATED:     'escrow.refund_initiated',
  REFUNDED:             'escrow.refunded',
  DISPUTED:             'escrow.disputed',
  RESOLVED:             'escrow.resolved',
  FAILED:               'escrow.failed',
  EXPIRED:              'escrow.expired',
} as const;

/* ============================================================
 * ÉVÉNEMENTS TYPÉS
 * ============================================================ */

export class EscrowCreatedEvent {
  readonly timestamp = new Date();
  constructor(
    public readonly escrowId:       string,
    public readonly commandeId:     string,
    public readonly commandeNumero: string,
    public readonly clientUserId:   string,
    public readonly montantTotal:   number,
    public readonly currency:       string,
  ) {}
}

export class EscrowFundsReceivedEvent {
  readonly timestamp = new Date();
  constructor(
    public readonly escrowId:        string,
    public readonly commandeId:      string,
    public readonly sessionId:       string,
    public readonly montantConfirme: number,
    public readonly provider:        string,
  ) {}
}

export class EscrowLockedEvent {
  readonly timestamp = new Date();
  constructor(
    public readonly escrowId:   string,
    public readonly commandeId: string,
    public readonly trigger:    EscrowTrigger,
  ) {}
}

export class EscrowWaitingValidationEvent {
  readonly timestamp = new Date();
  constructor(
    public readonly escrowId:     string,
    public readonly commandeId:   string,
    public readonly autoReleaseAt: Date | null,
  ) {}
}

export class EscrowReleasedEvent {
  readonly timestamp = new Date();
  constructor(
    public readonly escrowId:         string,
    public readonly commandeId:       string,
    public readonly montantTotal:     number,
    public readonly montantDistribue: number,
    public readonly releaseReason:    string,
    public readonly trigger:          EscrowTrigger,
  ) {}
}

export class EscrowRefundInitiatedEvent {
  readonly timestamp = new Date();
  constructor(
    public readonly escrowId:         string,
    public readonly commandeId:       string,
    public readonly clientUserId:     string,
    public readonly montantRembourse: number,
    public readonly raison:           string,
  ) {}
}

export class EscrowRefundedEvent {
  readonly timestamp = new Date();
  constructor(
    public readonly escrowId:         string,
    public readonly commandeId:       string,
    public readonly clientUserId:     string,
    public readonly montantRembourse: number,
    public readonly walletTransactionId: string,
  ) {}
}

export class EscrowDisputedEvent {
  readonly timestamp = new Date();
  constructor(
    public readonly escrowId:           string,
    public readonly commandeId:         string,
    public readonly disputeId:          string,
    public readonly clientUserId:       string,
    public readonly triggeredByUserId:  string,
  ) {}
}

export class EscrowResolvedEvent {
  readonly timestamp = new Date();
  constructor(
    public readonly escrowId:         string,
    public readonly commandeId:       string,
    public readonly decision:         string,
    public readonly adminUserId:      string,
    public readonly toStatus:         EscrowStatus,
  ) {}
}

export class EscrowFailedEvent {
  readonly timestamp = new Date();
  constructor(
    public readonly escrowId:      string,
    public readonly commandeId:    string,
    public readonly failureReason: string,
    public readonly fromStatus:    EscrowStatus | null,
  ) {}
}

export class EscrowExpiredEvent {
  readonly timestamp = new Date();
  constructor(
    public readonly escrowId:    string,
    public readonly commandeId:  string,
    public readonly expiredAt:   Date,
  ) {}
}
