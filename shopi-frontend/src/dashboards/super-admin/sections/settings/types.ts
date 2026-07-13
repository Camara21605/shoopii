/**
 * @file   types.ts
 * @module settings
 *
 * Toutes les interfaces TypeScript utilisées dans le module Settings.
 * Centralisé ici pour éviter les doublons entre les fichiers d'onglets.
 *
 * Structure des données :
 *   PlatformSettings  ← miroir exact du DTO backend (UpdatePlatformSettingsDto)
 *   TypeLocal         ← type d'entreprise (ex: Restaurant, Boutique)
 *   CatLocal          ← catégorie de produit liée à un type
 *   SubLocal          ← sous-catégorie liée à une catégorie
 *   SettingsTab       ← union des 9 identifiants d'onglets
 */

/* ─────────────────────────────────────────────────────────────
 * ONGLETS
 * ─────────────────────────────────────────────────────────────
 * Union string-littérale qui identifie chacun des 9 onglets.
 * Utilisée pour l'état activeTab dans l'orchestrateur.
 */
export type SettingsTab =
  | 'general'        // Identité, localisation, contact
  | 'securite'       // Auth, sessions, rate-limiting
  | 'inscriptions'   // Signup, KYC, modération
  | 'catalogue'      // Types / Catégories / Sous-catégories
  | 'paiements'      // Commission, seuils, fournisseurs mobile money
  | 'notifications'  // Email, Push, SMS, seuils alertes
  | 'integrations'   // API key, webhooks, analytics
  | 'apparence'      // Thème, couleurs, logo
  | 'danger';        // Maintenance, cache, export

/* ─────────────────────────────────────────────────────────────
 * PARAMÈTRES PLATEFORME
 * ─────────────────────────────────────────────────────────────
 * Miroir de l'entité `PlatformSettings` du backend.
 * Tous les champs sont envoyés au PATCH /dashboard/super-admin/settings.
 * Les champs id et updatedAt sont exclus du payload envoyé (lecture seule).
 */
export interface PlatformSettings {
  // ── Général ────────────────────────────────────────────────
  /** Nom affiché de la plateforme (ex: "Shopi Africa") */
  platformName:         string;
  /** Slogan court affiché sous le logo et dans les emails */
  platformTagline:      string | null;
  /** Email qui reçoit les demandes d'aide des utilisateurs */
  supportEmail:         string | null;
  /** Devise principale des transactions : GNF, XOF, EUR… */
  defaultCurrency:      string;
  /** Langue de l'interface : 'fr' | 'en' | 'ar' */
  defaultLanguage:      string;

  // ── Sécurité ───────────────────────────────────────────────
  /** Email de confirmation obligatoire à l'inscription */
  emailVerifRequired:   boolean;
  /** 2FA (double authentification) obligatoire pour les admins */
  adminTwoFaRequired:   boolean;
  /** Nombre max d'échecs de connexion avant verrouillage (1–20) */
  maxLoginAttempts:     number;
  /** Durée d'inactivité avant déconnexion auto (en minutes) */
  sessionTimeoutMin:    number;
  /** Durée de validité du token JWT (en heures) */
  tokenValidityHours:   number;
  /** Limite de requêtes API par minute et par adresse IP */
  rateLimitPerMin:      number;

  // ── Inscriptions ───────────────────────────────────────────
  /** Les clients peuvent s'inscrire librement (sans code) */
  openSignup:             boolean;
  /** Un code d'invitation est requis pour les comptes entreprise */
  codeRequiredForCompany: boolean;
  /** Vérification d'identité (KYC) obligatoire avant activation */
  kycRequired:            boolean;

  // ── Modération ─────────────────────────────────────────────
  /** Un admin doit approuver chaque nouveau compte vendeur */
  manualVendorApproval: boolean;
  /** Nombre de signalements déclenchant une suspension automatique */
  reportsBeforeSuspend: number;
  /** Délai maximum de réponse du SAV (Service Après-Vente), en heures */
  savResponseSlaHours:  number;

