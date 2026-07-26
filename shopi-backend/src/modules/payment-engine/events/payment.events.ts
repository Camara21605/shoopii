/* ============================================================
 * FICHIER : src/modules/payment-engine/events/payment.events.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * 11 classes d'événements typés pour le cycle de vie d'un paiement.
 * Émis via PaymentEventBus (EventEmitter Node.js).
 *
 * CONVENTION
 * ------------------------------------------------------------
 * Chaque classe contient les données minimales nécessaires
 * pour que les abonnés puissent agir sans requête DB.
 * ============================================================ */

import { PaiementProvider } from '../../../database/entities/paiement/paiement-session.entity';

/* ============================================================
 * CONSTANTES D'ÉVÉNEMENTS
 * ============================================================ */

export const PAYMENT_EVENTS = {
  INITIATED:          'payment.initiated',
  PENDING:            'payment.pending',
  PROCESSING:         'payment.processing',
  CONFIRMED:          'payment.confirmed',
  FAILED:             'payment.failed',
  CANCELLED:          'payment.cancelled',
  EXPIRED:            'payment.expired',
  REFUND_INITIATED:   'payment.refund_initiated',
  REFUNDED:           'payment.refunded',
  PARTIALLY_REFUNDED: 'payment.partially_refunded',
  DISPUTED:           'payment.disputed',
} as const;

export type PaymentEventName = (typeof PAYMENT_EVENTS)[keyof typeof PAYMENT_EVENTS];

/* ============================================================
 * CLASSES D'ÉVÉNEMENTS
 * ============================================================ */

export class PaymentInitiatedEvent {
  readonly timestamp = new Date();
  constructor(
    public readonly sessionId:     string,
    public readonly commandeId:    string,
    public readonly commandeNumero: string,
    public readonly clientUserId:  string,
    public readonly provider:      PaiementProvider,
    public readonly montant:       number,
  ) {}
}

export class PaymentPendingEvent {
  readonly timestamp = new Date();
  constructor(
    public readonly sessionId:            string,
    public readonly commandeId:           string,
    public readonly provider:             PaiementProvider,
    public readonly providerTransactionId: string | null,
  ) {}
}

export class PaymentProcessingEvent {
  readonly timestamp = new Date();
  constructor(
    public readonly sessionId:  string,
    public readonly commandeId: string,
    public readonly provider:   PaiementProvider,
  ) {}
}

export class PaymentConfirmedEvent {
  readonly timestamp = new Date();
  constructor(
    public readonly sessionId:              string,
    public readonly commandeId:             string,
    public readonly commandeNumero:         string,
    public readonly clientUserId:           string,
    public readonly provider:               PaiementProvider,
    public readonly providerTransactionId:  string,
    public readonly montantConfirme:        number,
    public readonly escrowId:               string,
  ) {}
}

export class PaymentFailedEvent {
  readonly timestamp = new Date();
  constructor(
    public readonly sessionId:   string,
    public readonly commandeId:  string,
    public readonly provider:    PaiementProvider,
    public readonly raison:      string,
  ) {}
}

export class PaymentCancelledEvent {
  readonly timestamp = new Date();
  constructor(
    public readonly sessionId:    string,
    public readonly commandeId:   string,
    public readonly clientUserId: string,
    public readonly raison?:      string,
  ) {}
}

export class PaymentExpiredEvent {
  readonly timestamp = new Date();
  constructor(
    public readonly sessionId:  string,
    public readonly commandeId: string,
    public readonly provider:   PaiementProvider,
    public readonly expiredAt:  Date,
  ) {}
}

export class PaymentRefundInitiatedEvent {
  readonly timestamp = new Date();
  constructor(
    public readonly sessionId:     string,
    public readonly commandeId:    string,
    public readonly montant:       number,
    public readonly partiel:       boolean,
    public readonly adminUserId?:  string,
    public readonly raison?:       string,
  ) {}
}

export class PaymentRefundedEvent {
  readonly timestamp = new Date();
  constructor(
    public readonly sessionId:          string,
    public readonly commandeId:         string,
    public readonly montantRembourse:   number,
    public readonly providerRefundId?:  string,
  ) {}
}

export class PaymentPartiallyRefundedEvent {
  readonly timestamp = new Date();
  constructor(
    public readonly sessionId:         string,
    public readonly commandeId:        string,
    public readonly montantRembourse:  number,
    public readonly montantTotal:      number,
    public readonly providerRefundId?: string,
  ) {}
}

export class PaymentDisputedEvent {
  readonly timestamp = new Date();
  constructor(
    public readonly sessionId:    string,
    public readonly commandeId:   string,
    public readonly clientUserId: string,
    public readonly raison?:      string,
  ) {}
}
