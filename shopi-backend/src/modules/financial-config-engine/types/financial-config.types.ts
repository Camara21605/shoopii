/* ============================================================
 * FICHIER      : src/modules/financial-config-engine/types/financial-config.types.ts
 * MODULE       : FinancialConfigEngine
 * ROLE         : Types, interfaces et classes d'erreur du moteur
 *                de configuration financière.
 * RESPONSABILITES :
 *   - Définir les DTO de mise à jour pour chaque section
 *   - Définir les contextes d'opération et les résultats
 *   - Exposer l'enum d'erreurs et la classe ConfigErreur
 * DEPENDANCES  :
 *   ConfigSection (configuration-snapshot.entity)
 * UTILISE PAR  :
 *   Tous les services du FinancialConfigEngine
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { ConfigSection } from '../../../database/entities/paiement/configuration-snapshot.entity';

/* ============================================================
 * SECTION 1 — ERREURS
 * ============================================================ */

/**
 * Types d'erreurs métier levées par le FinancialConfigEngine.
 * Chaque valeur correspond à un cas de défaillance distinct
 * pour faciliter le diagnostic et la gestion par les appelants.
 */
export enum ConfigErreurType {
  /** PlatformSettings introuvable en base (configuration manquante) */
  SETTINGS_INTROUVABLE        = 'SETTINGS_INTROUVABLE',
  /** Un ou plusieurs champs échouent la validation métier */
  VALIDATION_ECHOUEE          = 'VALIDATION_ECHOUEE',
  /** Modification de champs immutables ou protégés */
  MODIFICATION_INTERDITE      = 'MODIFICATION_INTERDITE',
  /** Snapshot demandé inexistant (mauvaise section ou version) */
  SNAPSHOT_INTROUVABLE        = 'SNAPSHOT_INTROUVABLE',
  /** Rollback impossible (version cible hors plage ou état incohérent) */
  ROLLBACK_IMPOSSIBLE         = 'ROLLBACK_IMPOSSIBLE',
  /** Justification absente ou vide (obligatoire pour toute modification) */
  JUSTIFICATION_REQUISE       = 'JUSTIFICATION_REQUISE',
  /** Aucun champ modifié détecté dans la requête */
  AUCUN_CHANGEMENT            = 'AUCUN_CHANGEMENT',
  /** Erreur interne non prévue */
  ERREUR_INTERNE              = 'ERREUR_INTERNE',
}

/**
 * Erreur métier du FinancialConfigEngine.
 * Étend Error avec un type structuré et un contexte optionnel.
 */