  // ── Plateforme ─────────────────────────────────────────────
  /** Mode maintenance : toute la plateforme est inaccessible aux users */
  maintenanceMode:      boolean;
  /** Pourcentage prélevé sur chaque transaction vendeur (0–50%) */
  platformCommission:   number;
  /** Fuseau horaire IANA (ex: "Africa/Conakry") */
  timezone:             string;

  // ── Paiements ──────────────────────────────────────────────
  /** Montant minimum pour déclencher un retrait */
  minWithdrawalAmount:  number;
  /** Plafond maximum par transaction */
  maxTransactionAmount: number;
  /** Délai avant versement aux vendeurs (en jours ouvrés) */
  settlementDelayDays:  number;
  /** Fournisseurs mobile money actifs */
  mtnMoneyEnabled:      boolean;
  orangeMoneyEnabled:   boolean;
  waveEnabled:          boolean;
  moovMoneyEnabled:     boolean;

  // ── Notifications ──────────────────────────────────────────
  emailNotifEnabled:    boolean;
  pushNotifEnabled:     boolean;
  smsNotifEnabled:      boolean;
  /** Pourcentage CPU déclenchant une alerte système (50–99) */
  cpuAlertPct:          number;
  /** Pourcentage RAM déclenchant une alerte système (50–99) */
  ramAlertPct:          number;

  // ── Intégrations ───────────────────────────────────────────
  /** Google Analytics Measurement ID (ex: "G-XXXXXXXXXX") */
  analyticsTrackingId:  string | null;
  /** Facebook Pixel ID pour le suivi publicitaire Meta */
  facebookPixelId:      string | null;
  /** URL recevant les événements plateforme en POST JSON */
  webhookUrl:           string | null;

  // ── Apparence ──────────────────────────────────────────────
  /** Couleur principale en hexadécimal (ex: "#00C88A") */
  primaryColor:         string;
  /** URL du logo principal (.png ou .svg recommandé) */
  logoUrl:              string | null;
  /** URL du favicon (16×16 ou 32×32 px) */
  faviconUrl:           string | null;

  // ── Champs retournés par l'API, exclus du PATCH ────────────
  /** Clé API générée côté backend (lecture seule, jamais envoyée en PATCH) */
  apiKey?:    string | null;
  id?:        number;
  updatedAt?: string;
}

/* ─────────────────────────────────────────────────────────────
 * CATALOGUE — TYPES, CATÉGORIES, SOUS-CATÉGORIES
 * ─────────────────────────────────────────────────────────────
 * Ces trois interfaces reflètent les entités du backend :
 *   GET  /company-types
 *   GET  /company-types/:id/categories
 *   POST /sub-categories
 */

/** Type d'entreprise (ex: Restaurant, Boutique, Pharmacie) */
export interface TypeLocal {
  id:            string;
  slug:          string;   // Identifiant technique (ex: "restaurant")
  nom:           string;
  description:   string | null;
  icone:         string | null;  // Emoji (ex: "🍔")
  couleur:       string | null;  // Couleur hex de l'étiquette
  ordre:         number;         // Ordre d'affichage dans la liste
  actif:         boolean;
  nbCategories:  number;         // Nombre de catégories liées
  nbEntreprises: number;         // Nombre d'entreprises utilisant ce type
}

/** Catégorie de produit, liée à un TypeLocal */
export interface CatLocal {
  id:            string;
  nom:           string;
  slug:          string;
  icone:         string | null;
  couleur:       string | null;
  description:   string | null;
  ordre:         number;
  actif:         boolean;
  companyTypeId: string | null;  // ID du type parent
  subCategories: SubLocal[];     // Sous-catégories enfants
}

/** Sous-catégorie, liée à une CatLocal */
export interface SubLocal {
  id:         string;
  nom:        string;
  slug:       string;
  icone:      string | null;
  ordre:      number;
  categoryId: string;  // ID de la catégorie parente
}
