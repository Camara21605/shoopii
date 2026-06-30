/* ============================================================
 * FICHIER : src/database/entities/platform-settings.entity.ts
 *
 * RÔLE    : Configuration globale de la plateforme Shopi.
 *           Table à une seule ligne (pattern singleton).
 *           Gérée exclusivement par le Super Admin.
 * ============================================================ */

import {
  Entity, PrimaryColumn, Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('platform_settings')
export class PlatformSettings {

  /** Toujours 1 — table singleton */
  @PrimaryColumn({ type: 'int', default: 1 })
  id!: number;

  /* ══════════════════════════════════════════════════════════
   * SÉCURITÉ & AUTHENTIFICATION
   * ══════════════════════════════════════════════════════════ */

  /** Vérification email obligatoire à l'inscription */
  @Column({ type: 'boolean', default: true })
  emailVerifRequired!: boolean;

  /** 2FA obligatoire pour tous les administrateurs */
  @Column({ type: 'boolean', default: true })
  adminTwoFaRequired!: boolean;

  /** Nombre maximal de tentatives de connexion avant blocage temporaire */
  @Column({ type: 'int', default: 5 })
  maxLoginAttempts!: number;

  /* ══════════════════════════════════════════════════════════
   * INSCRIPTIONS & ACCÈS
   * ══════════════════════════════════════════════════════════ */

  /** Inscription libre des clients (sans code d'invitation) */
  @Column({ type: 'boolean', default: true })
  openSignup!: boolean;

  /** Code d'invitation requis pour créer un compte entreprise */
  @Column({ type: 'boolean', default: true })
  codeRequiredForCompany!: boolean;

  /** Validation KYC obligatoire avant activation du compte */
  @Column({ type: 'boolean', default: false })
  kycRequired!: boolean;

  /* ══════════════════════════════════════════════════════════
   * PLATEFORME
   * ══════════════════════════════════════════════════════════ */

  /** Mode maintenance — désactive l'accès à tous les utilisateurs non-admin */
  @Column({ type: 'boolean', default: false })
  maintenanceMode!: boolean;

  /**
   * Commission plateforme en pourcentage (%).
   * Appliquée sur chaque transaction boutique → Shopi.
   * Plage autorisée : 0–50.
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 6 })
  platformCommission!: number;

  /**
   * Fuseau horaire de référence de la plateforme.
   * Format IANA : "Africa/Conakry", "Africa/Dakar", etc.
   */
  @Column({ type: 'varchar', length: 80, default: 'Africa/Conakry' })
  timezone!: string;

  /* ══════════════════════════════════════════════════════════
   * AUDIT
   * ══════════════════════════════════════════════════════════ */

  @UpdateDateColumn()
  updatedAt!: Date;
}
