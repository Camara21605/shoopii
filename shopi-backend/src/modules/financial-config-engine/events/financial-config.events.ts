/* ============================================================
 * FICHIER      : src/modules/financial-config-engine/events/financial-config.events.ts
 * MODULE       : FinancialConfigEngine
 * ROLE         : Classes d'événements émis par le FinancialConfigEngine.
 *                Chaque modification de configuration produit un événement
 *                structuré consommable par tout module abonné.
 * RESPONSABILITES :
 *   - Définir les 6 classes d'événements de configuration
 *   - Définir la constante FINANCIAL_CONFIG_EVENTS (noms d'événements)
 * DEPENDANCES  : ConfigSection, ConfigUpdateResult (financial-config.types)
 * PRODUCTEURS  : FinancialConfigWriterService (via FinancialConfigEventBus)
 * CONSOMMATEURS :
 *   CommissionEngine → écoute CONFIG_COMMISSION_CHANGED
 *   SettlementEngine → écoute CONFIG_SETTLEMENT_CHANGED
 *   Modules admin    → écoutent CONFIG_UPDATED pour dashboard en temps réel
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { ConfigSection } from '../../../database/entities/paiement/configuration-snapshot.entity';

/* ============================================================
 * NOMS D'ÉVÉNEMENTS
 * ============================================================ */

/**
 * Constante centrale des noms d'événements du FinancialConfigEngine.
 * Utiliser ces constantes (jamais les chaînes brutes) pour s'abonner.
 */
export const FINANCIAL_CONFIG_EVENTS = {
  /** Émis lors de toute mise à jour réussie d'une section quelconque */
  CONFIG_UPDATED:              'financial_config.updated',
  /** Émis spécifiquement lors d'un changement de section COMMISSION */
  CONFIG_COMMISSION_CHANGED:   'financial_config.commission.changed',
  /** Émis lors d'un changement de section PAYMENT */
  CONFIG_PAYMENT_CHANGED:      'financial_config.payment.changed',
  /** Émis lors d'un changement de section WALLET */
  CONFIG_WALLET_CHANGED:       'financial_config.wallet.changed',
  /** Émis lors d'un changement de section SETTLEMENT */
  CONFIG_SETTLEMENT_CHANGED:   'financial_config.settlement.changed',
  /** Émis lors d'un rollback vers une version précédente */
  CONFIG_ROLLED_BACK:          'financial_config.rolled_back',
} as const;

export type FinancialConfigEventName =
  (typeof FINANCIAL_CONFIG_EVENTS)[keyof typeof FINANCIAL_CONFIG_EVENTS];

/* ============================================================
 * CLASSES D'ÉVÉNEMENTS
 * ============================================================ */

/**
 * Événement générique émis lors de toute mise à jour de configuration.
 * Contient les informations minimales pour logguer et réagir.
 */
export class ConfigUpdatedEvent {
  constructor(
    /** Section concernée */
    public readonly section:           ConfigSection,
    /** Numéro de la nouvelle version */
    public readonly version:           number,
    /** UUID du snapshot créé */
    public readonly snapshotId:        string,
    /** Champs modifiés */
    public readonly changedFields:     string[],
    /** Auteur de la modification */
    public readonly performedByUserId: string | null,
    /** Date de la modification */
    public readonly updatedAt:         Date,
  ) {}
}

/**
 * Événement émis spécifiquement lors d'un changement des règles de commission.
 * Les moteurs de calcul (CommissionEngine) doivent s'y abonner pour invalider
 * leurs caches internes ou mettre à jour leur règle active.
 */
export class CommissionConfigChangedEvent {
  constructor(
    public readonly snapshotId:         string,
    /** UUID du nouveau CommissionRule créé en conséquence */
    public readonly commissionRuleId:   string,
    /** Nouveaux taux de commission produit/livraison */
    public readonly newValues:          Record<string, unknown>,
    public readonly performedByUserId:  string | null,
    public readonly updatedAt:          Date,
  ) {}
}

/**
 * Événement émis lors d'un changement des paramètres de paiement.
 * Permet aux modules de paiement de mettre à jour la liste des providers actifs.
 */
export class PaymentConfigChangedEvent {
  constructor(
    public readonly snapshotId:         string,
    /** État d'activation de chaque provider après la mise à jour */
    public readonly activeProviders:    Record<string, boolean>,
    public readonly performedByUserId:  string | null,
    public readonly updatedAt:          Date,
  ) {}
}

/**
 * Événement émis lors d'un changement des paramètres de wallet.
 * Utilisé pour synchroniser les limites de retrait dans WalletEngine.
 */
export class WalletConfigChangedEvent {
  constructor(
    public readonly snapshotId:         string,
    public readonly newValues:          Record<string, unknown>,
    public readonly performedByUserId:  string | null,
    public readonly updatedAt:          Date,
  ) {}
}

/**
 * Événement émis lors d'un changement des paramètres de settlement.
 * SettlementEngine peut s'y abonner pour mettre à jour ses seuils.
 */
export class SettlementConfigChangedEvent {
  constructor(
    public readonly snapshotId:         string,
    public readonly newValues:          Record<string, unknown>,
    public readonly performedByUserId:  string | null,
    public readonly updatedAt:          Date,
  ) {}
}

/**
 * Événement émis lors d'un rollback vers une version précédente.
 * Tous les moteurs peuvent réagir pour recharger leur configuration.
 */
export class ConfigRolledBackEvent {
  constructor(
    public readonly section:            ConfigSection,
    /** Version vers laquelle on a restauré */
    public readonly targetVersion:      number,
    /** Version créée par le rollback (toujours la plus récente) */
    public readonly newVersion:         number,
    public readonly snapshotId:         string,
    public readonly performedByUserId:  string | null,
    public readonly updatedAt:          Date,
  ) {}
}
