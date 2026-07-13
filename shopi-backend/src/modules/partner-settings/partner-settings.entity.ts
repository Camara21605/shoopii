/* ============================================================
 * FICHIER : src/modules/partner-settings/partner-settings.entity.ts
 *
 * RÔLE    : Configuration singleton du Partner Management Center.
 *           Tiers, commissions, objectifs, bonus, validation, notifs.
 *
 * Pattern singleton : id = 1 toujours (une seule ligne en DB).
 *   JSON columns pour configs évolutives sans migration.
 * ============================================================ */

import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/* ── Interfaces stockées en JSON ────────────────────────────── */

export interface PartnerTier {
  id:          string;
  label:       string;
  color:       string;
  icon:        string;
  badge:       string;
  description: string;
  commission:  number;
  objectif:    number;
  bonus:       number;
  minCompanies:number;
  enabled:     boolean;
  order:       number;
}

export interface PartnerBonusRule {
  id:                 string;
  label:              string;
  tierId:             string;
  type:               'monthly' | 'quarterly' | 'annual' | 'performance';
  threshold:          number;
  bonusAmount:        number;
  enabled:            boolean;
}

export interface PartnerObjective {
  id:       string;
  label:    string;
  metric:   'companies' | 'orders' | 'revenue' | 'deliveries' | 'clients';
  period:   'monthly' | 'quarterly' | 'annual';
  target:   number;
  enabled:  boolean;
}

export interface PartnerRewardRule {
  id:          string;
  label:       string;
  type:        'badge' | 'credit' | 'coupon' | 'gift' | 'vip';
  condition:   string;
  value:       number;
  enabled:     boolean;
}

export interface PartnerDocument {
  id:          string;
  label:       string;
  description: string;
  required:    boolean;
}

/* ══════════════════════════════════════════════════════════ */

@Entity('partner_settings')
export class PartnerSetting {

  @PrimaryColumn({ type: 'int', default: 1 })
  id!: number;

  /* ── Tiers ───────────────────────────────────────────────── */

  @Column({ type: 'json', nullable: true, default: null })
  tiers!: PartnerTier[] | null;

  /* ── Commissions ─────────────────────────────────────────── */

  /**
   * Mode : 'tier' | 'fixed' | 'progressive'
   * 'tier'        → chaque tier a sa propre commission
   * 'fixed'       → taux unique pour tous
   * 'progressive' → paliers de volume
   */
  @Column({ type: 'varchar', length: 20, default: 'tier' })
  commissionMode!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5 })
  defaultCommissionRate!: number;

  /* ── Validation ──────────────────────────────────────────── */

  @Column({ type: 'varchar', length: 20, default: 'manuel' })
  validationMode!: string;

  @Column({ type: 'int', default: 24 })
  validationDelayH!: number;

  @Column({ type: 'boolean', default: false })
  autoRejectExpired!: boolean;

  @Column({ type: 'json', nullable: true, default: null })
  requiredDocuments!: PartnerDocument[] | null;

  /* ── Bonus ───────────────────────────────────────────────── */

  @Column({ type: 'boolean', default: true })
  bonusProgramEnabled!: boolean;

  @Column({ type: 'json', nullable: true, default: null })
  bonusRules!: PartnerBonusRule[] | null;

  /* ── Objectifs ───────────────────────────────────────────── */

  @Column({ type: 'json', nullable: true, default: null })
  objectives!: PartnerObjective[] | null;

  /* ── Récompenses ─────────────────────────────────────────── */

  @Column({ type: 'boolean', default: true })
  rewardProgramEnabled!: boolean;

  @Column({ type: 'json', nullable: true, default: null })
  rewardRules!: PartnerRewardRule[] | null;

  /* ── Paiement ────────────────────────────────────────────── */

  @Column({ type: 'varchar', length: 20, default: 'monthly' })
  paymentFrequency!: string;

  /* ── Upgrade tier automatique ────────────────────────────── */

  @Column({ type: 'boolean', default: true })
  autoTierUpgrade!: boolean;

  @Column({ type: 'boolean', default: false })
  autoTierDowngrade!: boolean;

  /* ── Notifications ───────────────────────────────────────── */

  @Column({ type: 'json', nullable: true, default: null })
  notifEventsConfig!: Record<string, boolean> | null;

  @UpdateDateColumn()
  updatedAt!: Date;
}
