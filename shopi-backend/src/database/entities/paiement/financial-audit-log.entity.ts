/* ============================================================
 * FICHIER : src/database/entities/paiement/financial-audit-log.entity.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Journal d'audit financier dédié aux opérations monétaires.
 *
 * DIFFÉRENCE AVEC audit-log.entity.ts (existant)
 * ─────────────────────────────────────────────────────────────
 * Le AuditLog existant trace les actions CRUD des administrateurs
 * (modifications de profils, changements de statuts, etc.).
 *
 * Ce FinancialAuditLog est EXCLUSIVEMENT pour :
 *   - les mouvements d'argent (crédits, débits, escrow, libérations)
 *   - les confirmations de paiement
 *   - les remboursements
 *   - les modifications des règles de commission
 *   - les tentatives de fraude
 *   - les gels/dégels de wallets
 *
 * Il contient des champs financiers supplémentaires :
 *   montant, devise, walletId, commandeId, balanceBefore, balanceAfter
 *
 * PRINCIPE D'IMMUABILITÉ
 * ─────────────────────────────────────────────────────────────
 * Ces enregistrements ne peuvent JAMAIS être modifiés ou supprimés.
 * Ils constituent la piste d'audit légale de la plateforme.
 * Conservation minimale : 5 ans (configurable dans PlatformSettings).
 *
 * ENTITÉS QUI L'UTILISENT
 * ─────────────────────────────────────────────────────────────
 * Toutes les opérations financières créent une entrée :
 *   PaiementWebhookService, PaiementDistributionService,
 *   RetraitService, DisputeService, PaiementRefundService
 *
 * MODULES CONCERNÉS
 * ─────────────────────────────────────────────────────────────
 *  PaiementModule   → créé et lu
 *  AdminModule      → lu pour les rapports
 *  DashboardModule  → lu pour les KPI financiers
 *
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/database/entities/paiement/financial-audit-log.entity.ts
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

import { ColumnNumericTransformer } from '../../transformers/column-numeric.transformer';

/* ============================================================
 * ENUMS
 * ============================================================ */

/**
 * Type d'événement financier.
 * Couvre tout le cycle de vie d'un flux monétaire sur Shopi.
 */
export enum FinancialEventType {
  /* ── Paiements ─────────────────────────────────────────── */
  /** Initiation d'un paiement par le client */
  PAYMENT_INITIATED     = 'payment_initiated',
  /** Confirmation de paiement reçue (webhook provider) */
  PAYMENT_CONFIRMED     = 'payment_confirmed',
  /** Paiement refusé par le provider */
  PAYMENT_FAILED        = 'payment_failed',
  /** Session de paiement expirée */
  PAYMENT_EXPIRED       = 'payment_expired',

  /* ── Escrow ────────────────────────────────────────────── */
  /** Fonds mis en escrow (pendingBalance++) pour un acteur */
  ESCROW_LOCKED         = 'escrow_locked',
  /** Escrow libéré vers balance disponible */
  ESCROW_RELEASED       = 'escrow_released',
  /** Escrow annulé (commande annulée, remboursement) */
  ESCROW_CANCELLED      = 'escrow_cancelled',

  /* ── Remboursements ────────────────────────────────────── */
  /** Remboursement initié par un admin ou automatiquement */
  REFUND_INITIATED      = 'refund_initiated',
  /** Remboursement confirmé par le provider */
  REFUND_CONFIRMED      = 'refund_confirmed',
  /** Remboursement échoué */
  REFUND_FAILED         = 'refund_failed',

  /* ── Retraits ───────────────────────────────────────────── */
  /** Demande de retrait soumise par un acteur */
  WITHDRAWAL_REQUESTED  = 'withdrawal_requested',
  /** Retrait traité et envoyé au provider payout */
  WITHDRAWAL_PROCESSING = 'withdrawal_processing',
  /** Retrait complété (fonds sur mobile money) */
  WITHDRAWAL_COMPLETED  = 'withdrawal_completed',
  /** Retrait échoué */
  WITHDRAWAL_FAILED     = 'withdrawal_failed',

  /* ── Litiges ────────────────────────────────────────────── */
  /** Litige ouvert par le client */
  DISPUTE_OPENED        = 'dispute_opened',
  /** Décision admin prise sur le litige */
  DISPUTE_RESOLVED      = 'dispute_resolved',
  /** Litige clôturé */
  DISPUTE_CLOSED        = 'dispute_closed',

  /* ── Configuration ─────────────────────────────────────── */
  /** Modification des taux de commission */
  COMMISSION_RULE_CHANGED = 'commission_rule_changed',
  /** Modification de PlatformSettings (champs financiers) */
  PLATFORM_SETTINGS_CHANGED = 'platform_settings_changed',

  /* ── Sécurité ──────────────────────────────────────────── */
  /** Tentative de signature webhook invalide */
  WEBHOOK_SIGNATURE_INVALID = 'webhook_signature_invalid',
  /** Gel d'un wallet */
  WALLET_FROZEN         = 'wallet_frozen',
  /** Dégel d'un wallet */
  WALLET_UNFROZEN       = 'wallet_unfrozen',
  /** Double paiement détecté et bloqué */
  DOUBLE_PAYMENT_BLOCKED = 'double_payment_blocked',
  /** Montant webhook incorrect détecté */
  AMOUNT_MISMATCH_DETECTED = 'amount_mismatch_detected',
}

