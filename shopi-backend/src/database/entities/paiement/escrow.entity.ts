/* ============================================================
 * FICHIER : src/database/entities/paiement/escrow.entity.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Entité maîtresse du séquestre financier Shopi.
 * Représente UN séquestre par commande/paiement.
 *
 * RELATION AVEC LES ENTITÉS EXISTANTES
 * ------------------------------------------------------------
 *
 *   PaiementSession  ─── 1:1 ──► Escrow (session source)
 *   Commande         ─── 1:1 ──► Escrow (commande liée)
 *   Escrow           ─── 1:N ──► PaiementDistribution (par acteur)
 *   Escrow           ─── 1:N ──► EscrowHistory (audit transitions)
 *   Escrow           ─── 0:1 ──► Dispute (si litige ouvert)
 *
 * MACHINE À ÉTATS
 * ------------------------------------------------------------
 *
 *  CREATED
 *    ↓ (webhook paiement confirmé)
 *  FUNDS_RECEIVED
 *    ↓ (wallet pendingBalance crédités via WalletEngine)
 *  LOCKED
 *    ↓ (acteurs intermédiaires validés → code client envoyé)
 *  WAITING_VALIDATION
 *    ↓ (client valide son code OU délai auto dépassé)
 *  RELEASED ✓ — fin normale
 *
 *  WAITING_VALIDATION → DISPUTED (client ouvre un litige)
 *    ↓ (décision admin)
 *  RESOLVED → RELEASED ou REFUND_PENDING
 *
 *  * → REFUND_PENDING → REFUNDED ✓
 *  * → FAILED (erreur système non récupérable)
 *  * → EXPIRED (délai dépassé sans action)
 *
 * PRINCIPE
 * ------------------------------------------------------------
 * L'Escrow Engine ne modifie JAMAIS les wallets directement.
 * Il délègue toujours au WalletEngine via des appels explicites.
 *
 * IDEMPOTENCE
 * ------------------------------------------------------------
 * UQ_escrow_session_id — une seule entrée par session de paiement.
 * UQ_escrow_commande_id — une seule entrée active par commande.
 *
 * PLACEMENT
 * ------------------------------------------------------------
 * src/database/entities/paiement/escrow.entity.ts
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
  VersionColumn,
} from 'typeorm';

import { ColumnNumericTransformer } from '../../transformers/column-numeric.transformer';

/* ============================================================
 * ENUMS
 * ============================================================ */

/**
 * Cycle de vie complet d'un séquestre.
 * Chaque valeur correspond à un état stable.
 * Les transitions sont validées par EscrowValidatorService.
 */
export enum EscrowStatus {
  /**
   * Séquestre créé mais fonds pas encore reçus.
   * Transition vers FUNDS_RECEIVED après webhook paiement.
   */
  CREATED = 'created',

  /**
   * Webhook paiement reçu et vérifié. Montant confirmé.
   * Transition vers LOCKED après crédit WalletEngine.
   */
  FUNDS_RECEIVED = 'funds_received',

  /**
   * Fonds crédités en pendingBalance (WalletEngine.ESCROW_CREDIT).
   * En attente des validations intermédiaires (entreprise, livreur…).
   */
  LOCKED = 'locked',

  /**
   * Tous les acteurs intermédiaires ont validé.
   * Code client envoyé. En attente de la validation client
   * ou du délai automatique (autoValidationAt).
   */
  WAITING_VALIDATION = 'waiting_validation',

  /**
   * Fonds libérés vers les balances disponibles.
   * Commissions calculées et distribuées.
   * État final positif — irrévocable.
   */
  RELEASED = 'released',

  /**
   * Remboursement initié (annulation, litige accepté).
   * En cours de traitement par le provider.
   */
  REFUND_PENDING = 'refund_pending',

  /**
   * Remboursement complété. Client remboursé.
   * État final — irrévocable.
   */
  REFUNDED = 'refunded',

  /**
   * Litige ouvert par le client.
   * Fonds bloqués pendant l'instruction admin.
   * Transition possible vers RESOLVED.
   */
  DISPUTED = 'disputed',