export class ConfigErreur extends Error {
  constructor(
    public readonly type: ConfigErreurType,
    message: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ConfigErreur';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/* ============================================================
 * SECTION 2 — DTO PAR SECTION
 *
 * Chaque interface correspond aux champs de PlatformSettings
 * que l'admin peut modifier dans cette section.
 * Tous les champs sont optionnels (PATCH sémantique).
 * ============================================================ */

/**
 * DTO — Paramètres de commissions (produit + livraison).
 *
 * Invariants validés :
 *   ratioShopiProduit + ratioPartenaireProduit + ratioAdminProduit = 100
 *   ratioShopiLivraison + ratioPartenaireLivraison + ratioAdminLivraison = 100
 *   Tous les taux : 0 ≤ valeur ≤ 100
 *   Tous les multiplicateurs : 0 < valeur ≤ 1
 */
export interface UpdateCommissionDto {
  /** Taux brut sur le prix des produits (%) — ex : 6.5 */
  tauxCommissionProduit?:     number;
  /** Multiplicateur pour le plan PRO — ex : 0.75 */
  planMultiplierPro?:         number;
  /** Multiplicateur pour le plan PREMIUM — ex : 0.50 */
  planMultiplierPremium?:     number;
  /** Part Shopi de la commission produit (%) */
  ratioShopiProduit?:         number;
  /** Part Partenaire de la commission produit (%) */
  ratioPartenaireProduit?:    number;
  /** Part Admin de la commission produit (%) */
  ratioAdminProduit?:         number;
  /** Taux brut sur les frais de livraison (%) */
  tauxCommissionLivraison?:   number;
  /** Part Shopi de la commission livraison (%) */
  ratioShopiLivraison?:       number;
  /** Part Partenaire de la commission livraison (%) */
  ratioPartenaireLivraison?:  number;
  /** Part Admin de la commission livraison (%) */
  ratioAdminLivraison?:       number;
  /** Libellé optionnel pour identifier cette version de règle */
  label?:                     string;
}

/**
 * DTO — Paramètres de paiement.
 *
 * Contrôle les providers actifs, les montants et les délais.
 * Les clés API ne sont JAMAIS exposées ici — elles restent dans .env.
 */
export interface UpdatePaymentDto {
  /** Activer/désactiver Orange Money */
  orangeMoneyEnabled?:        boolean;
  /** Activer/désactiver MTN Mobile Money */
  mtnMoneyEnabled?:           boolean;
  /** Activer/désactiver Wave */
  waveEnabled?:               boolean;
  /** Activer/désactiver Moov Money */
  moovMoneyEnabled?:          boolean;
  /** Activer/désactiver Djomy */
  djomyEnabled?:              boolean;
  /** Montant maximum autorisé par transaction (GNF) */
  maxTransactionAmount?:      number;
  /** Nombre maximal de tentatives de paiement par jour par utilisateur */
  maxDailyPaymentAttempts?:   number;
  /** Durée de vie d'une session de paiement (minutes) */
  sessionTtlMinutes?:         number;
  /** Durée maximale pour payer après création commande (heures) */
  maxPaymentDelayHours?:      number;
}

/**
 * DTO — Paramètres des wallets.
 *
 * Contrôle les limites globales de retrait et les seuils d'inactivité.
 */
export interface UpdateWalletDto {
  /** Limite de retrait journalière globale (GNF) */
  dailyWithdrawalLimit?:      number;
  /** Délai d'inactivité avant gel préventif du wallet (jours) */
  walletInactivityDays?:      number;
  /** Délai de règlement (jours ouvrés entre CONFIRMED et disponible) */
  settlementDelayDays?:       number;
}

/**
 * DTO — Paramètres d'escrow.
 *
 * Contrôle la durée de blocage des fonds et les délais de validation.
 */
export interface UpdateEscrowDto {
  /** Délai maximal pour qu'une entreprise valide une commande PAID (heures) */
  maxEnterpriseValidationHours?: number;
  /** Délai de traitement des remboursements (jours ouvrés) */
  refundProcessingDays?:         number;
}

/**
 * DTO — Paramètres des litiges.
 *
 * Contrôle la fenêtre de contestation et les délais de traitement.
 */
export interface UpdateDisputeDto {
  /** Fenêtre de contestation après livraison (jours) */
  disputeWindowDays?:           number;
  /** Délai max pour décision admin sur un litige (heures) */
  disputeResolutionHours?:      number;
  /** Nombre max de pièces justificatives par litige */
  maxEvidencesPerDispute?:      number;
  /** SLA d'instruction admin en heures (alerte si dépassé) */
  disputeInstructionSlaHours?:  number;
}

/**
 * DTO — Paramètres de retrait/settlement.
 *
 * Contrôle les seuils et le comportement du Settlement Engine.
 */
export interface UpdateSettlementDto {
  /** Montant minimum pour un retrait (GNF) */
  minWithdrawalAmount?:         number;
  /** Montant max par transaction (GNF) — limite haute du Settlement */
  maxTransactionAmount?:        number;
  /** Seuil au-delà duquel validation manuelle requise (GNF) */
  autoValidationThreshold?:     number;
  /** Nombre max de tentatives de payout avant blocage définitif */
  maxWithdrawalAttempts?:       number;
  /** Délai de traitement des retraits en heures (alerte si dépassé) */
  withdrawalProcessingHours?:   number;
}

/**
 * DTO — Paramètres généraux de la plateforme.
 *
 * Nom, devise, langue, timezone, mode maintenance.
 */
export interface UpdateGeneralDto {
  /** Nom commercial de la plateforme */
  platformName?:                string;
  /** Slogan ou tagline */
  platformTagline?:             string;
  /** Email de contact support */
  supportEmail?:                string;
  /** Devise principale (ex : 'GNF', 'XOF') */
  defaultCurrency?:             string;
  /** Langue par défaut ('fr' | 'en' | 'ar') */
  defaultLanguage?:             string;
  /** Fuseau horaire IANA */
  timezone?:                    string;
  /** Mode maintenance — coupe l'accès aux non-admins */
  maintenanceMode?:             boolean;
  /** Vérification email obligatoire à l'inscription */
  emailVerifRequired?:          boolean;
  /** Validation KYC obligatoire */
  kycRequired?:                 boolean;
  /** Validation manuelle des nouveaux vendeurs */
  manualVendorApproval?:        boolean;
  /** Commission globale de la plateforme (%) */
  platformCommission?:          number;
}

/* ============================================================
 * SECTION 3 — UNION DES DTO
 * ============================================================ */

/**
 * Union de tous les DTO de mise à jour.
 * Utile pour le typage générique du writer.
 */
export type AnyUpdateDto =
  | UpdateCommissionDto
  | UpdatePaymentDto
  | UpdateWalletDto
  | UpdateEscrowDto
  | UpdateDisputeDto
  | UpdateSettlementDto
  | UpdateGeneralDto;

/* ============================================================
 * SECTION 4 — CONTEXTES D'OPÉRATION
 * ============================================================ */

/**
 * Contexte complet fourni lors d'une demande de mise à jour.
 * Toutes les métadonnées nécessaires à l'audit sont incluses ici.
 */
export interface ConfigUpdateContext {
  /** Section de configuration à mettre à jour */
  section:            ConfigSection;
  /** Données à appliquer (champs optionnels selon section) */
  data:               AnyUpdateDto;
  /** Justification obligatoire — rejetée si vide ou absente */
  justification:      string;
  /** UUID de l'admin qui effectue la modification */
  performedByUserId:  string | null;
  /** Rôle de l'admin (super_admin, admin, system) */
  performedByRole:    string | null;
  /** Adresse IP si disponible via la requête HTTP */
  ipAddress?:         string | null;
  /** Libellé optionnel pour nommer cette version */
  label?:             string;
}

/**
 * Contexte d'un rollback vers une version précédente.
 */
export interface ConfigRollbackContext {
  /** Section à restaurer */
  section:            ConfigSection;
  /** Numéro de version à restaurer */
  targetVersion:      number;
  /** Justification du rollback */
  justification:      string;
  /** Admin qui effectue le rollback */
  performedByUserId:  string | null;
  performedByRole:    string | null;
  ipAddress?:         string | null;
}

/* ============================================================
 * SECTION 5 — RÉSULTATS
 * ============================================================ */

/**
 * Résultat d'une mise à jour réussie.
 * Retourné par FinancialConfigEngine.updateConfig() et les méthodes spécialisées.
 */
export interface ConfigUpdateResult {
  /** true si la mise à jour a été appliquée */
  success:        boolean;
  /** UUID du snapshot de configuration créé */
  snapshotId:     string;
  /** Numéro de version de ce snapshot */
  version:        number;
  /** Section concernée */
  section:        ConfigSection;
  /** Liste des champs effectivement modifiés */
  changedFields:  string[];
  /** Horodatage de la mise à jour */
  updatedAt:      Date;
  /** true si un nouveau CommissionRule a été créé (section COMMISSION) */
  commissionRuleCreated?: boolean;
}

/**
 * Résultat d'une lecture de configuration (toutes sections).
 * Sous-types exposant les valeurs typées par section.
 */
export interface CommissionConfig {
  tauxCommissionProduit:     number;
  planMultiplierStandard:    number;
  planMultiplierPro:         number;
  planMultiplierPremium:     number;
  ratioShopiProduit:         number;
  ratioPartenaireProduit:    number;
  ratioAdminProduit:         number;
  tauxCommissionLivraison:   number;
  ratioShopiLivraison:       number;
  ratioPartenaireLivraison:  number;
  ratioAdminLivraison:       number;
}

export interface PaymentConfig {
  orangeMoneyEnabled:        boolean;
  mtnMoneyEnabled:           boolean;
  waveEnabled:               boolean;
  moovMoneyEnabled:          boolean;
  djomyEnabled:              boolean;
  maxTransactionAmount:      number;
  maxDailyPaymentAttempts:   number;
  sessionTtlMinutes:         number;
  maxPaymentDelayHours:      number;
}

export interface WalletConfig {
  dailyWithdrawalLimit:      number;
  walletInactivityDays:      number;
  settlementDelayDays:       number;
}

export interface EscrowConfig {
  maxEnterpriseValidationHours: number;
  refundProcessingDays:         number;
}

export interface DisputeConfig {
  disputeWindowDays:         number;
  disputeResolutionHours:    number;
  maxEvidencesPerDispute:    number;
  disputeInstructionSlaHours: number;
}

export interface SettlementConfig {
  minWithdrawalAmount:       number;
  maxTransactionAmount:      number;
  autoValidationThreshold:   number;
  maxWithdrawalAttempts:     number;
  withdrawalProcessingHours: number;
}

/**
 * Entrée d'historique retournée par getHistory().
 * Version simplifiée du ConfigurationSnapshot pour exposition externe.
 */
export interface ConfigHistoryEntry {
  id:                  string;
  section:             ConfigSection;
  version:             number;
  label:               string | null;
  changedFields:       string[];
  before:              Record<string, unknown> | null;
  after:               Record<string, unknown>;
  justification:       string;
  performedByUserId:   string | null;
  performedByRole:     string | null;
  ipAddress:           string | null;
  isRollback:          boolean;
  rolledBackToVersion: number | null;
  createdAt:           Date;
}

/* ============================================================
 * SECTION 6 — MAPPING SECTION → CHAMPS PLATFORM_SETTINGS
 *
 * Définit quels champs de PlatformSettings appartiennent
 * à quelle section. Utilisé par le writer pour construire
 * le diff avant/après et par le validator pour la validation.
 * ============================================================ */

export const SECTION_FIELDS: Readonly<Record<ConfigSection, ReadonlyArray<string>>> = {
  [ConfigSection.COMMISSION]: [
    'tauxCommissionProduit', 'planMultiplierPro', 'planMultiplierPremium',
    'ratioShopiProduit', 'ratioPartenaireProduit', 'ratioAdminProduit',
    'tauxCommissionLivraison', 'ratioShopiLivraison', 'ratioPartenaireLivraison',
    'ratioAdminLivraison',
  ],
  [ConfigSection.PAYMENT]: [
    'orangeMoneyEnabled', 'mtnMoneyEnabled', 'waveEnabled', 'moovMoneyEnabled', 'djomyEnabled',
    'maxTransactionAmount', 'maxDailyPaymentAttempts', 'sessionTtlMinutes', 'maxPaymentDelayHours',
  ],
  [ConfigSection.WALLET]: [
    'dailyWithdrawalLimit', 'walletInactivityDays', 'settlementDelayDays',
  ],
  [ConfigSection.ESCROW]: [
    'maxEnterpriseValidationHours', 'refundProcessingDays',
  ],
  [ConfigSection.DISPUTE]: [
    'disputeWindowDays', 'disputeResolutionHours',
    'maxEvidencesPerDispute', 'disputeInstructionSlaHours',
  ],
  [ConfigSection.SETTLEMENT]: [
    'minWithdrawalAmount', 'maxTransactionAmount',
    'autoValidationThreshold', 'maxWithdrawalAttempts', 'withdrawalProcessingHours',
  ],
  [ConfigSection.GENERAL]: [
    'platformName', 'platformTagline', 'supportEmail',
    'defaultCurrency', 'defaultLanguage', 'timezone',
    'maintenanceMode', 'emailVerifRequired', 'kycRequired',
    'manualVendorApproval', 'platformCommission',
  ],
};