/**
 * Criticité de l'événement.
 * Détermine le niveau d'alerte et la priorité de traitement.
 */
export enum FinancialAuditSeverity {
  /** Opération critique requérant une vérification immédiate */
  CRITICAL = 'critical',
  /** Opération importante à surveiller */
  HIGH     = 'high',
  /** Opération normale, loggée pour traçabilité */
  NORMAL   = 'normal',
}

/* ============================================================
 * ENTITY
 * ============================================================ */

@Index('IDX_fin_audit_event_type', ['eventType'])
@Index('IDX_fin_audit_actor', ['actorUserId'])
@Index('IDX_fin_audit_commande', ['commandeId'])
@Index('IDX_fin_audit_wallet', ['walletId'])
@Index('IDX_fin_audit_severity', ['severity'])
@Index('IDX_fin_audit_created_at', ['createdAt'])

@Entity('financial_audit_logs')
export class FinancialAuditLog {

  /* ==========================================================
   * IDENTIFIANT
   * ========================================================== */

  /** UUID unique de cette entrée d'audit. Immuable. */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * CLASSIFICATION
   * ========================================================== */

  /**
   * Type d'événement financier.
   * Détermine la nature de l'opération tracée.
   */
  @Column({ type: 'enum', enum: FinancialEventType })
  eventType: FinancialEventType;

  /**
   * Niveau de criticité.
   * Utilisé pour filtrer les alertes admin.
   */
  @Column({
    type: 'enum',
    enum: FinancialAuditSeverity,
    default: FinancialAuditSeverity.NORMAL,
  })
  severity: FinancialAuditSeverity;

  /* ==========================================================
   * ACTEUR
   * ========================================================== */

  /**
   * UserId de l'utilisateur qui a déclenché l'événement.
   * NULL si l'action est déclenchée par le système (cron, webhook).
   */
  @Column({ type: 'uuid', nullable: true })
  actorUserId: string | null;

  /**
   * Rôle de l'acteur au moment de l'action.
   * Snapshot pour l'audit (le rôle peut changer après).
   * Ex : 'client', 'admin', 'system', 'super_admin'
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  actorRole: string | null;

  /* ==========================================================
   * CONTEXTE FINANCIER
   * ========================================================== */

  /**
   * Commande concernée par cet événement.
   * NULL si l'événement n'est pas lié à une commande
   * (ex: modification de PlatformSettings).
   */
  @Column({ type: 'uuid', nullable: true })
  commandeId: string | null;

  /**
   * Wallet concerné par cet événement.
   * NULL si l'événement n'implique pas de wallet directement.
   */
  @Column({ type: 'uuid', nullable: true })
  walletId: string | null;

  /**
   * Session de paiement concernée.
   * NULL si l'événement n'est pas lié à un paiement.
   */
  @Column({ type: 'uuid', nullable: true })
  sessionId: string | null;

  /**
   * Distribution concernée.
   * NULL si l'événement ne concerne pas une distribution escrow.
   */
  @Column({ type: 'uuid', nullable: true })
  distributionId: string | null;

  /**
   * Montant impliqué dans l'opération (en GNF ou devise concernée).
   * NULL pour les événements de configuration (non-monétaires).
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  montant: number | null;

  /**
   * Devise de l'opération.
   * Défaut : GNF (Franc Guinéen).
   */
  @Column({ type: 'varchar', length: 5, default: 'GNF' })
  devise: string;

  /* ==========================================================
   * ENTITÉ CONCERNÉE
   * ========================================================== */

  /**
   * Type de l'entité modifiée par cet événement.
   * Ex : 'PaiementSession', 'Wallet', 'PaiementDistribution', 'Retrait'
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  entityType: string | null;

  /**
   * UUID de l'entité modifiée.
   */
  @Column({ type: 'uuid', nullable: true })
  entityId: string | null;

  /* ==========================================================
   * ÉTAT AVANT / APRÈS (pour les changements)
   * ========================================================== */

  /**
   * État de l'entité AVANT l'opération.
   * JSON. Ex : { status: 'INITIATED', balance: 50000 }
   * Permet de reconstruire l'historique exact.
   */
  @Column({ type: 'json', nullable: true })
  before: Record<string, unknown> | null;

  /**
   * État de l'entité APRÈS l'opération.
   * JSON. Ex : { status: 'CONFIRMED', balance: 200000 }
   */
  @Column({ type: 'json', nullable: true })
  after: Record<string, unknown> | null;

  /**
   * Métadonnées complémentaires spécifiques à l'événement.
   * Contenu variable selon l'eventType.
   * Ex pour PAYMENT_CONFIRMED : { providerTxId, webhookId, signatureValid }
   * Ex pour COMMISSION_RULE_CHANGED : { ancienTaux, nouveauTaux, ruleId }
   */
  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  /* ==========================================================
   * TRAÇABILITÉ RÉSEAU
   * ========================================================== */

  /**
   * Adresse IP de l'acteur (si disponible).
   * NULL pour les actions système/cron.
   * Utile pour détecter les accès depuis des IPs suspectes.
   */
  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  /**
   * User-Agent du client HTTP.
   * Permet d'identifier l'application source (mobile, web, API).
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;

  /* ==========================================================
   * DATE (immuable — jamais de UpdateDateColumn)
   * ========================================================== */

  /**
   * Date et heure exactes de l'événement.
   * Immuable — pas d'UpdateDateColumn sur cette entité.
   */
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
