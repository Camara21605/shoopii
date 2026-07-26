/* ============================================================
 * FICHIER : src/database/entities/wallet-ledger-entry.entity.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Grand Livre immuable (Ledger) du système financier Shopi.
 *
 * PRINCIPE COMPTABLE
 * ------------------------------------------------------------
 * Chaque opération financière génère UNE entrée dans ce ledger.
 * Les entrées ne sont JAMAIS modifiées ni supprimées.
 * Une erreur se corrige par une entrée opposée (CORRECTION),
 * jamais en modifiant l'entrée originale.
 *
 * IMMUTABILITÉ
 * ------------------------------------------------------------
 * - Pas de UpdateDateColumn, pas de @Column updatable
 * - Aucun service ne doit appeler .update() sur cette table
 * - `isReversed` est la seule exception : marquage logique
 *   de l'entrée originale lors d'une correction
 *
 * DOUBLE ENTRÉE
 * ------------------------------------------------------------
 * Chaque mouvement entre deux soldes génère deux entrées :
 *   - Débit  (solde source)  → debit > 0, credit = 0
 *   - Crédit (solde cible)   → debit = 0, credit > 0
 *
 * Cela garantit que Σ(debits) = Σ(credits) sur l'ensemble
 * du système (équation comptable fondamentale).
 *
 * PLACEMENT
 * ------------------------------------------------------------
 * src/database/entities/wallet-ledger-entry.entity.ts
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { Wallet } from './wallet.entity';
import { WalletTransaction } from './wallet-transaction.entity';
import { WalletOperationType, BalanceType } from './wallet-transaction.entity';
import { ColumnNumericTransformer } from '../transformers/column-numeric.transformer';

/* ============================================================
 * ENUMS SPÉCIFIQUES AU LEDGER
 * ============================================================ */

/**
 * Direction comptable de l'entrée dans le Grand Livre.
 * Conforme à la terminologie comptable universelle.
 */
export enum LedgerEntryDirection {
  DEBIT  = 'debit',
  CREDIT = 'credit',
}

/**
 * Devise de l'entrée.
 * Miroir de WalletCurrency — dupliqué ici pour l'isoler du wallet.
 */
export enum LedgerCurrency {
  GNF = 'GNF',
  USD = 'USD',
  EUR = 'EUR',
}

/* ============================================================
 * ENTITY
 * ============================================================ */

@Index('IDX_ledger_wallet_id',      ['walletId'])
@Index('IDX_ledger_transaction_id', ['transactionId'])
@Index('IDX_ledger_operation_type', ['operationType'])
@Index('IDX_ledger_balance_type',   ['balanceType'])
@Index('IDX_ledger_created_at',     ['createdAt'])
@Index('IDX_ledger_reference',      ['referenceType', 'referenceId'])
@Index('IDX_ledger_wallet_created', ['walletId', 'createdAt'])

@Entity('wallet_ledger_entries')
export class WalletLedgerEntry {

  /* ==========================================================
   * IDENTIFIANT
   * ========================================================== */

  /**
   * UUID immuable de l'entrée.
   * Généré une seule fois à l'insertion. Jamais modifié.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * RÉFÉRENCE INTERNE
   * ========================================================== */

  /**
   * Code de référence lisible humainement.
   * Format : LED-{YYYYMMDD}-{séquence} ou UUID court.
   * Permet la réconciliation manuelle et l'audit externe.
   */
  @Index('IDX_ledger_reference_code', { unique: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  reference: string | null;

  /* ==========================================================
   * WALLET SOURCE
   * ========================================================== */

  /**
   * Wallet concerné par cette entrée.
   * Une entrée de débit sur le wallet A et une entrée de crédit
   * sur le wallet B sont deux lignes distinctes du ledger.
   */
  @ManyToOne(() => Wallet, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'walletId' })
  wallet: Wallet;

  @Column({ name: 'walletId', type: 'uuid' })
  walletId: string;

  /* ==========================================================
   * TRANSACTION SOURCE
   * ========================================================== */

  /**
   * Transaction à l'origine de cette entrée.
   * Lie le ledger à l'enregistrement de la transaction.
   *
   * RESTRICT : empêche la suppression d'une transaction
   * qui a des entrées de ledger associées.
   */
  @ManyToOne(() => WalletTransaction, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'transactionId' })
  transaction: WalletTransaction | null;

  @Column({ name: 'transactionId', type: 'uuid', nullable: true })
  transactionId: string | null;

  /* ==========================================================
   * SÉMANTIQUE DE L'OPÉRATION
   * ========================================================== */

  /**
   * Type d'opération financière à l'origine de ce mouvement.
   * Identique au WalletOperationType de la WalletTransaction.
   * Dénormalisé ici pour permettre les requêtes ledger autonomes
   * sans JOIN sur wallet_transactions.
   */
  @Column({
    type: 'enum',
    enum: WalletOperationType,
    nullable: true,
  })
  operationType: WalletOperationType | null;

