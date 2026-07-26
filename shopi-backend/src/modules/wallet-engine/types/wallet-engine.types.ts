/* ============================================================
 * FICHIER : src/modules/wallet-engine/types/wallet-engine.types.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Types centraux du Wallet Engine de Shopi.
 * Utilisés par tous les services du module wallet-engine.
 * Aucune dépendance sur les entités TypeORM — types purs.
 * ============================================================ */

import {
  WalletOperationType,
  BalanceType,
} from '../../../database/entities/wallet-transaction.entity';

import {
  WalletType,
  WalletStatus,
  WalletCurrency,
} from '../../../database/entities/wallet.entity';

/* ============================================================
 * RE-EXPORTS (centralise les imports pour les consumers)
 * ============================================================ */

export { WalletOperationType, BalanceType, WalletType, WalletStatus, WalletCurrency };

/* ============================================================
 * CONTEXTE D'UNE OPÉRATION WALLET
 * ============================================================ */

/**
 * Données requises pour initier n'importe quelle opération wallet.
 * Passé à WalletEngine.executer() et propagé à tous les sous-services.
 */
export interface WalletOperationContext {
  /** Wallet cible de l'opération. */
  walletId: string;

  /** Montant de l'opération (toujours positif). */
  amount: number;

  /** Type sémantique de l'opération. */
  operationType: WalletOperationType;

  /** Solde à débiter (ou crediter, selon operationType). */
  balanceType: BalanceType;

  /** Clé unique anti-doublon. Format : <source>-<uuid>. NULL = pas d'idempotence. */
  idempotencyKey?: string | null;

  /** Wallet cible pour les transferts (TRANSFER_IN / TRANSFER_OUT). */
  targetWalletId?: string | null;

  /** Type de solde cible (pour les transferts inter-soldes). */
  targetBalanceType?: BalanceType | null;

  /** Description lisible humainement (stockée dans la transaction). */
  description?: string | null;

  /** Justification obligatoire pour ajustements/corrections/blocages. */
  note?: string | null;

  /** Type de l'entité source. Ex : 'commande', 'retrait', 'correction'. */
  referenceType?: string | null;

  /** UUID ou identifiant métier de l'entité source. */
  referenceId?: string | null;

  /** UUID de l'utilisateur déclenchant l'opération. */
  performedByUserId?: string | null;

  /** Rôle snapshot de l'acteur. Ex : 'SUPER_ADMIN', 'SYSTEM', 'USER'. */
  performedByRole?: string | null;

  /** IP de l'acteur si disponible via contrôleur. */
  ipAddress?: string | null;

  /** Métadonnées contextuelles libres (stockées dans la transaction + ledger). */
  metadata?: Record<string, unknown> | null;
}

/* ============================================================
 * ÉTAT D'UN WALLET (READ MODEL)
 * ============================================================ */

/**
 * Vue des soldes d'un wallet à un instant T.
 * Renvoyé par WalletEngine.getEtat().
 */
export interface WalletEtat {
  id: string;
  walletType: WalletType;
  userId: string;
  currency: WalletCurrency;
  status: WalletStatus;

  /** Solde principal : argent utilisable immédiatement. */
  balance: number;

  /** Séquestre : en attente de livraison confirmée. */
  pendingBalance: number;

  /** Gelé par admin (fraude, litige). */
  blockedBalance: number;

  /** Réservé pour autorisation en cours. */
  reservedBalance: number;

  /** En transit vers provider externe. */
  withdrawingBalance: number;

  /** Somme de tous les soldes (total théorique du wallet). */
  totalBalance: number;

  version: number;
  lastTransactionAt: Date | null;
  updatedAt: Date;
}

/* ============================================================
 * RÉSULTAT D'UNE OPÉRATION
 * ============================================================ */

/**
 * Résultat retourné par WalletEngine.executer() après succès.
 */
export interface WalletOperationResult {
  /** ID de la WalletTransaction créée. */
  transactionId: string;

  /** ID de l'entrée ledger principale. */
  ledgerEntryId: string;

  /** Snapshot de l'état du wallet après l'opération. */
  walletApres: WalletEtat;

  /** Type de l'opération exécutée. */
  operationType: WalletOperationType;

  /** Montant de l'opération. */
  amount: number;

  /** Solde affecté. */
  balanceType: BalanceType;

  /** Clé d'idempotence utilisée (si fournie). */
  idempotencyKey: string | null;

  /** Horodatage de l'opération. */
  executedAt: Date;
}

/* ============================================================
 * ERREURS WALLET
 * ============================================================ */

/**
 * Types d'erreurs possibles dans le Wallet Engine.
 * Chaque valeur correspond à une situation métier précise.
 */
export enum WalletErreurType {
  /** Wallet introuvable en base. */
  WALLET_INTROUVABLE        = 'WALLET_INTROUVABLE',

  /** Wallet gelé : aucune opération autorisée. */
  WALLET_GELE               = 'WALLET_GELE',

  /** Wallet fermé définitivement. */
  WALLET_FERME              = 'WALLET_FERME',

