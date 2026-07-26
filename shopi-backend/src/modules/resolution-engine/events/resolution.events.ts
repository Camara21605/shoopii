/* ============================================================
 * FICHIER : src/modules/resolution-engine/events/resolution.events.ts
 *
 * RÔLE    : 9 classes d'événements typés du Resolution Engine.
 * ============================================================ */

import { DisputeStatus, DisputeDecision, DisputeMotif } from '../../../database/entities/paiement/dispute.entity';

/* ── Noms des événements ───────────────────────────────────── */
export const RESOLUTION_EVENTS = {
  DISPUTE_OPENED:      'resolution.dispute.opened',
  EVIDENCE_SUBMITTED:  'resolution.evidence.submitted',
  EVIDENCE_VALIDATED:  'resolution.evidence.validated',
  DECISION_REQUESTED:  'resolution.decision.requested',
  DECISION_APPROVED:   'resolution.decision.approved',
  DECISION_REJECTED:   'resolution.decision.rejected',
  REFUND_REQUESTED:    'resolution.refund.requested',
  REFUND_COMPLETED:    'resolution.refund.completed',
  RESOLUTION_CLOSED:   'resolution.closed',
} as const;

/* ── Classe de base ────────────────────────────────────────── */
abstract class BaseResolutionEvent {
  readonly occurredAt = new Date();
  constructor(
    public readonly disputeId:  string,
    public readonly commandeId: string,
  ) {}
}

/* ── 1. DisputeOpenedEvent ─────────────────────────────────── */
export class DisputeOpenedEvent extends BaseResolutionEvent {
  constructor(
    disputeId:                      string,
    commandeId:                     string,
    public readonly reference:       string,
    public readonly clientUserId:    string,
    public readonly motif:           DisputeMotif,
    public readonly montantConteste: number,
  ) {
    super(disputeId, commandeId);
  }
}

/* ── 2. EvidenceSubmittedEvent ─────────────────────────────── */
export class EvidenceSubmittedEvent extends BaseResolutionEvent {
  constructor(
    disputeId:                        string,
    commandeId:                       string,
    public readonly evidenceId:        string,
    public readonly uploadedByUserId:  string,
    public readonly evidenceType:      string,
  ) {
    super(disputeId, commandeId);
  }
}

/* ── 3. EvidenceValidatedEvent ─────────────────────────────── */
export class EvidenceValidatedEvent extends BaseResolutionEvent {
  constructor(
    disputeId:                     string,
    commandeId:                    string,
    public readonly evidenceId:     string,
    public readonly adminUserId:    string,
  ) {
    super(disputeId, commandeId);
  }
}

/* ── 4. DecisionRequestedEvent ─────────────────────────────── */
export class DecisionRequestedEvent extends BaseResolutionEvent {
  constructor(
    disputeId:                    string,
    commandeId:                   string,
    public readonly adminUserId:   string,
    public readonly fromStatus:    DisputeStatus,
  ) {
    super(disputeId, commandeId);
  }
}

/* ── 5. DecisionApprovedEvent ──────────────────────────────── */
export class DecisionApprovedEvent extends BaseResolutionEvent {
  constructor(
    disputeId:                        string,
    commandeId:                       string,
    public readonly adminUserId:       string,
    public readonly decision:          DisputeDecision,
    public readonly montantRembourse:  number | null,
    public readonly clientUserId:      string,
  ) {
    super(disputeId, commandeId);
  }
}

/* ── 6. DecisionRejectedEvent ──────────────────────────────── */
export class DecisionRejectedEvent extends BaseResolutionEvent {
  constructor(
    disputeId:                    string,
    commandeId:                   string,
    public readonly adminUserId:   string,
    public readonly decisionMotif: string,
    public readonly clientUserId:  string,
  ) {
    super(disputeId, commandeId);
  }
}

/* ── 7. RefundRequestedEvent ───────────────────────────────── */
export class RefundRequestedEvent extends BaseResolutionEvent {
  constructor(
    disputeId:                       string,
    commandeId:                      string,
    public readonly adminUserId:      string,
    public readonly montantRembourse: number,
  ) {
    super(disputeId, commandeId);
  }
}

/* ── 8. RefundCompletedEvent ───────────────────────────────── */
export class RefundCompletedEvent extends BaseResolutionEvent {
  constructor(
    disputeId:                        string,
    commandeId:                       string,
    public readonly montantRembourse:  number,
    public readonly providerRefundId?: string,
  ) {
    super(disputeId, commandeId);
  }
}

/* ── 9. ResolutionClosedEvent ──────────────────────────────── */
export class ResolutionClosedEvent extends BaseResolutionEvent {
  constructor(
    disputeId:                    string,
    commandeId:                   string,
    public readonly closedByUserId: string | null,
    public readonly finalDecision:  DisputeDecision | null,
  ) {
    super(disputeId, commandeId);
  }
}
