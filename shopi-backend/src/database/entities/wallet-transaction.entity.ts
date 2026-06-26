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
} from 'typeorm';

import { Wallet } from './wallet.entity';
import { ColumnNumericTransformer } from '../transformers/column-numeric.transformer';

/* ============================================================
 * ENUMS
 * ============================================================ */

export enum TransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
  REFUND = 'refund',
  TRANSFER = 'transfer',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/* ============================================================
 * INDEXES
 * ============================================================ */

@Index('IDX_wallet_transaction_wallet', ['walletId'])

@Index('IDX_wallet_transaction_wallet_status', ['walletId', 'status'])

@Index('IDX_wallet_transaction_reference', ['referenceType', 'referenceId'])

@Index('IDX_wallet_transaction_created_at', ['createdAt'])

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
   * AUDIT / SÉCURITÉ
   * ========================================================== */

  @Column({
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  performedBy: string | null;

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
   * DATE
   * ========================================================== */

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;
}