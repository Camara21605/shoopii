/* ============================================================
 * FICHIER : src/database/entities/paiement/paiement-session.entity.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Enregistre chaque tentative de paiement associée à une commande.
 *
 * Une commande peut avoir PLUSIEURS sessions (retentatives,
 * changement de méthode). Seule la session CONFIRMED est celle
 * qui compte pour la comptabilité.
 *
 * ─────────────────────────────────────────────────────────────
 * CYCLE DE VIE D'UNE SESSION
 * ─────────────────────────────────────────────────────────────
 *
 *  INITIATED  → Session créée, client redirigé vers le provider
 *  PENDING    → Provider a reçu la demande, attend la confirmation
 *  CONFIRMED  → Webhook reçu et vérifié, fonds crédités en escrow
 *  FAILED     → Paiement refusé ou abandonné
 *  EXPIRED    → Session trop ancienne, non confirmée
 *  REFUNDED   → Remboursement initié + complété
 *
 * ─────────────────────────────────────────────────────────────
 * IDEMPOTENCE
 * ─────────────────────────────────────────────────────────────
 *
 * `idempotencyKey` : UUID unique par tentative de paiement.
 *   → Empêche la duplication si le webhook est appelé plusieurs fois.
 *   → Stocké sur la session, vérifié avant tout traitement.
 *
 * `providerTransactionId` : ID côté provider (FedaPay, Orange, etc.).
 *   → Permet de réconcilier avec le tableau de bord du provider.
 *
 * ─────────────────────────────────────────────────────────────
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/database/entities/paiement/paiement-session.entity.ts
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { ColumnNumericTransformer } from '../../transformers/column-numeric.transformer';

/* ============================================================
 * ENUMS
 * ============================================================ */

/**
 * Statut du cycle de vie d'une session de paiement.
 */
export enum PaiementSessionStatus {
  /** Session créée, client en route vers la page du provider */
  INITIATED = 'initiated',

  /** Provider a pris en charge la demande (push/USSD envoyé) */
  PENDING   = 'pending',

  /** Traitement en cours côté provider (paiement mobile en attente de saisie PIN) */
  PROCESSING = 'processing',

  /** Paiement confirmé par webhook — état FINAL positif */
  CONFIRMED = 'confirmed',

  /** Paiement échoué ou refusé */
  FAILED    = 'failed',

  /** Session annulée par le client avant confirmation */
  CANCELLED = 'cancelled',

  /** Session expirée (créée il y a >1h sans confirmation) */
  EXPIRED   = 'expired',

  /** Remboursement total effectué */
  REFUNDED  = 'refunded',

  /** Remboursement partiel effectué */
  PARTIALLY_REFUNDED = 'partially_refunded',

  /** Litige ouvert par le client sur ce paiement */
  DISPUTED  = 'disputed',
}

/**
 * Provider de paiement utilisé pour cette session.
 */
export enum PaiementProvider {
  /** Mode interne (développement / staging) — confirmation immédiate simulée */
  INTERNAL     = 'internal',

  /** FedaPay — provider principal pour la Guinée (Orange Money, MTN) */
  FEDAPAY      = 'fedapay',

  /** CinetPay — alternative multi-pays Afrique de l'Ouest */
  CINETPAY     = 'cinetpay',

  /** PayDunya — provider Sénégal/Guinée */
  PAYDUNYA     = 'paydunya',

  /** Wave — transferts instantanés */
  WAVE         = 'wave',
}

/**
 * Méthode de paiement utilisée par le client.
 */
export enum MethodePaiementSession {
  ORANGE_MONEY = 'orange_money',
  MTN_MONEY    = 'mtn_money',
  WAVE         = 'wave',
  CARTE_VISA   = 'carte_visa',
  CARTE_MC     = 'carte_mastercard',
  VIREMENT     = 'virement',
  WALLET       = 'wallet',          // Paiement depuis le wallet interne Shopi
  CASH         = 'cash',
}

/* ============================================================
 * ENTITY
 * ============================================================ */

@Index('IDX_paiement_session_commande',     ['commandeId'])
@Index('IDX_paiement_session_status',       ['status'])
@Index('IDX_paiement_session_idempotency',  ['idempotencyKey'], { unique: true })
@Index('IDX_paiement_session_provider_txn', ['providerTransactionId'])

