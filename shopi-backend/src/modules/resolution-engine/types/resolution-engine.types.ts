/* ============================================================
 * FICHIER : src/modules/resolution-engine/types/resolution-engine.types.ts
 *
 * RÔLE    : Types, contextes, erreurs et machine à états
 *           du Resolution Engine.
 * ============================================================ */

import { DisputeStatus, DisputeMotif, DisputeDecision } from '../../../database/entities/paiement/dispute.entity';
import { EvidenceType, EvidenceSubmittedBy }            from '../../../database/entities/paiement/dispute-evidence.entity';

/* ============================================================
 * MACHINE À ÉTATS FORMELLE
 * ============================================================ */

export const DISPUTE_TRANSITIONS: Readonly<
  Record<DisputeStatus, ReadonlyArray<DisputeStatus>>
> = {
  [DisputeStatus.OPEN]:                 [DisputeStatus.UNDER_REVIEW, DisputeStatus.WAITING_FOR_EVIDENCE, DisputeStatus.CLOSED],
  [DisputeStatus.UNDER_REVIEW]:         [DisputeStatus.WAITING_FOR_EVIDENCE, DisputeStatus.DECISION_PENDING, DisputeStatus.CLOSED],
  [DisputeStatus.WAITING_FOR_EVIDENCE]: [DisputeStatus.UNDER_REVIEW, DisputeStatus.DECISION_PENDING, DisputeStatus.CLOSED],
  [DisputeStatus.DECISION_PENDING]:     [DisputeStatus.APPROVED, DisputeStatus.REJECTED],
  [DisputeStatus.APPROVED]:             [DisputeStatus.REFUND_PENDING, DisputeStatus.CLOSED],
  [DisputeStatus.REJECTED]:             [DisputeStatus.CLOSED],
  [DisputeStatus.REFUND_PENDING]:       [DisputeStatus.REFUNDED],
  [DisputeStatus.REFUNDED]:             [DisputeStatus.CLOSED],
  [DisputeStatus.CLOSED]:               [],
  /* legacy */
  [DisputeStatus.RESOLVED_CLIENT]:      [DisputeStatus.CLOSED],
  [DisputeStatus.RESOLVED_SELLER]:      [DisputeStatus.CLOSED],
};

export const DISPUTE_FINAL_STATES: ReadonlySet<DisputeStatus> = new Set([
  DisputeStatus.CLOSED,
]);

/* ============================================================
 * ERREURS
 * ============================================================ */

export enum ResolutionErreurType {
  DISPUTE_INTROUVABLE         = 'DISPUTE_INTROUVABLE',
  COMMANDE_INTROUVABLE        = 'COMMANDE_INTROUVABLE',
  EVIDENCE_INTROUVABLE        = 'EVIDENCE_INTROUVABLE',
  TRANSITION_INVALIDE         = 'TRANSITION_INVALIDE',
  ETAT_FINAL_IRREVOCABLE      = 'ETAT_FINAL_IRREVOCABLE',
  FENETRE_EXPIREE             = 'FENETRE_EXPIREE',
  COMMANDE_NON_LIVREE         = 'COMMANDE_NON_LIVREE',
  DISPUTE_DEJA_ACTIF          = 'DISPUTE_DEJA_ACTIF',
  PERMISSION_REFUSEE          = 'PERMISSION_REFUSEE',
  DECISION_DEJA_RENDUE        = 'DECISION_DEJA_RENDUE',
  MONTANT_INVALIDE            = 'MONTANT_INVALIDE',
  MAX_EVIDENCES_ATTEINT       = 'MAX_EVIDENCES_ATTEINT',
  ESCROW_ERREUR               = 'ESCROW_ERREUR',
  REMBOURSEMENT_ERREUR        = 'REMBOURSEMENT_ERREUR',
  OPERATION_NON_AUTORISEE     = 'OPERATION_NON_AUTORISEE',
}

export class ResolutionErreur extends Error {
  constructor(
    public readonly type:    ResolutionErreurType,
    message:                 string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ResolutionErreur';
  }
}

/* ============================================================
 * CONTEXTES D'ENTRÉE
 * ============================================================ */

export interface OuvertureDisputeContext {
  commandeId:      string;
  clientUserId:    string;
  motif:           DisputeMotif;
  description:     string;
  montantConteste: number;
  savTicketId?:    string;
}

export interface PriseEnChargeContext {
  disputeId:   string;
  adminUserId: string;
  note?:       string;
}

export interface DemandePreuvesContext {
  disputeId:   string;
  adminUserId: string;
  note?:       string;
}

export interface PassageDecisionContext {
  disputeId:   string;
  adminUserId: string;
  note?:       string;
}

export interface EvidenceSubmissionContext {
  disputeId:        string;
  uploadedByUserId: string;
  submittedBy:      EvidenceSubmittedBy;
  type:             EvidenceType;
  url:              string;
  originalFileName?: string;
  fileSizeBytes?:   number;
  description?:     string;
}

export interface EvidenceValidationContext {
  evidenceId:   string;
  adminUserId:  string;
}

export interface DecisionContext {
  disputeId:        string;
  adminUserId:      string;
  decision:         DisputeDecision;
  decisionMotif:    string;
  montantRembourse?: number;
}

export interface RemboursementContext {
  disputeId:   string;
  adminUserId: string;
}

export interface FermetureContext {
  disputeId:   string;
  actorUserId: string;
  actorRole:   'CLIENT' | 'ADMIN' | 'SYSTEM';
  note?:       string;
}

export interface EscaladeContext {
  disputeId:      string;
  adminUserId:    string;
  note?:          string;
}

/* ============================================================
 * RÉSULTATS
 * ============================================================ */

export interface DisputeOuvertureResult {
  disputeId:   string;
  reference:   string;
  commandeId:  string;
  status:      DisputeStatus;
  deadlineAt:  Date;
}

export interface DisputeEvidenceResult {
  evidenceId:  string;
  disputeId:   string;
  type:        EvidenceType;
  url:         string;
}

export interface DisputeDecisionResult {
  disputeId:        string;
  decision:         DisputeDecision;
  montantRembourse: number | null;
  newStatus:        DisputeStatus;
}

export interface DisputeRemboursementResult {
  disputeId:        string;
  montantRembourse: number;
  providerRefundId?: string;
  finalStatus:      DisputeStatus;
}

export interface DisputeListFilter {
  status?:      DisputeStatus;
  commandeId?:  string;
  clientUserId?: string;
  adminUserId?: string;
  fromDate?:    Date;
  toDate?:      Date;
  page?:        number;
  limit?:       number;
}