  /** Montant négatif ou nul fourni. */
  MONTANT_INVALIDE          = 'MONTANT_INVALIDE',

  /** Solde insuffisant pour le débit demandé. */
  SOLDE_INSUFFISANT         = 'SOLDE_INSUFFISANT',

  /** Solde bloqué/réservé insuffisant pour l'opération. */
  SOLDE_SOURCE_INSUFFISANT  = 'SOLDE_SOURCE_INSUFFISANT',

  /** Limite de retrait journalière atteinte. */
  LIMITE_RETRAIT_ATTEINTE   = 'LIMITE_RETRAIT_ATTEINTE',

  /** Clé d'idempotence déjà utilisée — doublon détecté. */
  DOUBLON_IDEMPOTENCY       = 'DOUBLON_IDEMPOTENCY',

  /** Conflit optimiste (version mismatch) — retry requis. */
  CONFLIT_VERSION           = 'CONFLIT_VERSION',

  /** Opération non autorisée pour ce type de wallet. */
  OPERATION_NON_AUTORISEE   = 'OPERATION_NON_AUTORISEE',

  /** Paramètre requis manquant (ex: note manquante pour correction). */
  PARAMETRE_MANQUANT        = 'PARAMETRE_MANQUANT',

  /** Devise incompatible entre les deux wallets (transfert). */
  DEVISE_INCOMPATIBLE       = 'DEVISE_INCOMPATIBLE',

  /** Erreur interne non catégorisée. */
  ERREUR_INTERNE            = 'ERREUR_INTERNE',
}

/**
 * Objet d'erreur structuré levé par le Wallet Engine.
 * Jamais une chaîne brute — toujours un WalletErreur.
 */
export class WalletErreur extends Error {
  constructor(
    public readonly type: WalletErreurType,
    message: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'WalletErreur';
  }
}

/* ============================================================
 * REQUÊTES POUR L'HISTORIQUE
 * ============================================================ */

/**
 * Filtres pour WalletHistoryService.getTransactions().
 */
export interface WalletTransactionFilter {
  walletId: string;
  operationType?: WalletOperationType;
  balanceType?: BalanceType;
  dateDebut?: Date;
  dateFin?: Date;
  montantMin?: number;
  montantMax?: number;
  referenceType?: string;
  referenceId?: string;
  page?: number;
  limite?: number;
}

/**
 * Résultat paginé pour l'historique des transactions.
 */
export interface WalletTransactionPage<T> {
  data: T[];
  total: number;
  page: number;
  limite: number;
  totalPages: number;
}

/* ============================================================
 * TRANSFERT INTERNE
 * ============================================================ */

/**
 * Paramètres d'un virement interne entre deux wallets.
 * Utilisé par WalletMovementService.transfer().
 */
export interface WalletTransferContext {
  sourceWalletId: string;
  targetWalletId: string;
  amount: number;
  currency: WalletCurrency;
  idempotencyKey?: string | null;
  description?: string | null;
  note?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  performedByUserId?: string | null;
  performedByRole?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Résultat d'un transfert interne (deux transactions créées).
 */
export interface WalletTransferResult {
  outTransactionId: string;
  inTransactionId: string;
  outLedgerEntryId: string;
  inLedgerEntryId: string;
  amount: number;
  sourceWalletApres: WalletEtat;
  targetWalletApres: WalletEtat;
  executedAt: Date;
}

/* ============================================================
 * CONSTANTS MÉTIER
 * ============================================================ */

/**
 * Opérations qui DÉBITE le solde principal (balance).
 */
export const OPERATIONS_DEBIT_BALANCE: WalletOperationType[] = [
  WalletOperationType.WITHDRAWAL_INIT,
  WalletOperationType.BLOCK,
  WalletOperationType.RESERVE,
  WalletOperationType.TRANSFER_OUT,
  WalletOperationType.CORRECTION,
];

/**
 * Opérations qui CRÉDITENT le solde principal (balance).
 */
export const OPERATIONS_CREDIT_BALANCE: WalletOperationType[] = [
  WalletOperationType.DEPOSIT,
  WalletOperationType.COMMISSION,
  WalletOperationType.REFUND,
  WalletOperationType.ESCROW_RELEASE,
  WalletOperationType.TRANSFER_IN,
  WalletOperationType.UNBLOCK,
  WalletOperationType.ADJUSTMENT,
  WalletOperationType.WITHDRAWAL_FAIL,
  WalletOperationType.RELEASE,
];

/**
 * Opérations qui nécessitent une `note` obligatoire.
 */
export const OPERATIONS_NOTE_OBLIGATOIRE: WalletOperationType[] = [
  WalletOperationType.ADJUSTMENT,
  WalletOperationType.CORRECTION,
  WalletOperationType.BLOCK,
  WalletOperationType.UNBLOCK,
];

/**
 * Opérations réservées au SUPER_ADMIN.
 */
export const OPERATIONS_SUPER_ADMIN: WalletOperationType[] = [
  WalletOperationType.ADJUSTMENT,
  WalletOperationType.CORRECTION,
  WalletOperationType.BLOCK,
  WalletOperationType.UNBLOCK,
];
