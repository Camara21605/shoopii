/* ============================================================
 * FICHIER : src/modules/validation-config/validation-config.entity.ts
 *
 * RÔLE    : Configuration singleton du moteur de validation Shopi.
 *           Table à une seule ligne (pattern singleton, id = 1).
 *           Gérée par les administrateurs.
 *
 * NOTE    : Toutes les colonnes ont un default ou nullable:true
 *           → TypeORM synchronize:true s'en charge sans migration.
 * ============================================================ */

import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

export interface ActorRule {
  auto:     boolean;
  delaiH:   number;
  scoreMin: number;
  docs:     string[];
  actif:    boolean;
}

@Entity('validation_config')
export class ValidationConfig {

  /** Toujours 1 — table singleton */
  @PrimaryColumn({ type: 'int', default: 1 })
  id!: number;

  /**
   * Mode de validation global.
   * - 'auto'    : toutes les demandes approuvées instantanément si conformes
   * - 'manuel'  : chaque demande examinée manuellement
   * - 'hybride' : auto si score ≥ scoreMinAuto, sinon manuelle
   * - 'score'   : décision basée uniquement sur le score de risque
   */
  @Column({ type: 'varchar', length: 20, default: 'manuel' })
  modeGlobal!: string;

  /** Délai d'expiration global des demandes non traitées (heures) */
  @Column({ type: 'int', default: 48 })
  delaiExpirationH!: number;

  /** Score minimum (0-100) pour approbation auto en mode hybride / score */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 75 })
  scoreMinAuto!: number;

  /* ── Canaux de notification ─────────────────────────────── */

  @Column({ type: 'boolean', default: true })
  notifEmailEnabled!: boolean;

  @Column({ type: 'boolean', default: false })
  notifSmsEnabled!: boolean;

  @Column({ type: 'boolean', default: true })
  notifPushEnabled!: boolean;

  /** Notifier l'administrateur de zone à chaque événement de validation */
  @Column({ type: 'boolean', default: true })
  notifAdminEnabled!: boolean;

  /**
   * Règles individuelles par type d'acteur (JSON).
   * Clés : 'company' | 'partner' | 'delivery' | 'correspondent' | 'client'
   * null → valeurs par défaut du service.
   */
  @Column({ type: 'json', nullable: true, default: null })
  reglesActeurs!: Record<string, ActorRule> | null;

  @UpdateDateColumn()
  updatedAt!: Date;
}
