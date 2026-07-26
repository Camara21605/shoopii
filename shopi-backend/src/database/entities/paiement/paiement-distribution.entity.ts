/* ============================================================
 * FICHIER : src/database/entities/paiement/paiement-distribution.entity.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Enregistre de façon IMMUABLE chaque versement effectué
 * à un acteur (entreprise, livreur, correspondant, plateforme)
 * lors de la livraison confirmée d'une commande.
 *
 * ─────────────────────────────────────────────────────────────
 * POURQUOI UNE TABLE SÉPARÉE
 * ─────────────────────────────────────────────────────────────
 *
 *   1. Auditabilité : chaque paiement est une ligne immuable,
 *      jamais modifiée. Parfait pour les rapports comptables.
 *
 *   2. Idempotence : `commandeId + acteurType` = clé unique.
 *      Empêche le double-paiement si le service est appelé 2×.
 *
 *   3. Traçabilité : lie la distribution à la WalletTransaction
 *      créée dans la table wallet_transactions.
 *
 *   4. Reporting : facilite les rapports mensuels par acteur,
 *      les réconciliations et les exports comptables.
 *
 * ─────────────────────────────────────────────────────────────
 * RELATION AVEC WALLET_TRANSACTIONS
 * ─────────────────────────────────────────────────────────────
 *
 *  Chaque ligne de cette table génère 2 WalletTransaction :
 *
 *   1. ESCROW (PENDING) → créée à la confirmation du paiement
 *      (pendingBalance += montant)
 *
 *   2. RELEASE (COMPLETED) → créée à la livraison confirmée
 *      (pendingBalance -= montant, balance += montant)
 *
 *  Ces deux transactions sont liées par :
 *    referenceType = 'distribution_commande'
 *    referenceId   = paiement-distribution.id
 *
 * ─────────────────────────────────────────────────────────────
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/database/entities/paiement/paiement-distribution.entity.ts
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

import { ColumnNumericTransformer } from '../../transformers/column-numeric.transformer';

/* ============================================================
 * ENUMS
 * ============================================================ */

/**
 * Acteur bénéficiaire du versement.
 */
export enum DistributionActeurType {
  /** Boutique / vendeur — reçoit le net produit */
  ENTREPRISE    = 'entreprise',

  /** Livreur (si commande en mode LIVREUR) — reçoit le net livraison */
  LIVREUR       = 'livreur',

  /** Correspondant / point relais (si mode CORRESPONDANT) */
  CORRESPONDANT = 'correspondant',

  /**
   * @deprecated Utiliser PARTENAIRE_PRODUIT ou PARTENAIRE_LIVRAISON.
   * Conservé pour la compatibilité avec les distributions antérieures.
   */
  PARTENAIRE    = 'partenaire',

  /**
   * @deprecated Utiliser PLATEFORME_PRODUIT ou PLATEFORME_LIVRAISON.
   * Conservé pour la compatibilité avec les distributions antérieures.
   */
  PLATEFORME    = 'plateforme',

  /* ── Moteur 7-acteurs (Phase 4+) ─────────────────────── */

  /** Shopi — part de la commission produit */
  PLATEFORME_PRODUIT    = 'plateforme_produit',

  /** Shopi — part de la commission livraison */
  PLATEFORME_LIVRAISON  = 'plateforme_livraison',

  /** Partenaire de l'entreprise — part de la commission produit */
  PARTENAIRE_PRODUIT    = 'partenaire_produit',

  /** Partenaire du livreur/correspondant — part de la commission livraison */
  PARTENAIRE_LIVRAISON  = 'partenaire_livraison',

  /** Admin du partenaire de l'entreprise — part de la commission produit */
  ADMIN_PRODUIT         = 'admin_produit',

  /** Admin du partenaire du livreur — part de la commission livraison */
  ADMIN_LIVRAISON       = 'admin_livraison',
}

/**
 * Statut de la distribution.
 */
export enum DistributionStatus {
  /**
   * Fonds mis en escrow (pendingBalance).
   * Argent reçu par la plateforme, pas encore versé à l'acteur.
   */
  ESCROW    = 'escrow',

  /**
   * Fonds libérés vers le balance disponible.
   * État final normal après livraison confirmée.
   */
  RELEASED  = 'released',

  /**
   * Distribution annulée (commande annulée avant livraison).
   * Les fonds ont été restitués au client.
   */
  CANCELLED = 'cancelled',

  /**
   * Distribution remboursée (litige résolu en faveur du client).
   */
  REFUNDED  = 'refunded',
}

/* ============================================================
 * ENTITY
 * ============================================================ */

@Index('IDX_distribution_commande',    ['commandeId'])
@Index('IDX_distribution_acteur',      ['acteurUserId'])
@Index('IDX_distribution_status',      ['status'])
@Index('IDX_distribution_created_at',  ['createdAt'])

/** Empêche le double-versement à un acteur pour la même commande */
@Unique('UQ_distribution_commande_acteur_type', ['commandeId', 'acteurType'])

@Entity('paiement_distributions')
export class PaiementDistribution {

  /* ==========================================================
   * IDENTIFIANT
   * ========================================================== */

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * COMMANDE
   * ========================================================== */

  /**
   * Commande source de ce versement.
   * FK sans contrainte TypeORM (inter-modules).
   */
  @Column({ type: 'uuid' })
  commandeId: string;

