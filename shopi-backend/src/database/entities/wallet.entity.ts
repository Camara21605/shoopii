/* ============================================================
 * FICHIER : src/database/entities/wallet.entity.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Portefeuille électronique principal de Shopi.
 *
 * Chaque utilisateur possède UN wallet unique permettant :
 *
 *   - réception d’argent
 *   - paiements
 *   - remboursements
 *   - commissions
 *   - retraits
 *   - transferts internes
 *
 * ------------------------------------------------------------
 * ARCHITECTURE
 * ------------------------------------------------------------
 *
 * Le wallet est lié au User (et non au profil).
 *
 * Cela permet :
 *
 *   ✅ multi-rôles
 *   ✅ changement de rôle
 *   ✅ système financier centralisé
 *   ✅ compatibilité marketplace
 *   ✅ compatibilité fintech
 *
 * ------------------------------------------------------------
 * SÉCURITÉ
 * ------------------------------------------------------------
 *
 * IMPORTANT :
 *
 * Le solde NE DOIT JAMAIS être modifié directement.
 *
 * Toute opération financière doit :
 *
 *   1. créer une WalletTransaction
 *   2. recalculer les soldes
 *   3. être exécutée dans une transaction SQL
 *
 * ------------------------------------------------------------
 * PERFORMANCE
 * ------------------------------------------------------------
 *
 * Le champ balance est DÉNORMALISÉ.
 *
 * Le vrai historique comptable est stocké dans :
 *
 *   wallet_transactions
 *
 * balance agit comme :
 *
 *   → cache haute performance
 *
 * ------------------------------------------------------------
 * PLACEMENT
 * ------------------------------------------------------------
 *
 * src/database/entities/wallet.entity.ts
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { User } from './user.entity';
import { WalletTransaction } from './wallet-transaction.entity';
import { ColumnNumericTransformer } from '../transformers/column-numeric.transformer';

/* ============================================================
 * TRANSFORMER NUMÉRIQUE
 * ============================================================ */

/**
 * PostgreSQL retourne souvent les colonnes DECIMAL
 * sous forme de string.
 *
 * Ce transformer convertit automatiquement :
 *
 *   DB → number
 *   number → DB
 */


/* ============================================================
 * ENUMS
 * ============================================================ */

/**
 * ------------------------------------------------------------
 * STATUT DU WALLET
 * ------------------------------------------------------------
 */
export enum WalletStatus {

  /**
   * Wallet actif.
   * Toutes les opérations sont autorisées.
   */
  ACTIVE = 'active',

  /**
   * Wallet gelé.
   * Aucune transaction autorisée.
   */
  FROZEN = 'frozen',

  /**
   * Wallet définitivement fermé.
   */
  CLOSED = 'closed',
}

/**
 * ------------------------------------------------------------
 * DEVISES SUPPORTÉES
 * ------------------------------------------------------------
 *
 * Prévu pour évolution future multi-devises.
 */
export enum WalletCurrency {
  GNF = 'GNF',
  USD = 'USD',
  EUR = 'EUR',
}

/**
 * ------------------------------------------------------------
 * TYPES DE MÉTHODES DE PAIEMENT
 * ------------------------------------------------------------
 */
export enum WalletPaymentMethodType {
  ORANGE_MONEY = 'orange_money',
  MTN_MONEY    = 'mtn_money',
  CARD         = 'card',
  BANK         = 'bank',
  CASH         = 'cash',
}

/**
 * Une méthode de paiement/retrait enregistrée par l'utilisateur.
 * Stockée en JSON dans `Wallet.paymentMethods`.
 */
export interface WalletPaymentMethod {
  id: string;
  type: WalletPaymentMethodType;
  label: string;
  number: string;
  isDefault: boolean;
}

/* ============================================================
 * ENTITY
 * ============================================================ */

/**
 * ------------------------------------------------------------
 * INDEXES
 * ------------------------------------------------------------
 */

@Index('IDX_wallet_status', ['status'])

@Index('IDX_wallet_currency', ['currency'])

@Entity('wallets')
export class Wallet {

  /* ==========================================================
   * IDENTIFIANT
   * ========================================================== */

  /**
   * UUID unique du wallet.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * PROPRIÉTAIRE
   * ========================================================== */

