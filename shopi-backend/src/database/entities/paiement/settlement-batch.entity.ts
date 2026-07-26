/* ============================================================
 * FICHIER : src/database/entities/paiement/settlement-batch.entity.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Lot de virements groupés traités en une seule exécution.
 *
 * POURQUOI CETTE ENTITÉ
 * ─────────────────────────────────────────────────────────────
 * Au lieu de traiter chaque retrait individuellement (ce qui génère
 * de nombreuses transactions provider et des frais élevés), Shopi
 * peut regrouper les retraits en batches quotidiens ou hebdomadaires.
 *
 * Chaque SettlementBatch regroupe tous les retraits PENDING éligibles
 * et les traite en une seule passe (ou en appels provider groupés).
 *
 * Avantages :
 *   - Réduction des frais provider (un appel groupé vs N individuels)
 *   - Traçabilité claire des opérations par période
 *   - Facilité de réconciliation comptable
 *   - Possibilité de retry partiel (les échecs sont identifiés)
 *
 * CYCLE DE VIE
 * ─────────────────────────────────────────────────────────────
 * 1. Cron quotidien (ou action manuelle admin) crée le batch (PENDING)
 * 2. Le batch sélectionne tous les retraits PENDING éligibles
 * 3. Pour chaque retrait : appel provider payout (PROCESSING)
 * 4. Résultats collectés → nbCompleted / nbFailed mis à jour
 * 5. Si tout réussi → COMPLETED. Si partiel → PARTIAL. Si tout échoue → FAILED.
 *
 * MODULES CONCERNÉS
 * ─────────────────────────────────────────────────────────────
 *  JobsModule       → cron crée le batch automatiquement
 *  PaiementModule   → service de settlement
 *  AdminModule      → supervision manuelle
 *
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/database/entities/paiement/settlement-batch.entity.ts
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
 * Statut du batch de settlement.
 *
 * Transitions :
 *   PENDING → PROCESSING → COMPLETED (tout réussi)
 *   PENDING → PROCESSING → PARTIAL   (certains ont échoué)
 *   PENDING → PROCESSING → FAILED    (tous ont échoué)
 */
export enum SettlementBatchStatus {
  /** Batch créé, pas encore démarré */
  PENDING    = 'pending',
  /** Traitement en cours */
  PROCESSING = 'processing',
  /** Tous les retraits du batch ont été complétés avec succès */
  COMPLETED  = 'completed',
  /** Certains retraits ont réussi, d'autres ont échoué */
  PARTIAL    = 'partial',
  /** Tous les retraits du batch ont échoué */
  FAILED     = 'failed',
}

/** Fréquence de déclenchement du batch. */
export enum SettlementFrequence {
  /** Traitement manuel déclenché par un admin */
  MANUEL     = 'manuel',
  /** Déclenchement automatique quotidien */
  QUOTIDIEN  = 'quotidien',
  /** Déclenchement automatique hebdomadaire (lundi matin) */
  HEBDOMADAIRE = 'hebdomadaire',
}

/* ============================================================
 * ENTITY
 * ============================================================ */

@Index('IDX_settlement_status', ['status'])
@Index('IDX_settlement_created_at', ['createdAt'])

@Unique('UQ_settlement_reference', ['reference'])

@Entity('settlement_batches')
export class SettlementBatch {

  /* ==========================================================
   * IDENTIFIANT
   * ========================================================== */

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Référence lisible du batch.
   * Format : "BATCH-YYYY-MM-DD-NNN"
   * Ex : "BATCH-2026-07-17-001"
   */
  @Column({ type: 'varchar', length: 30 })
  reference: string;

  /* ==========================================================
   * CONFIGURATION
   * ========================================================== */

  /** Type de déclenchement de ce batch. */
  @Column({
    type: 'enum',
    enum: SettlementFrequence,
    default: SettlementFrequence.QUOTIDIEN,
  })
  frequence: SettlementFrequence;

  /**
   * Provider de paiement utilisé pour les virements sortants.
   * Ex : 'fedapay', 'cinetpay'
   * Un batch utilise un seul provider.
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  provider: string | null;

  /* ==========================================================
   * STATISTIQUES
   * ========================================================== */

  /**
   * Montant total brut de tous les retraits inclus dans ce batch (GNF).
   * = Σ (retrait.montant) pour tous les retraits du batch.
   */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  montantTotal: number;

  /**
   * Total des frais provider prélevés sur ce batch (GNF).
   * = Σ (retrait.frais) pour tous les retraits du batch.
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  fraisTotal: number;

  /** Nombre total de retraits inclus dans ce batch. */
  @Column({ type: 'int', default: 0 })
  nbRetraits: number;

  /** Nombre de retraits traités avec succès. */
  @Column({ type: 'int', default: 0 })
  nbCompleted: number;

  /** Nombre de retraits ayant échoué. */
  @Column({ type: 'int', default: 0 })
  nbFailed: number;

  /* ==========================================================
   * STATUT
   * ========================================================== */

  /** Statut actuel du batch. */
  @Column({
    type: 'enum',
    enum: SettlementBatchStatus,
    default: SettlementBatchStatus.PENDING,
  })
  status: SettlementBatchStatus;

  /* ==========================================================
   * AUDIT
   * ========================================================== */

  /**
   * UserId de l'admin qui a déclenché le batch manuellement.
   * NULL si déclenchement automatique par le cron.
   */
  @Column({ type: 'uuid', nullable: true })
  triggeredByUserId: string | null;

  /**
   * Rapport d'exécution JSON.
   * Contient le détail de chaque retrait traité :
   * { retraitId: uuid, status: 'completed'|'failed', providerRef: string, error?: string }[]
   */
  @Column({ type: 'json', nullable: true })
  executionReport: Record<string, unknown>[] | null;

  /**
   * Message d'erreur global si le batch a complètement échoué.
   */
  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  /* ==========================================================
   * DATES
   * ========================================================== */

  /** Heure de démarrage du traitement. */
  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null;

  /** Heure de fin de traitement (succès ou échec). */
  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
