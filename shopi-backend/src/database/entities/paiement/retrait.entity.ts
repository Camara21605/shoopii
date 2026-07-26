/* ============================================================
 * FICHIER : src/database/entities/paiement/retrait.entity.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Demande de retrait de fonds du wallet vers un compte mobile money.
 *
 * POURQUOI CETTE ENTITÉ
 * ─────────────────────────────────────────────────────────────
 * Les acteurs (entreprises, livreurs, partenaires, admins) accumulent
 * des fonds dans leur wallet Shopi. Pour utiliser ces fonds, ils
 * doivent effectuer un retrait vers leur compte Orange Money, MTN, etc.
 *
 * Cette entité trace chaque demande de retrait :
 *   1. Requête soumise par l'acteur (PENDING)
 *   2. Virement initié vers le provider (PROCESSING)
 *   3. Fonds reçus sur mobile money (COMPLETED)
 *   4. Ou échec avec raison (FAILED) → retry possible
 *
 * LIEN AVEC SettlementBatch
 * ─────────────────────────────────────────────────────────────
 * Les retraits peuvent être traités individuellement ou regroupés
 * dans un SettlementBatch (virement groupé quotidien/hebdomadaire).
 * batchId est NULL si traitement individuel.
 *
 * RÈGLES MÉTIER
 * ─────────────────────────────────────────────────────────────
 * - Montant >= PlatformSettings.minWithdrawalAmount
 * - Montant <= wallet.balance (vérification au moment du traitement)
 * - Total retraits du jour <= PlatformSettings.dailyWithdrawalLimit
 * - Méthode doit être enregistrée dans wallet.paymentMethods
 * - Wallet doit être ACTIVE (non gelé)
 *
 * EFFET FINANCIER
 * ─────────────────────────────────────────────────────────────
 * Lorsque PROCESSING :
 *   wallet.balance -= montant (débit immédiat)
 *   WalletTransaction DEBIT créée
 *
 * Si FAILED → wallet.balance += montant (annulation du débit)
 *
 * MODULES CONCERNÉS
 * ─────────────────────────────────────────────────────────────
 *  PaiementModule   → création, traitement
 *  JobsModule       → settlement batch automatique
 *  DashboardModule  → historique retraits acteur
 *
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/database/entities/paiement/retrait.entity.ts
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

import { ColumnNumericTransformer } from '../../transformers/column-numeric.transformer';

/* ============================================================
 * ENUMS
 * ============================================================ */

/**
 * Statut du cycle de vie d'un retrait.
 *
 * Transitions autorisées :
 *   PENDING → PROCESSING → COMPLETED (chemin normal)
 *   PENDING → CANCELLED (annulation avant traitement)
 *   PROCESSING → FAILED → PENDING (retry)
 */
export enum RetraitStatus {
  /** Demande soumise, en attente de traitement */
  PENDING    = 'pending',
  /** Virement en cours chez le provider de paiement */
  PROCESSING = 'processing',
  /** Fonds reçus sur le compte mobile money */
  COMPLETED  = 'completed',
  /** Virement échoué (solde insuffisant provider, numéro invalide, etc.) */
  FAILED     = 'failed',
  /** Annulé avant traitement (par l'acteur ou un admin) */
  CANCELLED  = 'cancelled',
}

/** Méthode de retrait utilisée. */
export enum RetraitMethode {
  ORANGE_MONEY    = 'orange_money',
  MTN_MONEY       = 'mtn_money',
  WAVE            = 'wave',
  VIREMENT_BANCAIRE = 'virement_bancaire',
  MOOV_MONEY      = 'moov_money',
  DJOMY           = 'djomy',
}

/* ============================================================
 * ENTITY
 * ============================================================ */

@Index('IDX_retrait_wallet', ['walletId'])
@Index('IDX_retrait_user', ['userId'])
@Index('IDX_retrait_status', ['status'])
@Index('IDX_retrait_batch', ['batchId'])
@Index('IDX_retrait_created_at', ['createdAt'])

@Unique('UQ_retrait_reference', ['reference'])

@Entity('retraits')
export class Retrait {