  /**
   * Direction comptable de cette entrée : DEBIT ou CREDIT.
   * Garantit l'équilibre comptable (Σdebits = Σcredits).
   */
  @Column({
    type: 'enum',
    enum: LedgerEntryDirection,
  })
  direction: LedgerEntryDirection;

  /* ==========================================================
   * MONTANTS
   * ========================================================== */

  /**
   * Montant débité (sortie du solde).
   * 0 si cette entrée est un crédit.
   * Toujours positif ou nul.
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  debit: number;

  /**
   * Montant crédité (entrée dans le solde).
   * 0 si cette entrée est un débit.
   * Toujours positif ou nul.
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  credit: number;

  /**
   * Devise de la transaction.
   * Snapshot au moment de l'opération — invariant dans le temps.
   */
  @Column({
    type: 'enum',
    enum: LedgerCurrency,
    default: LedgerCurrency.GNF,
  })
  currency: LedgerCurrency;

  /* ==========================================================
   * SOLDE AFFECTÉ
   * ========================================================== */

  /**
   * Type de solde concerné par cette entrée.
   * Ex : BALANCE, PENDING, BLOCKED, RESERVED, WITHDRAWING.
   */
  @Column({
    type: 'enum',
    enum: BalanceType,
    nullable: true,
  })
  balanceType: BalanceType | null;

  /**
   * Solde du wallet AVANT l'opération (snapshot).
   * Pour le solde indiqué dans `balanceType`.
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  balanceBefore: number;

  /**
   * Solde du wallet APRÈS l'opération (snapshot).
   * Pour le solde indiqué dans `balanceType`.
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  balanceAfter: number;

  /* ==========================================================
   * DESCRIPTION
   * ========================================================== */

  /**
   * Description lisible humainement de l'opération.
   * Générée automatiquement par WalletLedgerService.
   * Ex : "Commission Shopi — Commande #CMD-20240715-0042"
   */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /* ==========================================================
   * RÉFÉRENCE EXTERNE
   * ========================================================== */

  /**
   * Type de l'entité source de cette opération.
   * Ex : 'commande', 'retrait', 'paiement', 'ajustement'
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  referenceType: string | null;

  /**
   * Identifiant de l'entité source.
   * UUID ou identifiant métier.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  referenceId: string | null;

  /* ==========================================================
   * AUDIT / TRAÇABILITÉ
   * ========================================================== */

  /**
   * UUID de l'utilisateur qui a déclenché l'opération.
   * Peut être un user ordinaire, un admin, ou un service automatique.
   */
  @Column({ type: 'uuid', nullable: true })
  performedByUserId: string | null;

  /**
   * Rôle snapshot de l'acteur au moment de l'opération.
   * Ex : 'SUPER_ADMIN', 'SYSTEM', 'SCHEDULER', 'USER'
   * Snapshot pour l'audit : le rôle réel peut changer après.
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  performedByRole: string | null;

  /**
   * Adresse IP de l'acteur (si déclenchée via API).
   * NULL pour les opérations automatisées (schedulers, webhooks internes).
   */
  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  /* ==========================================================
   * CORRECTION / REVERSEMENT
   * ========================================================== */

  /**
   * Indique si cette entrée a été corrigée par une entrée opposée.
   * TRUE = cette entrée est annulée par `reversedByEntryId`.
   *
   * IMPORTANT : Ce champ est la SEULE exception à l'immutabilité.
   * Il est mis à jour par WalletLedgerService lors d'une correction.
   * La valeur passe de false à true, jamais l'inverse.
   */
  @Column({ type: 'boolean', default: false })
  isReversed: boolean;

  /**
   * UUID de l'entrée de correction qui annule celle-ci.
   * NULL si cette entrée n'a pas encore été corrigée.
   * Auto-référence : pointe vers une autre WalletLedgerEntry.
   */
  @Column({ type: 'uuid', nullable: true })
  reversedByEntryId: string | null;

  /* ==========================================================
   * MÉTADONNÉES
   * ========================================================== */

  /**
   * Données contextuelles supplémentaires (JSON libre).
   * Snapshot au moment de l'opération.
   *
   * Exemples :
   *   - ESCROW_CREDIT  : { commandeId, vendeurId, ruleId }
   *   - COMMISSION     : { commissionRuleId, taux, acteur }
   *   - WITHDRAWAL     : { provider, method, providerRef }
   *   - CORRECTION     : { originalEntryId, motif, validatedBy }
   */
  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  /* ==========================================================
   * DATE (IMMUABLE)
   * ========================================================== */

  /**
   * Horodatage de création de l'entrée.
   * IMMUABLE : jamais modifié après insertion.
   * Géré automatiquement par TypeORM.
   */
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
