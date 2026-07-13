/* ============================================================
 * FICHIER : src/database/entities/platform-settings.entity.ts
 *
 * RÔLE    : Configuration globale de la plateforme Shopi.
 *           Table à une seule ligne (pattern singleton).
 *           Gérée exclusivement par le Super Admin.
 *
 * NOTE    : Toutes les nouvelles colonnes ont un `default`
 *           ou `nullable: true` → compatible avec TypeORM
 *           synchronize:true (pas de migration manuelle).
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
   * GÉNÉRAL — Identité & localisation
   * ══════════════════════════════════════════════════════════ */

  @Column({ type: 'varchar', length: 100, default: 'Shopi Africa' })
  platformName!: string;

  @Column({ type: 'varchar', length: 200, nullable: true, default: null })
  platformTagline!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true, default: null })
  supportEmail!: string | null;

  /** Devise principale (XOF, GNF, EUR, USD, MAD…) */
  @Column({ type: 'varchar', length: 10, default: 'GNF' })
  defaultCurrency!: string;

  /** Langue par défaut : 'fr' | 'en' | 'ar' */
  @Column({ type: 'varchar', length: 5, default: 'fr' })
  defaultLanguage!: string;

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

  /** Durée de session (minutes) avant déconnexion automatique */
  @Column({ type: 'int', default: 60 })
  sessionTimeoutMin!: number;

  /** Durée de validité du token JWT (heures) */
  @Column({ type: 'int', default: 24 })
  tokenValidityHours!: number;

  /** Limite de requêtes par minute et par IP */
  @Column({ type: 'int', default: 100 })
  rateLimitPerMin!: number;

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
   * MODÉRATION
   * ══════════════════════════════════════════════════════════ */

  /** Valider manuellement chaque nouveau vendeur avant activation */
  @Column({ type: 'boolean', default: false })
  manualVendorApproval!: boolean;

  /** Nombre de signalements avant suspension automatique d'un compte */
  @Column({ type: 'int', default: 5 })
  reportsBeforeSuspend!: number;

  /** SLA de réponse SAV en heures */
  @Column({ type: 'int', default: 24 })
  savResponseSlaHours!: number;

  /* ══════════════════════════════════════════════════════════
   * PLATEFORME & MAINTENANCE
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
   * PAIEMENTS & FINANCE
   * ══════════════════════════════════════════════════════════ */

  /** Montant minimum pour un retrait (en unité de la devise principale) */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 10000 })
  minWithdrawalAmount!: number;

  /** Montant maximum autorisé par transaction */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 5000000 })
  maxTransactionAmount!: number;

  /** Délai de règlement en jours ouvrés */
  @Column({ type: 'int', default: 2 })
  settlementDelayDays!: number;

  @Column({ type: 'boolean', default: true })
  mtnMoneyEnabled!: boolean;

  @Column({ type: 'boolean', default: true })
  orangeMoneyEnabled!: boolean;

  @Column({ type: 'boolean', default: false })
  waveEnabled!: boolean;

  @Column({ type: 'boolean', default: false })
  moovMoneyEnabled!: boolean;

  /* ══════════════════════════════════════════════════════════
   * NOTIFICATIONS
   * ══════════════════════════════════════════════════════════ */

  @Column({ type: 'boolean', default: true })
  emailNotifEnabled!: boolean;

  @Column({ type: 'boolean', default: true })
  pushNotifEnabled!: boolean;

  @Column({ type: 'boolean', default: false })
  smsNotifEnabled!: boolean;

  /** Seuil d'alerte CPU (%) */
  @Column({ type: 'int', default: 80 })
  cpuAlertPct!: number;

  /** Seuil d'alerte RAM (%) */
  @Column({ type: 'int', default: 85 })
  ramAlertPct!: number;

  /* ══════════════════════════════════════════════════════════
   * INTÉGRATIONS & API
   * ══════════════════════════════════════════════════════════ */

  @Column({ type: 'varchar', length: 80, nullable: true, default: null })
  analyticsTrackingId!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true, default: null })
  facebookPixelId!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  webhookUrl!: string | null;

  /* ══════════════════════════════════════════════════════════
   * APPARENCE & BRANDING
   * ══════════════════════════════════════════════════════════ */

  /** Couleur principale de la plateforme (hex) */
  @Column({ type: 'varchar', length: 20, default: '#00C88A' })
  primaryColor!: string;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  logoUrl!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  faviconUrl!: string | null;

  /* ══════════════════════════════════════════════════════════
   * AUDIT
   * ══════════════════════════════════════════════════════════ */

  @UpdateDateColumn()
  updatedAt!: Date;
}