@Entity('paiement_sessions')
export class PaiementSession {

  /* ==========================================================
   * IDENTIFIANT
   * ========================================================== */

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * COMMANDE
   * ========================================================== */

  /**
   * Commande associée à ce paiement.
   * FK sans contrainte Typeorm (pour éviter les circulaires
   * inter-modules); la cohérence est garantie par le service.
   */
  @Column({ type: 'uuid' })
  commandeId: string;

  /**
   * Référence lisible (snapshot) : "CMD-2025-00142".
   * Utile pour les logs sans avoir à rejoindre la table commandes.
   */
  @Column({ type: 'varchar', length: 30 })
  commandeNumero: string;

  /* ==========================================================
   * MONTANT
   * ========================================================== */

  /**
   * Montant total à payer en GNF (snapshot au moment de l'initiation).
   * Stocké pour pouvoir valider que le webhook confirme le bon montant.
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  montant: number;

  /** Devise (ISO 4217). Défaut : GNF */
  @Column({ type: 'varchar', length: 5, default: 'GNF' })
  devise: string;

  /* ==========================================================
   * PROVIDER
   * ========================================================== */

  /**
   * Provider sélectionné pour cette session.
   * Choisi à l'initiation selon la méthode du client
   * et la config PlatformSettings.
   */
  @Column({ type: 'enum', enum: PaiementProvider })
  provider: PaiementProvider;

  /**
   * Méthode de paiement concrète choisie par le client.
   */
  @Column({ type: 'enum', enum: MethodePaiementSession })
  methode: MethodePaiementSession;

  /* ==========================================================
   * STATUT
   * ========================================================== */

  @Column({
    type: 'enum',
    enum: PaiementSessionStatus,
    default: PaiementSessionStatus.INITIATED,
  })
  status: PaiementSessionStatus;

  /* ==========================================================
   * IDEMPOTENCE & RÉCONCILIATION
   * ========================================================== */

  /**
   * Clé d'idempotence unique (UUID v4) générée à la création.
   * Empêche le double-débit si le webhook arrive plusieurs fois.
   * Format : `{commandeId}_{timestamp}_{random}`.
   */
  @Column({ type: 'varchar', length: 128 })
  idempotencyKey: string;

  /**
   * Identifiant de transaction côté provider (FedaPay transaction_id, etc.).
   * NULL jusqu'à la réponse du provider.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  providerTransactionId: string | null;

  /**
   * URL de redirection vers la page de paiement hébergée du provider.
   * Renvoyée au frontend pour rediriger le client.
   */
  @Column({ type: 'text', nullable: true })
  redirectUrl: string | null;

  /**
   * Code USSD à composer (pour Orange Money sans redirection web).
   * Ex: "*144*1*...#"
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  ussdCode: string | null;

  /* ==========================================================
   * WEBHOOK
   * ========================================================== */

  /**
   * Payload brut du webhook de confirmation (JSON sérialisé).
   * Stocké pour l'audit et le rejeu en cas de problème.
   */
  @Column({ type: 'text', nullable: true })
  webhookPayloadRaw: string | null;

  /**
   * Date de réception du webhook de confirmation.
   */
  @Column({ type: 'timestamp', nullable: true })
  webhookReceivedAt: Date | null;

  /* ==========================================================
   * CLIENT
   * ========================================================== */

  /**
   * UUID du client qui a initié le paiement.
   * Snapshot pour les logs/audit.
   */
  @Column({ type: 'uuid' })
  clientUserId: string;

  /**
   * Numéro de téléphone utilisé pour le paiement mobile.
   * NULL si paiement par carte ou wallet.
   */
  @Column({ type: 'varchar', length: 30, nullable: true })
  phonePaiement: string | null;

  /* ==========================================================
   * RAISON D'ÉCHEC
   * ========================================================== */

  /**
   * Message d'erreur du provider en cas d'échec.
   * Ex: "Solde insuffisant", "Numéro non enregistré".
   */
  @Column({ type: 'text', nullable: true })
  echecRaison: string | null;

  /* ==========================================================
   * DATES
   * ========================================================== */

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  /**
   * Date d'expiration de la session.
   * Si null ou dépassée → session EXPIRED.
   * Par défaut : 1h après la création.
   */
  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  /**
   * Date de confirmation effective du paiement.
   */
  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date | null;
}
