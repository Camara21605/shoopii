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

  @Column({ type: 'varchar', length: 100, default: 'Shopi' })
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

  /**
   * Limite de retrait journalière globale (par acteur).
   * 0 = aucune limite globale (chaque wallet peut avoir sa propre limite).
   */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 5000000 })
  dailyWithdrawalLimit!: number;

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
   * COMMISSIONS — PRODUIT
   * ══════════════════════════════════════════════════════════
   *
   * Règle : commissionProduit = sousTotal × tauxCommissionProduit × planMultiplier
   *
   * La commission est ensuite répartie entre 3 bénéficiaires :
   *   Shopi (ratioShopiProduit %) + Partenaire (ratioPartenaireProduit %) + Admin (ratioAdminProduit %)
   *   Invariant : les 3 ratios doivent toujours sommer à 100.
   * ══════════════════════════════════════════════════════════ */

  /**
   * Taux brut de commission sur le prix des produits (%).
   * Appliqué sur sousTotal avant réduction par plan.
   * Défaut : 6 % (six pour cent).
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 6 })
  tauxCommissionProduit!: number;

  /**
   * Multiplicateur du taux pour les entreprises au plan PRO.
   * commission_effective = tauxCommissionProduit × planMultiplierPro
   * Exemple : 6 % × 0.75 = 4.5 %
   */
  @Column({ type: 'decimal', precision: 4, scale: 3, default: 0.75 })
  planMultiplierPro!: number;

  /**
   * Multiplicateur du taux pour les entreprises au plan PREMIUM.
   * Exemple : 6 % × 0.50 = 3 %
   */
  @Column({ type: 'decimal', precision: 4, scale: 3, default: 0.5 })
  planMultiplierPremium!: number;

  /**
   * Part de la commission produit allant à Shopi (%).
   * Doit vérifier : ratioShopiProduit + ratioPartenaireProduit + ratioAdminProduit = 100
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 70 })
  ratioShopiProduit!: number;

  /**
   * Part de la commission produit allant au Partenaire qui a créé l'entreprise (%).
   * Si l'entreprise n'a pas de partenaire → cette part va à Shopi.
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 20 })
  ratioPartenaireProduit!: number;

  /**
   * Part de la commission produit allant à l'Admin qui a créé le Partenaire (%).
   * Si l'entreprise n'a pas d'admin → cette part va à Shopi.
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 10 })
  ratioAdminProduit!: number;

  /* ══════════════════════════════════════════════════════════
   * COMMISSIONS — LIVRAISON
   * ══════════════════════════════════════════════════════════
   *
   * Indépendant de la commission produit.
   * Règle : commissionLivraison = fraisLivraison × tauxCommissionLivraison
   * ══════════════════════════════════════════════════════════ */

  /**
   * Taux brut de commission sur les frais de livraison (%).
   * Défaut : 10 % (dix pour cent).
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 10 })
  tauxCommissionLivraison!: number;

  /** Part Shopi de la commission livraison (%). */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 60 })
  ratioShopiLivraison!: number;

  /**
   * Part Partenaire de la commission livraison (%).
   * Partenaire = celui qui a créé le compte du livreur/correspondant.
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 25 })
  ratioPartenaireLivraison!: number;

  /** Part Admin de la commission livraison (%). */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 15 })
  ratioAdminLivraison!: number;

  /* ══════════════════════════════════════════════════════════
   * DÉLAIS MÉTIER (tous configurables)
   * ══════════════════════════════════════════════════════════ */

  /**
   * Durée maximale pour payer après création d'une commande (heures).
   * Passé ce délai → commande EXPIRED, codes invalidés.
   */
  @Column({ type: 'int', default: 24 })
  maxPaymentDelayHours!: number;

  /**
   * Durée de vie d'une session de paiement (minutes).
   * Passé ce délai → session EXPIRED.
   */
  @Column({ type: 'int', default: 60 })
  sessionTtlMinutes!: number;

  /**
   * Délai maximal pour qu'une entreprise valide ou refuse une commande PAID (heures).
   * Passé ce délai → annulation automatique + remboursement client.
   */
  @Column({ type: 'int', default: 48 })
  maxEnterpriseValidationHours!: number;

  /**
   * Fenêtre de contestation (jours) après DELIVERED / AUTO_DELIVERED.
   * Passé ce délai → litige impossible.
   */
  @Column({ type: 'int', default: 7 })
  disputeWindowDays!: number;

  /**
   * Délai maximal pour qu'un admin rende sa décision sur un litige (heures).
   * Passé ce délai → escalade au SuperAdmin.
   */
  @Column({ type: 'int', default: 48 })
  disputeResolutionHours!: number;

  /**
   * Délai de traitement des remboursements (jours ouvrés).
   * Correspond au délai côté provider (FedaPay Refund).
   */
  @Column({ type: 'int', default: 3 })
  refundProcessingDays!: number;

  /**
   * Délai de traitement des retraits (heures).
   * Si dépassé → alerte admin + client.
   */
  @Column({ type: 'int', default: 24 })
  withdrawalProcessingHours!: number;

  /**
   * Durée de conservation des données financières (années).
   * Obligation légale. Après expiration → anonymisation partielle.
   */
  @Column({ type: 'int', default: 5 })
  dataRetentionYears!: number;

  /**
   * Délai d'inactivité d'un wallet avant gel préventif (jours).
   * Protège les fonds des comptes abandonnés.
   */
  @Column({ type: 'int', default: 365 })
  walletInactivityDays!: number;

  /**
   * Nombre maximal de tentatives de paiement par heure et par utilisateur.
   * Anti-fraude : bloque temporairement si dépassé.
   */
  @Column({ type: 'int', default: 5 })
  maxDailyPaymentAttempts!: number;

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
   * LITIGES (Resolution Engine)
   * ══════════════════════════════════════════════════════════
   * Note : disputeWindowDays est déclaré dans la section DÉLAIS MÉTIER.
   * ══════════════════════════════════════════════════════════ */

  /** Nombre maximum de pièces justificatives par litige. */
  @Column({ type: 'int', default: 10 })
  maxEvidencesPerDispute!: number;

  /** SLA d'instruction admin en heures (alerte si dépassé). */
  @Column({ type: 'int', default: 48 })
  disputeInstructionSlaHours!: number;

  /* ══════════════════════════════════════════════════════════
   * SETTLEMENT ENGINE
   * ══════════════════════════════════════════════════════════ */

  /** Seuil au-delà duquel un retrait nécessite une validation manuelle (GNF). */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 500000 })
  autoValidationThreshold!: number;

  /** Nombre maximal de tentatives de payout avant blocage définitif. */
  @Column({ type: 'int', default: 3 })
  maxWithdrawalAttempts!: number;

  /** Activation du provider Djomy. */
  @Column({ type: 'boolean', default: false })
  djomyEnabled!: boolean;

  /* ══════════════════════════════════════════════════════════
   * COMPANY TEAM MANAGEMENT
   * ══════════════════════════════════════════════════════════ */

  /**
   * Nombre maximum de collaborateurs actifs par entreprise.
   * Le propriétaire de l'entreprise ne compte pas dans cette limite.
   * Configurable par le Super Admin pour évoluer dans le futur.
   * Défaut : 5 collaborateurs.
   */
  @Column({ type: 'int', default: 5 })
  maxTeamMembersPerCompany!: number;

  /* ══════════════════════════════════════════════════════════
   * AUDIT
   * ══════════════════════════════════════════════════════════ */

  @UpdateDateColumn()
  updatedAt!: Date;
}
