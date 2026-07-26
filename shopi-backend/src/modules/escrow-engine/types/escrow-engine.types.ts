/* ============================================================
 * FICHIER : src/modules/escrow-engine/types/escrow-engine.types.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Types centraux utilisés par tous les services de l'Escrow Engine.
 * Aucune logique métier ici — uniquement des interfaces, enums,
 * classes d'erreur et helpers de typage.
 * ============================================================ */

import { EscrowStatus, EscrowTrigger } from '../../../database/entities/paiement/escrow.entity';

/* ============================================================
 * ERREURS TYPÉES
 * ============================================================ */

export enum EscrowErreurType {
  ESCROW_INTROUVABLE          = 'ESCROW_INTROUVABLE',
  TRANSITION_INVALIDE         = 'TRANSITION_INVALIDE',
  ETAT_FINAL_IRREVOCABLE      = 'ETAT_FINAL_IRREVOCABLE',
  DOUBLE_RELEASE              = 'DOUBLE_RELEASE',
  DOUBLE_REFUND               = 'DOUBLE_REFUND',
  MONTANT_INVALIDE            = 'MONTANT_INVALIDE',
  MONTANT_INSUFFISANT         = 'MONTANT_INSUFFISANT',
  SESSION_PAIEMENT_INVALIDE   = 'SESSION_PAIEMENT_INVALIDE',
  COMMANDE_INTROUVABLE        = 'COMMANDE_INTROUVABLE',
  LITIGE_NON_RESOLU           = 'LITIGE_NON_RESOLU',
  WALLET_ENGINE_ERREUR        = 'WALLET_ENGINE_ERREUR',
  COMMISSION_ENGINE_ERREUR    = 'COMMISSION_ENGINE_ERREUR',
  OPERATION_NON_AUTORISEE     = 'OPERATION_NON_AUTORISEE',
  DELAI_DEPASSE               = 'DELAI_DEPASSE',
  IDEMPOTENCE                 = 'IDEMPOTENCE',
}

