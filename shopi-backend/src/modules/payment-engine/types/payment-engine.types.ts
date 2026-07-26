/* ============================================================
 * FICHIER : src/modules/payment-engine/types/payment-engine.types.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Types centraux du Payment Engine : machine à états formelle,
 * erreurs typées, interfaces de contexte et de résultat.
 * Aucune logique métier — uniquement des contrats de typage.
 * ============================================================ */

import {
  PaiementSessionStatus,
  PaiementProvider,
  MethodePaiementSession,
} from '../../../database/entities/paiement/paiement-session.entity';

/* ============================================================
 * MACHINE À ÉTATS — SESSION DE PAIEMENT
 * ============================================================ */

/**
 * Matrice des transitions valides entre statuts.
 * Toute transition absente de cette matrice est INTERDITE.
 */
export const PAYMENT_SESSION_TRANSITIONS: Readonly<
  Record<PaiementSessionStatus, ReadonlyArray<PaiementSessionStatus>>
> = {
  [PaiementSessionStatus.INITIATED]: [
    PaiementSessionStatus.PENDING,
    PaiementSessionStatus.PROCESSING,
    PaiementSessionStatus.FAILED,
    PaiementSessionStatus.CANCELLED,
    PaiementSessionStatus.EXPIRED,
  ],
  [PaiementSessionStatus.PENDING]: [
    PaiementSessionStatus.PROCESSING,
    PaiementSessionStatus.CONFIRMED,
    PaiementSessionStatus.FAILED,
    PaiementSessionStatus.CANCELLED,
    PaiementSessionStatus.EXPIRED,
  ],
  [PaiementSessionStatus.PROCESSING]: [
    PaiementSessionStatus.CONFIRMED,
    PaiementSessionStatus.FAILED,
    PaiementSessionStatus.CANCELLED,
  ],
  [PaiementSessionStatus.CONFIRMED]: [
    PaiementSessionStatus.REFUNDED,
    PaiementSessionStatus.PARTIALLY_REFUNDED,
    PaiementSessionStatus.DISPUTED,
  ],
  [PaiementSessionStatus.FAILED]:             [],
  [PaiementSessionStatus.CANCELLED]:          [],
  [PaiementSessionStatus.EXPIRED]:            [],
  [PaiementSessionStatus.REFUNDED]:           [],
  [PaiementSessionStatus.PARTIALLY_REFUNDED]: [
    PaiementSessionStatus.REFUNDED,
    PaiementSessionStatus.DISPUTED,
  ],
  [PaiementSessionStatus.DISPUTED]: [
    PaiementSessionStatus.REFUNDED,
    PaiementSessionStatus.CONFIRMED,
  ],
} as const;

/**
 * États finaux irréversibles — aucune transition n'est possible
 * depuis ces états (la liste des transitions est vide).
 */
export const PAYMENT_SESSION_FINAL_STATES: ReadonlySet<PaiementSessionStatus> = new Set([
  PaiementSessionStatus.FAILED,
  PaiementSessionStatus.CANCELLED,
  PaiementSessionStatus.EXPIRED,
  PaiementSessionStatus.REFUNDED,
]);

/* ============================================================
 * ERREURS TYPÉES
 * ============================================================ */

export enum PaymentErreurType {
  SESSION_INTROUVABLE        = 'SESSION_INTROUVABLE',
  COMMANDE_INTROUVABLE       = 'COMMANDE_INTROUVABLE',
  PROVIDER_INCONNU           = 'PROVIDER_INCONNU',
  PROVIDER_INACTIF           = 'PROVIDER_INACTIF',
  CONFIG_PROVIDER_MANQUANTE  = 'CONFIG_PROVIDER_MANQUANTE',
  TRANSITION_INVALIDE        = 'TRANSITION_INVALIDE',
  ETAT_FINAL_IRREVOCABLE     = 'ETAT_FINAL_IRREVOCABLE',
  MONTANT_INVALIDE           = 'MONTANT_INVALIDE',
  MONTANT_INCORRECT          = 'MONTANT_INCORRECT',
  SIGNATURE_INVALIDE         = 'SIGNATURE_INVALIDE',
  WEBHOOK_REPLAY             = 'WEBHOOK_REPLAY',
  DOUBLE_CONFIRMATION        = 'DOUBLE_CONFIRMATION',
  ESCROW_ERREUR              = 'ESCROW_ERREUR',
  PROVIDER_ERREUR            = 'PROVIDER_ERREUR',
  REMBOURSEMENT_IMPOSSIBLE   = 'REMBOURSEMENT_IMPOSSIBLE',
  IDEMPOTENCE                = 'IDEMPOTENCE',
  OPERATION_NON_AUTORISEE    = 'OPERATION_NON_AUTORISEE',
}

export class PaymentErreur extends Error {
  constructor(
    public readonly type:     PaymentErreurType,
    message:                  string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PaymentErreur';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/* ============================================================
 * CONTEXTES D'OPÉRATION
 * ============================================================ */

/** Contexte d'initiation d'un paiement */
export interface PaymentInitiationContext {
  commandeId:      string;
  commandeNumero:  string;
  clientUserId:    string;
  montant:         number;
  devise:          string;
  provider:        PaiementProvider;
  methode:         MethodePaiementSession;
  phonePaiement?:  string;
  idempotencyKey:  string;
  metadata?:       Record<string, unknown>;
}

/** Contexte de confirmation via webhook */
export interface PaymentConfirmationContext {
  sessionId:              string;
  providerTransactionId:  string;
  montantConfirme:        number;
  idempotencyKey:         string;
  providerName:           string;
  webhookRawBody?:        string;
  webhookEventId?:        string;
}

/** Contexte de remboursement provider */
export interface PaymentRefundContext {
  sessionId:    string;
  montant?:     number;
  raison?:      string;
  adminUserId?: string;
  total?:       boolean;
}

/** Contexte de transition de statut */
export interface PaymentTransitionContext {
  sessionId:     string;
  newStatus:     PaiementSessionStatus;
  raison?:       string;
  actorUserId?:  string;
}

/* ============================================================
 * RÉSULTATS D'OPÉRATION
 * ============================================================ */

export interface PaymentConfirmationResult {
  sessionId:    string;
  commandeId:   string;
  escrowId:     string;
  montant:      number;
  nbDistributions: number;
}

export interface PaymentRefundResult {
  sessionId:           string;
  commandeId:          string;
  montantRembourse:    number;
  partiel:             boolean;
  providerRefundId?:   string;
}

export interface PaymentProviderStats {
  provider:    PaiementProvider;
  isActive:    boolean;
  environment: string;
  totalSessions: number;
  totalConfirmed: number;
  totalFailed: number;
  totalVolume: number;
}

/* ============================================================
 * FILTRES ET PAGINATION
 * ============================================================ */

export interface PaymentSessionFilter {
  commandeId?:  string;
  clientUserId?: string;
  provider?:    PaiementProvider;
  status?:      PaiementSessionStatus;
  dateFrom?:    Date;
  dateTo?:      Date;
}

export interface PaymentSessionPage {
  data:  import('../../../database/entities/paiement/paiement-session.entity').PaiementSession[];
  total: number;
  page:  number;
  limit: number;
}
