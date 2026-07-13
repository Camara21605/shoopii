/* ============================================================
 * FICHIER : src/modules/delivery-settings/delivery-settings.entity.ts
 *
 * RÔLE    : Configuration singleton du moteur de gestion des livreurs.
 *           Zones, assignation, score, bonus, sanctions, véhicules.
 *
 * Pattern singleton : id = 1 toujours (une seule ligne en DB).
 *   JSON columns pour configs évolutives sans migration.
 *   Toutes les colonnes ont un default → synchronize sans migration.
 * ============================================================ */

import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/* ── Interfaces stockées en JSON ────────────────────────────── */

export interface BonusRule {
  id:                 string;
  label:              string;
  type:               'daily' | 'weekly' | 'monthly';
  deliveriesRequired: number;
  bonusAmount:        number;
  enabled:            boolean;
}

export interface PenaltyRule {
  id:        string;
  trigger:   string;
  threshold: number;
  action:    'warning' | 'score_reduction' | 'suspend_temp' | 'suspend_perm';
  value:     number;
  enabled:   boolean;
}

export interface VehicleRule {
  type:          string;
  icon:          string;
  label:         string;
  maxWeightKg:   number;
  maxDistanceKm: number;
  enabled:       boolean;
}

/* ══════════════════════════════════════════════════════════ */

@Entity('delivery_settings')
export class DeliverySetting {

  @PrimaryColumn({ type: 'int', default: 1 })
  id!: number;

  /* ── Assignation ─────────────────────────────────────────── */

  /**
   * Stratégie : 'nearest' | 'best_score' | 'best_availability' | 'best_rating'
   * Utilisée par le moteur d'assignation des commandes.
   */
  @Column({ type: 'varchar', length: 30, default: 'nearest' })
  assignmentStrategy!: string;

  @Column({ type: 'boolean', default: true })
  autoAssignEnabled!: boolean;

  /** Délai avant réassignation automatique si le livreur n'accepte pas */
  @Column({ type: 'int', default: 3 })
  acceptDeadlineMin!: number;

  @Column({ type: 'int', default: 5 })
  maxSimultaneousOrders!: number;

  @Column({ type: 'int', default: 10 })
  reassignTimeoutMin!: number;

  /* ── Zones & Distances ───────────────────────────────────── */

  @Column({ type: 'int', default: 15 })
  maxRadiusKm!: number;

  @Column({ type: 'int', default: 30 })
  maxDeliveryDistanceKm!: number;

  /* ── Score ───────────────────────────────────────────────── */

  /** Score minimal pour recevoir de nouvelles commandes */
  @Column({ type: 'int', default: 60 })
  minScore!: number;

  /** Score en dessous duquel la suspension automatique se déclenche */
  @Column({ type: 'int', default: 40 })
  suspensionScoreThreshold!: number;

  /** Score requis pour réactivation après suspension */
  @Column({ type: 'int', default: 55 })
  reactivationScoreThreshold!: number;

  /** Pondérations du calcul de score (JSON) — somme normalisée à 100 */
  @Column({ type: 'json', nullable: true, default: null })
  scoreWeights!: Record<string, number> | null;

  /* ── Bonus ───────────────────────────────────────────────── */

  @Column({ type: 'boolean', default: true })
  bonusProgramEnabled!: boolean;

  @Column({ type: 'json', nullable: true, default: null })
  bonusRules!: BonusRule[] | null;

  /* ── Pénalités ───────────────────────────────────────────── */

  @Column({ type: 'boolean', default: true })
  autoPenaltyEnabled!: boolean;

  @Column({ type: 'json', nullable: true, default: null })
  penaltyRules!: PenaltyRule[] | null;

  /* ── Véhicules ───────────────────────────────────────────── */

  @Column({ type: 'json', nullable: true, default: null })
  vehicleRules!: VehicleRule[] | null;

  /* ── Paiement ────────────────────────────────────────────── */

  @Column({ type: 'varchar', length: 20, default: 'weekly' })
  paymentFrequency!: string;

  /** Part Shopi sur chaque course (%) */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 15 })
  platformCommissionRate!: number;

  /* ── Événements de notification ──────────────────────────── */

  @Column({ type: 'json', nullable: true, default: null })
  notifEventsConfig!: Record<string, boolean> | null;

  @UpdateDateColumn()
  updatedAt!: Date;
}