  /**
   * Litige résolu. Décision prise par l'admin.
   * Transition vers RELEASED (rejet litige) ou REFUND_PENDING.
   */
  RESOLVED = 'resolved',

  /**
   * Erreur système non récupérable.
   * Nécessite intervention manuelle du Super Admin.
   */
  FAILED = 'failed',

  /**
   * Délai dépassé sans action (paiement initié mais jamais confirmé).
   * Différent de FAILED : pas d'erreur, juste abandon.
   */
  EXPIRED = 'expired',
}

/**
 * Qui a déclenché la transition ou l'action.
 */
export enum EscrowTrigger {
  SYSTEM    = 'system',
  CLIENT    = 'client',
  AUTO      = 'auto',
  ADMIN     = 'admin',
  WEBHOOK   = 'webhook',
  SCHEDULER = 'scheduler',
}

/* ============================================================
 * ENTITY
 * ============================================================ */

@Index('IDX_escrow_commande_id',  ['commandeId'])
@Index('IDX_escrow_status',       ['status'])
@Index('IDX_escrow_session_id',   ['sessionId'])
@Index('IDX_escrow_created_at',   ['createdAt'])
@Index('IDX_escrow_auto_release', ['autoReleaseAt'])

/* Unicité : une session ne peut générer qu'un escrow */
@Unique('UQ_escrow_session_id', ['sessionId'])

@Entity('escrows')
export class Escrow {

  /* ==========================================================
   * IDENTIFIANT
   * ========================================================== */

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * RÉFÉRENCES COMMANDE / SESSION
   * ========================================================== */

  /**
   * Commande concernée par ce séquestre.
   * FK sans contrainte TypeORM (inter-modules).
   */
  @Column({ type: 'uuid' })
  commandeId: string;

  /**
   * Numéro lisible "CMD-2025-00142" — snapshot immuable.
   * Utile pour les logs sans JOIN.
   */
  @Column({ type: 'varchar', length: 30 })
  commandeNumero: string;

  /**
   * Session de paiement à l'origine de ce séquestre.
   * Contient idempotencyKey, montant confirmé, provider.
   */
  @Column({ type: 'uuid', nullable: true })
  sessionId: string | null;

  /**
   * UserId du client ayant passé la commande.
   * Snapshot pour les remboursements (wallet client).
   */
  @Column({ type: 'uuid' })
  clientUserId: string;

  /**
   * WalletId du client (snapshot pour les remboursements).
   */
  @Column({ type: 'uuid', nullable: true })
  clientWalletId: string | null;

  /* ==========================================================
   * MONTANTS
   * ========================================================== */

  /**
   * Montant total confirmé par le paiement (en devise locale).
   * Snapshot du montant webhook — jamais modifié après FUNDS_RECEIVED.
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  montantTotal: number;

  /**
   * Montant effectivement distribué aux acteurs (après commissions).
   * Calculé par CommissionEngine lors de la création.
   * Peut différer de montantTotal si des frais Shopi sont appliqués.
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  montantDistribue: number;

  /**
   * Montant remboursé au client (partiel ou total).
   * Renseigné lors de REFUND_PENDING / REFUNDED.
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  montantRembourse: number;

  /**
   * Devise de la transaction (snapshot).
   * Par défaut GNF (Franc Guinéen).
   */
  @Column({ type: 'varchar', length: 5, default: 'GNF' })
  currency: string;

  /* ==========================================================
   * STATUT (machine à états)
   * ========================================================== */

  /**
   * État courant du séquestre.
   * Géré exclusivement par EscrowEngine.
   * Ne jamais modifier directement — utiliser EscrowEngine.transition().
   */
  @Column({
    type: 'enum',
    enum: EscrowStatus,
    default: EscrowStatus.CREATED,
  })
  status: EscrowStatus;

