/* ============================================================
 * FICHIER : src/database/entities/paiement/escrow-history.entity.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Journal immuable des transitions d'état d'un séquestre.
 * Une ligne est insérée à chaque changement de statut Escrow.
 *
 * PRINCIPE D'IMMUABILITÉ
 * ------------------------------------------------------------
 * - PAS de @UpdateDateColumn (l'entrée ne change jamais)
 * - Les corrections se font par NOUVELLE entrée annotée
 * - Seul EscrowEngine peut créer ces entrées
 *
 * PLACEMENT
 * ------------------------------------------------------------
 * src/database/entities/paiement/escrow-history.entity.ts
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

import { EscrowStatus, EscrowTrigger } from './escrow.entity';

/* ============================================================
 * ENTITY
 * ============================================================ */

@Index('IDX_escrow_history_escrow_id',   ['escrowId'])
@Index('IDX_escrow_history_commande_id', ['commandeId'])
@Index('IDX_escrow_history_created_at',  ['createdAt'])

@Entity('escrow_histories')
export class EscrowHistory {

  /* ==========================================================
   * IDENTIFIANT
   * ========================================================== */

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * RÉFÉRENCE ESCROW
   * ========================================================== */

  /** UUID de l'Escrow dont on trace la transition. */
  @Column({ type: 'uuid' })
  escrowId: string;

  /** Snapshot du numéro de commande (pour logs sans JOIN). */
  @Column({ type: 'varchar', length: 30 })
  commandeId: string;

  /* ==========================================================
   * TRANSITION D'ÉTAT
   * ========================================================== */

  /**
   * État avant la transition.
   * NULL si c'est la création de l'escrow (pas d'état précédent).
   */
  @Column({
    type: 'enum',
    enum: EscrowStatus,
    nullable: true,
  })
  fromStatus: EscrowStatus | null;

  /** État après la transition. */
  @Column({
    type: 'enum',
    enum: EscrowStatus,
  })
  toStatus: EscrowStatus;

  /* ==========================================================
   * DÉCLENCHEUR
   * ========================================================== */

  /**
   * Qui a déclenché la transition.
   * Catégorie : system, client, auto, admin, webhook, scheduler.
   */
  @Column({
    type: 'enum',
    enum: EscrowTrigger,
    default: EscrowTrigger.SYSTEM,
  })
  triggeredBy: EscrowTrigger;

  /**
   * UUID de l'utilisateur ayant déclenché la transition.
   * NULL pour les transitions système/auto.
   */
  @Column({ type: 'uuid', nullable: true })
  triggeredByUserId: string | null;

  /**
   * Rôle de l'utilisateur ayant déclenché la transition.
   * Exemples : 'client', 'admin', 'super_admin', 'livreur'.
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  triggeredByRole: string | null;

  /* ==========================================================
   * CONTEXTE FINANCIER (snapshot au moment de la transition)
   * ========================================================== */

  /**
   * Montant concerné par cette transition (optionnel).
   * Exemple : montant libéré, montant remboursé.
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  montant: number | null;

  /** Devise au moment de la transition. */
  @Column({ type: 'varchar', length: 5, nullable: true })
  currency: string | null;

  /* ==========================================================
   * NOTE ET METADATA
   * ========================================================== */

  /**
   * Note explicative lisible par un humain.
   * Obligatoire pour les transitions manuelles (admin).
   */
  @Column({ type: 'text', nullable: true })
  note: string | null;

  /**
   * Données contextuelles libres (JSON).
   * Exemples : { walletTransactionId, commissionEntryId, disputeDecision }
   */
  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  /* ==========================================================
   * DATE (immuable — pas d'UpdateDateColumn)
   * ========================================================== */

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
