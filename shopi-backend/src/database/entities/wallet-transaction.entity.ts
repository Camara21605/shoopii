/* ============================================================
 * FICHIER : src/database/entities/wallet-transaction.entity.ts
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

import { Wallet } from './wallet.entity';
import { ColumnNumericTransformer } from '../transformers/column-numeric.transformer';

/* ============================================================
 * ENUMS
 * ============================================================ */

export enum TransactionType {
  CREDIT   = 'credit',
  DEBIT    = 'debit',
  REFUND   = 'refund',
  TRANSFER = 'transfer',
}

export enum TransactionStatus {
  PENDING   = 'pending',
  COMPLETED = 'completed',
  FAILED    = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Sémantique métier de la transaction.
 * Complète TransactionType (direction) avec le POURQUOI du mouvement.
 *
 * Exemples :
 *   ESCROW_CREDIT    = commande payée → fonds mis en séquestre
 *   ESCROW_RELEASE   = livraison confirmée → séquestre libéré
 *   WITHDRAWAL       = retrait externe initié
 *   COMMISSION       = commission Shopi créditée
 *   REFUND           = remboursement client
 *   BLOCK            = gel admin sur fraude/litige
 *   UNBLOCK          = dégel après résolution
 *   ADJUSTMENT       = ajustement manuel Super Admin
 *   CORRECTION       = correction comptable (entrée opposée)
 *   TRANSFER_IN/OUT  = virement interne entre wallets
 */
export enum WalletOperationType {
  ESCROW_CREDIT       = 'escrow_credit',
  ESCROW_RELEASE      = 'escrow_release',
  ESCROW_CANCEL       = 'escrow_cancel',
  WITHDRAWAL_INIT     = 'withdrawal_init',
  WITHDRAWAL_CONFIRM  = 'withdrawal_confirm',
  WITHDRAWAL_FAIL     = 'withdrawal_fail',
  DEPOSIT             = 'deposit',
  COMMISSION          = 'commission',
  REFUND              = 'refund',
  BLOCK               = 'block',
  UNBLOCK             = 'unblock',
  RESERVE             = 'reserve',
  RELEASE             = 'release',
  TRANSFER_IN         = 'transfer_in',
  TRANSFER_OUT        = 'transfer_out',
  ADJUSTMENT          = 'adjustment',
  CORRECTION          = 'correction',
  CREATION            = 'creation',
}

/**
 * Type de solde affecté par cette transaction.
 * Permet de savoir quel "pot" a bougé.
 */
export enum BalanceType {
  BALANCE     = 'balance',
  PENDING     = 'pending',
  BLOCKED     = 'blocked',
  RESERVED    = 'reserved',
  WITHDRAWING = 'withdrawing',
}

/* ============================================================
 * INDEXES
 * ============================================================ */

@Index('IDX_wallet_transaction_wallet', ['walletId'])
@Index('IDX_wallet_transaction_wallet_status', ['walletId', 'status'])
@Index('IDX_wallet_transaction_reference', ['referenceType', 'referenceId'])
@Index('IDX_wallet_transaction_created_at', ['createdAt'])
@Index('IDX_wallet_transaction_operation_type', ['operationType'])
@Unique('UQ_wallet_transaction_idempotency', ['idempotencyKey'])

@Entity('wallet_transactions')
export class WalletTransaction {

  /* ==========================================================
   * IDENTIFIANT
   * ========================================================== */

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * WALLET
   * ========================================================== */

  @ManyToOne(() => Wallet, wallet => wallet.transactions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'walletId' })
  wallet: Wallet;

  /**
   * IMPORTANT :
   * On autorise l’insertion directe via walletId
   * pour simplifier les services NestJS.
   */
  @Column({
    name: 'walletId',
    type: 'uuid',
  })
  walletId: string;

  /* ==========================================================
   * TRANSFERTS
   * ========================================================== */

  @Column({
    type: 'uuid',
    nullable: true,
  })
  relatedWalletId: string | null;

  /* ==========================================================
   * TYPE & STATUT
   * ========================================================== */

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  /* ==========================================================
   * MONTANTS
   * ========================================================== */

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  amount: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  balanceBefore: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  balanceAfter: number;

  /* ==========================================================
   * SÉMANTIQUE MÉTIER
   * ========================================================== */

  /**
   * Type d'opération financière précis.
   * Complète `type` (direction) avec la raison du mouvement.
   * NULL pour les transactions créées avant l'introduction de ce champ.
   */
  @Column({
    type: 'enum',
    enum: WalletOperationType,
    nullable: true,
  })
  operationType: WalletOperationType | null;

  /**
   * Solde affecté par cette transaction.
   * Indique quel "pot" de solde a été modifié.
   * NULL pour compatibilité ascendante.
   */
  @Column({
    type: 'enum',
    enum: BalanceType,
    nullable: true,
  })
  balanceType: BalanceType | null;

  /* ==========================================================
   * IDEMPOTENCE
   * ========================================================== */

  /**
   * Clé d'idempotence unique par opération externe.
   *
   * Garantit qu'une même opération (ex: webhook reçu deux fois)
   * ne crée pas deux transactions distinctes.
   *
   * Format recommandé : <source>-<uuid> (ex: "webhook-uuid", "cmd-uuid")
   * NULL pour les opérations internes sans besoin d'idempotence.
   *
   * Contrainte UNIQUE en base — insertion échouera si doublon.
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    unique: true,
  })
  idempotencyKey: string | null;

  /* ==========================================================
   * AUDIT / SÉCURITÉ
   * ========================================================== */

  @Column({
    type: 'uuid',
    nullable: true,
  })
  performedBy: string | null;

  /**
   * Rôle de l'utilisateur ayant effectué l'opération.
   * Snapshot pour l'audit (le rôle peut changer après).
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  performedByRole: string | null;

  /**
   * Justification obligatoire pour les opérations manuelles.
   * (ajustements, corrections, blocages admin)
   */
  @Column({ type: 'text', nullable: true })
  note: string | null;

  /**
   * Adresse IP de l'acteur (si disponible via le contrôleur).
   */
  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  /* ==========================================================
   * DESCRIPTION
   * ========================================================== */

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string | null;

  /* ==========================================================
   * RÉFÉRENCES EXTERNES
   * ========================================================== */

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  referenceId: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  referenceType: string | null;

  /* ==========================================================
   * MÉTADONNÉES
   * ========================================================== */

  /**
   * Données contextuelles supplémentaires (JSON libre).
   *
   * Exemples :
   *   - ESCROW_CREDIT  : { commandeId, sessionId, ruleId }
   *   - WITHDRAWAL     : { provider, providerRef, method }
   *   - CORRECTION     : { originalTransactionId, motif }
   */
  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  /* ==========================================================
   * DATE
   * ========================================================== */

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;
}