  /** Numéro lisible "CMD-2025-00142" (snapshot) */
  @Column({ type: 'varchar', length: 30 })
  commandeNumero: string;

  /**
   * ID de la PaiementSession qui a initié le paiement.
   */
  @Column({ type: 'uuid', nullable: true })
  sessionId: string | null;

  /* ==========================================================
   * ACTEUR BÉNÉFICIAIRE
   * ========================================================== */

  /** Type d'acteur qui reçoit ce versement */
  @Column({ type: 'enum', enum: DistributionActeurType })
  acteurType: DistributionActeurType;

  /**
   * UUID du User propriétaire du wallet cible.
   * Pour la PLATEFORME, c'est l'userId du compte Admin principal.
   */
  @Column({ type: 'uuid' })
  acteurUserId: string;

  /** UUID du wallet crédité */
  @Column({ type: 'uuid' })
  walletId: string;

  /** Nom de l'acteur (snapshot pour les rapports) */
  @Column({ type: 'varchar', length: 200 })
  acteurNom: string;

  /* ==========================================================
   * MONTANT & CALCUL
   * ========================================================== */

  /**
   * Montant versé à cet acteur en GNF.
   * Immuable après création.
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  montant: number;

  /**
   * Taux appliqué (commission en %) si acteurType = PLATEFORME.
   * NULL pour les autres acteurs.
   */
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  tauxCommission: number | null;

  /** Montant total de la commande (snapshot pour calcul de contrôle) */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  commandeMontantTotal: number;

  /* ==========================================================
   * WALLET TRANSACTIONS
   * ========================================================== */

  /**
   * UUID de la WalletTransaction ESCROW créée lors de la confirmation.
   * (pendingBalance += montant)
   */
  @Column({ type: 'uuid', nullable: true })
  escrowTransactionId: string | null;

  /**
   * UUID de la WalletTransaction RELEASE créée lors de la livraison.
   * (balance += montant)
   * NULL tant que la livraison n'est pas confirmée.
   */
  @Column({ type: 'uuid', nullable: true })
  releaseTransactionId: string | null;

  /* ==========================================================
   * STATUT
   * ========================================================== */

  @Column({
    type: 'enum',
    enum: DistributionStatus,
    default: DistributionStatus.ESCROW,
  })
  status: DistributionStatus;

  /* ==========================================================
   * DATES
   * ========================================================== */

  /** Date de mise en escrow (à la confirmation du paiement) */
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  /** Date de libération des fonds (à DELIVERED / AUTO_DELIVERED) */
  @Column({ type: 'timestamp', nullable: true })
  releasedAt: Date | null;

  /** Date d'annulation / remboursement */
  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  /* ==========================================================
   * AUDIT
   * ========================================================== */

  /**
   * Raison de l'annulation / remboursement.
   * NULL si status = RELEASED.
   */
  @Column({ type: 'text', nullable: true })
  cancelRaison: string | null;

  /**
   * UserId de l'opérateur qui a déclenché le remboursement.
   * NULL pour les transitions automatiques (DELIVERED, AUTO_DELIVERED).
   */
  @Column({ type: 'uuid', nullable: true })
  actionParUserId: string | null;

  /* ==========================================================
   * HIÉRARCHIE DES COMMISSIONS (snapshots)
   * ========================================================== */

  /**
   * UserId du Partenaire qui a créé le compte de l'acteur bénéficiaire.
   *
   * Snapshot pris au moment de la création de la distribution pour garantir
   * que la hiérarchie reste correcte même si les relations changent ensuite.
   *
   * NULL si :
   *   - l'acteur est Shopi (PLATEFORME)
   *   - l'acteur n'a pas de partenaire associé
   *   - acteurType = PARTENAIRE ou ADMIN (pas de commission upstream)
   */
  @Column({ type: 'uuid', nullable: true })
  partenaireUserId: string | null;

  /**
   * UserId de l'Admin qui a créé le Partenaire de l'acteur bénéficiaire.
   *
   * Snapshot pris au moment de la création.
   * NULL si l'acteur n'a pas d'admin dans sa hiérarchie.
   */
  @Column({ type: 'uuid', nullable: true })
  adminUserId: string | null;

  /**
   * Identifiant de la CommissionRule utilisée pour calculer cette distribution.
   *
   * Permet de retrouver exactement quels taux ont été appliqués,
   * même si PlatformSettings a été modifié depuis.
   *
   * NULL si la distribution a été créée avant le système de versionnage
   * (compatibilité ascendante avec Phase 1).
   */
  @Column({ type: 'uuid', nullable: true })
  commissionRuleId: string | null;

  /**
   * Snapshot JSON complet des taux utilisés pour ce calcul.
   *
   * Stocké en complément de commissionRuleId pour permettre un audit
   * même si la CommissionRule est supprimée (ce qui ne devrait jamais arriver).
   *
   * Structure : {
   *   tauxCommissionProduit: number,
   *   tauxCommissionLivraison: number,
   *   planMultiplier: number,
   *   ratioShopi: number,
   *   ratioPartenaire: number,
   *   ratioAdmin: number,
   *   planEntreprise: string,
   *   calculatedAt: string (ISO date)
   * }
   */
  @Column({ type: 'json', nullable: true })
  snapshotTaux: Record<string, unknown> | null;
}