  /**
   * Qui a déclenché la dernière transition.
   */
  @Column({
    type: 'enum',
    enum: EscrowTrigger,
    default: EscrowTrigger.SYSTEM,
    nullable: true,
  })
  lastTrigger: EscrowTrigger | null;

  /* ==========================================================
   * DÉLAIS (configurables — lus de PlatformSettings)
   * ========================================================== */

  /**
   * Date limite de validation automatique (auto-release).
   * Calculé : AWAITING_CLIENT + autoValidationDelayDays depuis Commande.
   * Si dépassé sans validation client → statut AUTO_DELIVERED → RELEASED.
   */
  @Column({ type: 'timestamp', nullable: true })
  autoReleaseAt: Date | null;

  /**
   * Date limite pour ouvrir un litige.
   * Calculé : RELEASED + disputeWindowDays (PlatformSettings).
   */
  @Column({ type: 'timestamp', nullable: true })
  disputeDeadlineAt: Date | null;

  /**
   * Date limite de traitement du remboursement.
   * Calculé : REFUND_PENDING + refundProcessingDays (PlatformSettings).
   */
  @Column({ type: 'timestamp', nullable: true })
  refundDeadlineAt: Date | null;

  /* ==========================================================
   * TIMESTAMPS MÉTIER
   * ========================================================== */

  /** Quand les fonds ont été reçus (webhook confirmé). */
  @Column({ type: 'timestamp', nullable: true })
  fundsReceivedAt: Date | null;

  /** Quand les fonds ont été crédités en pendingBalance. */
  @Column({ type: 'timestamp', nullable: true })
  lockedAt: Date | null;

  /** Quand l'escrow est passé en WAITING_VALIDATION. */
  @Column({ type: 'timestamp', nullable: true })
  waitingValidationAt: Date | null;

  /** Quand les fonds ont été libérés (RELEASED). */
  @Column({ type: 'timestamp', nullable: true })
  releasedAt: Date | null;

  /** Quand le remboursement a été initié. */
  @Column({ type: 'timestamp', nullable: true })
  refundInitiatedAt: Date | null;

  /** Quand le remboursement a été complété. */
  @Column({ type: 'timestamp', nullable: true })
  refundedAt: Date | null;

  /** Quand le litige a été ouvert. */
  @Column({ type: 'timestamp', nullable: true })
  disputedAt: Date | null;

  /** Quand le litige a été résolu. */
  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  /* ==========================================================
   * LITIGE
   * ========================================================== */

  /**
   * UUID du Dispute associé si status = DISPUTED.
   * FK sans contrainte TypeORM (module Dispute futur).
   */
  @Column({ type: 'uuid', nullable: true })
  disputeId: string | null;

  /**
   * Décision du litige : 'REMBOURSEMENT_TOTAL' | 'REMBOURSEMENT_PARTIEL'
   *                     | 'REJET' | 'RE_LIVRAISON'
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  disputeDecision: string | null;

  /* ==========================================================
   * RELEASE (qui a libéré)
   * ========================================================== */

  /**
   * Qui a déclenché la libération :
   *   'client'    — client a validé son code
   *   'auto'      — délai autoValidationAt dépassé
   *   'admin'     — décision admin après litige
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  releaseTriggeredBy: string | null;

  /** UUID de l'admin ayant pris la décision (si applicable). */
  @Column({ type: 'uuid', nullable: true })
  adminDecisionUserId: string | null;

  /* ==========================================================
   * ERREUR
   * ========================================================== */

  /** Raison de l'échec si status = FAILED. */
  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  /* ==========================================================
   * MÉTADONNÉES
   * ========================================================== */

  /**
   * Données contextuelles libres (JSON).
   * Exemples : { commissionRuleId, snapshotTaux, provider, nbActeurs }
   */
  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  /* ==========================================================
   * VERSIONNAGE (verrouillage optimiste)
   * ========================================================== */

  /**
   * Compteur de version pour le verrouillage optimiste TypeORM.
   * Protège contre les modifications concurrentes.
   */
  @VersionColumn()
  version: number;

  /* ==========================================================
   * DATES
   * ========================================================== */

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
