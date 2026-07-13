/* ============================================================
 * FICHIER : src/modules/company-settings/company-settings.entity.ts
 *
 * RÔLE    : Configuration singleton du moteur des entreprises.
 *           Gère commissions, documents requis, règles catégories,
 *           limites, permissions produits et règles de suspension.
 *
 * Pattern singleton : id = 1 toujours (une seule ligne en DB).
 *   Colonnes JSON pour les données structurées évolutives.
 *   Toutes les colonnes ont un default → sync sans migration.
 * ============================================================ */

import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/* ── Types internes (stockés en JSON) ──────────────────────── */

export interface CommissionBracket {
  from:  number;
  to:    number | null;
  rate:  number;
}

export interface RequiredDocument {
  id:          string;
  label:       string;
  description: string;
  required:    boolean;
}

export interface CategoryRule {
  nom:        string;
  enabled:    boolean;
  commission: number | null;
}

/* ══════════════════════════════════════════════════════════ */

@Entity('company_settings')
export class CompanySetting {

  @PrimaryColumn({ type: 'int', default: 1 })
  id!: number;

  /* ── Commission ─────────────────────────────────────────── */

  /**
   * Type de commission appliqué aux transactions des entreprises.
   * 'percentage' : pourcentage fixe du CA
   * 'fixed'      : montant fixe par commande (GNF)
   * 'progressive': taux dégressif par tranches (voir commissionBrackets)
   */
  @Column({ type: 'varchar', length: 20, default: 'percentage' })
  commissionType!: string;

  /** Taux principal (pourcentage ou montant selon commissionType) */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 6 })
  commissionValue!: number;

  /** Commission minimale appliquée par transaction */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 500 })
  commissionMin!: number;

  /** Plafond de commission par transaction */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 500000 })
  commissionMax!: number;

  /** Tranches pour le mode progressif (JSON) */
  @Column({ type: 'json', nullable: true, default: null })
  commissionBrackets!: CommissionBracket[] | null;

  /* ── Validation entreprises ──────────────────────────────── */

  @Column({ type: 'varchar', length: 20, default: 'manuel' })
  validationMode!: string;

  @Column({ type: 'int', default: 48 })
  validationDelayH!: number;

  /* ── Documents requis ────────────────────────────────────── */

  /** Liste dynamique des documents exigés à l'inscription (JSON) */
  @Column({ type: 'json', nullable: true, default: null })
  requiredDocuments!: RequiredDocument[] | null;

  /* ── Règles catégories ───────────────────────────────────── */

  /** Overrides par catégorie : activation + commission spécifique (JSON) */
  @Column({ type: 'json', nullable: true, default: null })
  categoryRules!: CategoryRule[] | null;

  /* ── Limites opérationnelles ─────────────────────────────── */

  @Column({ type: 'int', default: 500 })
  monthlyOrderLimit!: number;

  @Column({ type: 'int', default: 50 })
  dailyOrderLimit!: number;

  @Column({ type: 'int', default: 1000 })
  maxProducts!: number;

  @Column({ type: 'int', default: 10 })
  maxActivePromotions!: number;

  @Column({ type: 'int', default: 5 })
  maxBranches!: number;

  /* ── Permissions produits ────────────────────────────────── */

  @Column({ type: 'boolean', default: true })
  allowPhysical!: boolean;

  @Column({ type: 'boolean', default: false })
  allowDigital!: boolean;

  @Column({ type: 'boolean', default: true })
  allowServices!: boolean;

  @Column({ type: 'boolean', default: false })
  allowInternational!: boolean;

  /* ── Suspension automatique ──────────────────────────────── */

  @Column({ type: 'boolean', default: true })
  autoSuspensionEnabled!: boolean;

  /** Nombre de signalements graves avant suspension auto */
  @Column({ type: 'int', default: 3 })
  suspensionSignalThreshold!: number;

  /** Nombre de litiges ouverts avant suspension auto */
  @Column({ type: 'int', default: 5 })
  suspensionLitigeThreshold!: number;

  /** Jours d'inactivité avant désactivation automatique */
  @Column({ type: 'int', default: 90 })
  inactivityDays!: number;

  /* ── Événements de notification (JSON) ───────────────────── */

  /**
   * Événements déclenchant des notifications aux entreprises du réseau.
   * Stocké en JSON pour rester extensible sans migration.
   * Chaque clé = nom d'événement, valeur = activé/désactivé.
   */
  @Column({ type: 'json', nullable: true, default: null })
  notifEventsConfig!: Record<string, boolean> | null;

  @UpdateDateColumn()
  updatedAt!: Date;
}