export class EscrowErreur extends Error {
  constructor(
    public readonly type: EscrowErreurType,
    message: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'EscrowErreur';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/* ============================================================
 * CONTEXTES D'OPÉRATION
 * ============================================================ */

/** Contexte de création d'un séquestre */
export interface EscrowCreationContext {
  commandeId:       string;
  commandeNumero:   string;
  sessionId:        string;
  clientUserId:     string;
  clientWalletId:   string;
  montantTotal:     number;
  currency:         string;
  /** Délai avant auto-validation (jours) — lu depuis Commande.autoValidationDelayDays */
  autoValidationDelayDays?: number;
  /** Métadonnées additionnelles (provider, mode paiement…) */
  metadata?:        Record<string, unknown>;
}

/** Contexte de réception des fonds (webhook paiement confirmé) */
export interface EscrowFundsReceivedContext {
  escrowId:         string;
  sessionId:        string;
  montantConfirme:  number;
  provider:         string;
  webhookPayload?:  Record<string, unknown>;
}

/** Contexte de verrouillage des fonds */
export interface EscrowLockContext {
  escrowId:         string;
  triggeredBy:      EscrowTrigger;
  triggeredByUserId?: string;
  note?:            string;
}

/** Contexte pour passer à WAITING_VALIDATION */
export interface EscrowWaitingValidationContext {
  escrowId:         string;
  triggeredBy:      EscrowTrigger;
  triggeredByUserId?: string;
  note?:            string;
}

/** Contexte de libération des fonds */
export interface EscrowReleaseContext {
  escrowId:         string;
  triggeredBy:      EscrowTrigger;
  triggeredByUserId?: string;
  /** 'client' | 'auto' | 'admin' */
  releaseReason:    string;
  note?:            string;
}

/** Contexte de remboursement */
export interface EscrowRefundContext {
  escrowId:         string;
  triggeredBy:      EscrowTrigger;
  triggeredByUserId?: string;
  montantRembourse?: number;
  /** true = remboursement total, false = partiel */
  total:            boolean;
  raison:           string;
  note?:            string;
}

/** Contexte d'ouverture de litige */
export interface EscrowDisputeContext {
  escrowId:         string;
  disputeId:        string;
  triggeredByUserId: string;
  note?:            string;
}

/** Contexte de résolution de litige */
export interface EscrowResolveContext {
  escrowId:         string;
  disputeId:        string;
  decision:         'REMBOURSEMENT_TOTAL' | 'REMBOURSEMENT_PARTIEL' | 'REJET' | 'RE_LIVRAISON';
  montantRembourse?: number;
  adminUserId:      string;
  note:             string;
}

/** Contexte de marquage en erreur */
export interface EscrowFailureContext {
  escrowId:         string;
  failureReason:    string;
  metadata?:        Record<string, unknown>;
}

/* ============================================================
 * RÉSULTATS
 * ============================================================ */

export interface EscrowOperationResult {
  escrowId:         string;
  commandeId:       string;
  fromStatus:       EscrowStatus | null;
  toStatus:         EscrowStatus;
  timestamp:        Date;
  metadata?:        Record<string, unknown>;
}

export interface EscrowReleaseResult extends EscrowOperationResult {
  montantTotal:     number;
  montantDistribue: number;
  nbActeurs:        number;
  walletTransactionIds: string[];
}

export interface EscrowRefundResult extends EscrowOperationResult {
  montantRembourse: number;
  walletTransactionId: string;
}

/* ============================================================
 * TRANSITIONS AUTORISÉES (matrice d'état)
 * ============================================================ */

/**
 * Matrice des transitions autorisées.
 * Clé = état source, valeur = états cibles possibles.
 * Utilisée par EscrowValidatorService.
 */
export const ESCROW_TRANSITIONS: Readonly<Record<EscrowStatus, ReadonlyArray<EscrowStatus>>> = {
  [EscrowStatus.CREATED]:             [EscrowStatus.FUNDS_RECEIVED, EscrowStatus.EXPIRED, EscrowStatus.FAILED],
  [EscrowStatus.FUNDS_RECEIVED]:      [EscrowStatus.LOCKED, EscrowStatus.REFUND_PENDING, EscrowStatus.FAILED],
  [EscrowStatus.LOCKED]:              [EscrowStatus.WAITING_VALIDATION, EscrowStatus.REFUND_PENDING, EscrowStatus.FAILED],
  [EscrowStatus.WAITING_VALIDATION]:  [EscrowStatus.RELEASED, EscrowStatus.REFUND_PENDING, EscrowStatus.DISPUTED, EscrowStatus.FAILED],
  [EscrowStatus.RELEASED]:            [],
  [EscrowStatus.REFUND_PENDING]:      [EscrowStatus.REFUNDED, EscrowStatus.FAILED],
  [EscrowStatus.REFUNDED]:            [],
  [EscrowStatus.DISPUTED]:            [EscrowStatus.RESOLVED, EscrowStatus.FAILED],
  [EscrowStatus.RESOLVED]:            [EscrowStatus.RELEASED, EscrowStatus.REFUND_PENDING],
  [EscrowStatus.FAILED]:              [],
  [EscrowStatus.EXPIRED]:             [],
} as const;

/** États finaux irrévocables — aucune transition possible */
export const ESCROW_ETATS_FINAUX: ReadonlySet<EscrowStatus> = new Set([
  EscrowStatus.RELEASED,
  EscrowStatus.REFUNDED,
  EscrowStatus.FAILED,
  EscrowStatus.EXPIRED,
]);

/* ============================================================
 * PAGINATION
 * ============================================================ */

export interface EscrowFilter {
  commandeId?:   string;
  clientUserId?: string;
  status?:       EscrowStatus;
  dateDebut?:    Date;
  dateFin?:      Date;
  page?:         number;
  limit?:        number;
}

export interface EscrowPage<T> {
  data:     T[];
  total:    number;
  page:     number;
  limit:    number;
  pages:    number;
}
