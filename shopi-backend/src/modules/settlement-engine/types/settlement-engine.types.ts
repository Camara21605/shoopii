/* ============================================================
 * FICHIER : src/modules/settlement-engine/types/settlement-engine.types.ts
 *
 * RÔLE    : Types centraux du Settlement & Payout Engine.
 *           Interfaces, enums d'erreurs, constantes.
 *           Aucune dépendance TypeORM — types purs.
 * ============================================================ */

import { RetraitMethode, RetraitStatus } from '../../../database/entities/paiement/retrait.entity';
import { SettlementFrequence }           from '../../../database/entities/paiement/settlement-batch.entity';

export { RetraitMethode, RetraitStatus, SettlementFrequence };

/* ============================================================
 * CONTEXTES
 * ============================================================ */

/** Paramètres pour créer une demande de retrait. */
export interface DemandeRetraitContext {
  walletId: string;
  userId: string;
  montant: number;
  methode: RetraitMethode;
  numeroDestinataire: string;
  nomDestinataire?: string | null;
  note?: string | null;
  performedByUserId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Paramètres pour déclencher l'exécution d'un payout. */
export interface ExecutePayoutContext {
  retraitId: string;
  batchId?: string | null;
  triggeredByUserId?: string | null;
}

/** Données transmises au provider de paiement. */
export interface PayoutContext {
  retraitId: string;
  walletId: string;
  userId: string;
  montant: number;
  montantNet: number;
  frais: number;
  methode: RetraitMethode;
  numeroDestinataire: string;
  nomDestinataire: string | null;
  reference: string;
  /** Clé d'idempotence unique incluant le numéro de tentative. */
  idempotencyKey: string;
  metadata?: Record<string, unknown> | null;
}

/** Résultat retourné par un provider de payout. */
export interface PayoutResult {
  success: boolean;
  providerReference: string | null;
  fraisProvider: number;
  errorMessage: string | null;
  rawResponse?: Record<string, unknown> | null;
}

/** Résultat de la vérification d'éligibilité. */
export interface EligibiliteResult {
  eligible: boolean;
  raison: string | null;
}

/** Paramètres pour créer un settlement batch. */
export interface SettlementBatchContext {
  frequence: SettlementFrequence;
  triggeredByUserId?: string | null;
  methodeFilter?: RetraitMethode[] | null;
}

/** Rapport d'exécution d'un retrait dans un batch. */
export interface BatchRetraitReport {
  retraitId: string;
  reference: string;
  status: 'completed' | 'failed' | 'skipped';
  providerReference: string | null;
  montant: number;
  error?: string | null;
}

/** Résultat public d'une demande de retrait. */
export interface DemandeRetraitResult {
  retraitId: string;
  reference: string;
  montant: number;
  frais: number;
  montantNet: number;
  methode: RetraitMethode;
  status: RetraitStatus;
  autoProcessed: boolean;
  requestedAt: Date;
}

/** Résultat d'un payout individuel. */
export interface PayoutExecutionResult {
  retraitId: string;
  success: boolean;
  providerReference: string | null;
  errorMessage: string | null;
  attempts: number;
  completedAt: Date | null;
}

/* ============================================================
 * ERREURS
 * ============================================================ */

export enum SettlementErreurType {
  WALLET_INTROUVABLE        = 'WALLET_INTROUVABLE',
  RETRAIT_INTROUVABLE       = 'RETRAIT_INTROUVABLE',
  BATCH_INTROUVABLE         = 'BATCH_INTROUVABLE',
  MONTANT_INVALIDE          = 'MONTANT_INVALIDE',
  SOLDE_INSUFFISANT         = 'SOLDE_INSUFFISANT',
  ELIGIBILITE_ECHOUEE       = 'ELIGIBILITE_ECHOUEE',
  RETRAIT_DEJA_EN_COURS     = 'RETRAIT_DEJA_EN_COURS',
  RETRAIT_TERMINAL          = 'RETRAIT_TERMINAL',
  MAX_TENTATIVES_ATTEINT    = 'MAX_TENTATIVES_ATTEINT',
  METHODE_INDISPONIBLE      = 'METHODE_INDISPONIBLE',
  VALIDATION_REQUISE        = 'VALIDATION_REQUISE',
  PROVIDER_INDISPONIBLE     = 'PROVIDER_INDISPONIBLE',
  ANNULATION_IMPOSSIBLE     = 'ANNULATION_IMPOSSIBLE',
  ERREUR_INTERNE            = 'ERREUR_INTERNE',
}

export class SettlementErreur extends Error {
  constructor(
    public readonly type: SettlementErreurType,
    message: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'SettlementErreur';
  }
}

/* ============================================================
 * TRANSITIONS AUTORISÉES
 * ============================================================ */

export const RETRAIT_TRANSITIONS: Readonly<Record<RetraitStatus, ReadonlyArray<RetraitStatus>>> = {
  [RetraitStatus.PENDING]:    [RetraitStatus.PROCESSING, RetraitStatus.CANCELLED],
  [RetraitStatus.PROCESSING]: [RetraitStatus.COMPLETED, RetraitStatus.FAILED],
  [RetraitStatus.COMPLETED]:  [],
  [RetraitStatus.FAILED]:     [RetraitStatus.PENDING],
  [RetraitStatus.CANCELLED]:  [],
};

export const RETRAIT_FINAL_STATUSES = new Set<RetraitStatus>([
  RetraitStatus.COMPLETED,
  RetraitStatus.CANCELLED,
]);