  /* ==========================================================
   * IDENTIFIANT
   * ========================================================== */

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Référence lisible du retrait.
   * Format : "RET-YYYY-NNNNN"
   * Communiquée à l'acteur pour suivi.
   */
  @Column({ type: 'varchar', length: 25 })
  reference: string;

  /* ==========================================================
   * WALLET & PROPRIÉTAIRE
   * ========================================================== */

  /**
   * Wallet source du retrait.
   * FK sans contrainte TypeORM pour éviter les dépendances circulaires.
   */
  @Column({ type: 'uuid' })
  walletId: string;

  /**
   * UserId de l'acteur qui effectue le retrait.
   * Snapshot pour l'audit (userId = walletId.userId au moment du retrait).
   */
  @Column({ type: 'uuid' })
  userId: string;

  /* ==========================================================
   * MONTANTS
   * ========================================================== */

  /**
   * Montant brut demandé par l'acteur (en GNF).
   * Doit être >= PlatformSettings.minWithdrawalAmount.
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  montant: number;

  /**
   * Frais de transaction prélevés par le provider (en GNF).
   * 0 si Shopi prend en charge les frais.
   * Ces frais sont généralement à la charge de l'acteur.
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  frais: number;

  /**
   * Montant net effectivement reçu par l'acteur sur son mobile money.
   * montantNet = montant - frais
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  montantNet: number;

  /* ==========================================================
   * MÉTHODE & DESTINATION
   * ========================================================== */

  /** Méthode de retrait choisie par l'acteur. */
  @Column({ type: 'enum', enum: RetraitMethode })
  methode: RetraitMethode;

  /**
   * Numéro de compte de destination (téléphone ou IBAN).
   * Doit correspondre à une méthode enregistrée dans wallet.paymentMethods.
   * Stocké tel quel (potentiellement chiffré en production).
   */
  @Column({ type: 'varchar', length: 100 })
  numeroDestinataire: string;

  /**
   * Nom du titulaire du compte de destination (snapshot).
   * Utilisé pour vérification et affichage.
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  nomDestinataire: string | null;

  /* ==========================================================
   * STATUT & SUIVI
   * ========================================================== */

  /** Statut actuel du retrait. */
  @Column({
    type: 'enum',
    enum: RetraitStatus,
    default: RetraitStatus.PENDING,
  })
  status: RetraitStatus;

  /**
   * Référence de la transaction côté provider (FedaPay payout ID).
   * NULL jusqu'à la prise en charge par le provider.
   * Permet de réconcilier avec le tableau de bord FedaPay.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  providerReference: string | null;

  /**
   * Raison de l'échec (message du provider).
   * NULL si status != FAILED.
   * Ex : "Numéro non enregistré sur Orange Money"
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  failureReason: string | null;

  /**
   * Nombre de tentatives effectuées.
   * Incrémenté à chaque retry après FAILED.
   */
  @Column({ type: 'int', default: 1 })
  attempts: number;

  /* ==========================================================
   * LIEN SETTLEMENT BATCH
   * ========================================================== */

  /**
   * UUID du SettlementBatch si ce retrait fait partie d'un virement groupé.
   * NULL si traitement individuel (retrait manuel de l'acteur).
   */
  @Column({ type: 'uuid', nullable: true })
  batchId: string | null;

  /* ==========================================================
   * AUDIT
   * ========================================================== */

  /**
   * UserId de l'opérateur qui a traité ce retrait.
   * NULL si traitement automatique (cron/batch).
   */
  @Column({ type: 'uuid', nullable: true })
  processedByUserId: string | null;

  /**
   * Notes internes (admin).
   * Non visibles par l'acteur.
   */
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /**
   * UUID de la WalletTransaction DEBIT créée lors du traitement.
   * Lien pour retrouver l'impact sur le wallet.
   */
  @Column({ type: 'uuid', nullable: true })
  walletTransactionId: string | null;

  /* ==========================================================
   * DATES
   * ========================================================== */

  /** Date de la demande initiale. */
  @CreateDateColumn({ type: 'timestamp' })
  requestedAt: Date;

  /** Date de début de traitement (passage à PROCESSING). */
  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date | null;

  /** Date de confirmation finale (COMPLETED ou FAILED définitif). */
  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