  /**
   * ----------------------------------------------------------
   * UTILISATEUR PROPRIÉTAIRE
   * ----------------------------------------------------------
   *
   * Un utilisateur possède un seul wallet.
   */
  @OneToOne(() => User, user => user.wallet, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  /**
   * ----------------------------------------------------------
   * UUID DU USER
   * ----------------------------------------------------------
   */
  @Index({ unique: true })
  @Column({
    name: 'userId',
    type: 'uuid',
    update: false,
  })
  userId: string;

  /* ==========================================================
   * SOLDES
   * ========================================================== */

  /**
   * ----------------------------------------------------------
   * SOLDE DISPONIBLE
   * ----------------------------------------------------------
   *
   * Argent réellement utilisable immédiatement.
   *
   * IMPORTANT :
   * Ne jamais modifier directement.
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  balance: number;

  /**
   * ----------------------------------------------------------
   * SOLDE EN ATTENTE
   * ----------------------------------------------------------
   *
   * Argent temporairement bloqué :
   *
   *   - paiement en cours
   *   - vérification anti-fraude
   *   - commande non validée
   *   - litige
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  pendingBalance: number;

  /* ==========================================================
   * DEVISE
   * ========================================================== */

  /**
   * ----------------------------------------------------------
   * DEVISE PRINCIPALE
   * ----------------------------------------------------------
   */
  @Column({
    type: 'enum',
    enum: WalletCurrency,
    default: WalletCurrency.GNF,
  })
  currency: WalletCurrency;

  /* ==========================================================
   * STATUT
   * ========================================================== */

  /**
   * ----------------------------------------------------------
   * ÉTAT ACTUEL DU WALLET
   * ----------------------------------------------------------
   */
  @Column({
    type: 'enum',
    enum: WalletStatus,
    default: WalletStatus.ACTIVE,
  })
  status: WalletStatus;

  /**
   * ----------------------------------------------------------
   * RAISON DU GEL
   * ----------------------------------------------------------
   *
   * Rempli uniquement si :
   *
   * status = FROZEN
   */
  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  freezeReason: string | null;

  /* ==========================================================
   * LIMITES DE SÉCURITÉ
   * ========================================================== */

  /**
   * ----------------------------------------------------------
   * LIMITE DE RETRAIT JOURNALIÈRE
   * ----------------------------------------------------------
   *
   * 0 = aucune limite
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  dailyWithdrawLimit: number;

  /**
   * ----------------------------------------------------------
   * TOTAL RETIRÉ AUJOURD’HUI
   * ----------------------------------------------------------
   *
   * Réinitialisé chaque jour par CRON.
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  todayWithdrawAmount: number;

  /* ==========================================================
   * STATISTIQUES
   * ========================================================== */

  /**
   * ----------------------------------------------------------
   * TOTAL DES CRÉDITS REÇUS
   * ----------------------------------------------------------
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  totalCredited: number;

  /**
   * ----------------------------------------------------------
   * TOTAL DES DÉBITS EFFECTUÉS
   * ----------------------------------------------------------
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  totalDebited: number;

  /* ==========================================================
   * TRANSACTIONS
   * ========================================================== */

  /**
   * ----------------------------------------------------------
   * HISTORIQUE DES TRANSACTIONS
   * ----------------------------------------------------------
   *
   * IMPORTANT :
   * Pas de cascade en finance.
   *
   * Les transactions doivent rester IMMUTABLES.
   */
  @OneToMany(
    () => WalletTransaction,
    transaction => transaction.wallet,
  )
  transactions: WalletTransaction[];
  @Column({ type: 'boolean', default: false })
  isLocked: boolean;

  /* ==========================================================
   * MÉTHODES DE PAIEMENT
   * ========================================================== */

  /**
   * Liste des moyens de paiement/retrait de l'utilisateur
   * (Orange Money, MTN Money, carte, banque, cash...).
   */
  @Column({ type: 'json', nullable: true })
  paymentMethods: WalletPaymentMethod[] | null;

  /* ==========================================================
   * VIREMENT AUTOMATIQUE
   * ========================================================== */

  /** Virement automatique activé. */
  @Column({ type: 'boolean', default: false })
  autoTransferEnabled: boolean;

  /** Référence l'`id` d'une entrée de `paymentMethods`. */
  @Column({ type: 'varchar', length: 36, nullable: true })
  autoTransferMethodId: string | null;

  /* ==========================================================
   * DATES
   * ========================================================== */

  /**
   * Date de création du wallet.
   */
  @CreateDateColumn({
    type: 'timestamp',
  })
  createdAt: Date;

  /**
   * Dernière modification du wallet.
   */
  @UpdateDateColumn({
    type: 'timestamp',
  })
  updatedAt: Date;
}