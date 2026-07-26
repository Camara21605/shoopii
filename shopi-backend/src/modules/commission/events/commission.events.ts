/* ============================================================
 * FICHIER : src/modules/commission/events/commission.events.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Définit tous les événements émis par le Commission Engine
 * via EventEmitter2 (NestJS Event Bus).
 *
 * PATTERN
 * ─────────────────────────────────────────────────────────────
 * Chaque événement est une classe typée.
 * Le nom de l'événement suit la convention :
 *   "commission.<action>" (ex: "commission.calculated")
 *
 * ABONNÉS TYPIQUES
 * ─────────────────────────────────────────────────────────────
 *  NotificationsModule  → commission.calculated → notif acteurs
 *  AdminModule          → commission.failed → alerte admin
 *  AuditModule          → tous les événements → log financier
 *  DashboardModule      → commission.calculated → stats temps réel
 *
 * UTILISATION
 * ─────────────────────────────────────────────────────────────
 * Émission (dans CommissionEngine) :
 *   this.eventEmitter.emit('commission.calculated', new CommissionCalculatedEvent(...));
 *
 * Réception (dans un service abonné) :
 *   @OnEvent('commission.calculated')
 *   handleCalculated(event: CommissionCalculatedEvent) { ... }
 *
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/modules/commission/events/commission.events.ts
 * ============================================================ */

import { CommissionResult, CommissionContext, CommissionErreurType } from '../types/commission.types';

/* ============================================================
 * NOMS DES ÉVÉNEMENTS (constantes)
 * ============================================================ */

export const COMMISSION_EVENTS = {
  /** Calcul réussi — toutes les parts ont été déterminées */
  CALCULATED:            'commission.calculated',
  /** Distribution préparée — parts transmises au module wallet */
  DISTRIBUTED:           'commission.distributed',
  /** Calcul ou distribution échoué */
  FAILED:                'commission.failed',
  /** Un Super Admin a modifié la configuration des taux */
  CONFIGURATION_CHANGED: 'commission.configuration_changed',
  /** Une nouvelle CommissionRule est devenue active */
  RULE_ACTIVATED:        'commission.rule_activated',
  /** Une CommissionRule a été désactivée */
  RULE_DISABLED:         'commission.rule_disabled',
} as const;

export type CommissionEventName = typeof COMMISSION_EVENTS[keyof typeof COMMISSION_EVENTS];

/* ============================================================
 * EVENT : commission.calculated
 * ============================================================ */

/**
 * Émis lorsque le moteur a terminé un calcul de commission avec succès.
 *
 * Contient le résultat complet incluant toutes les parts,
 * la hiérarchie résolue et le snapshot des taux.
 *
 * Utilisé par :
 *   - NotificationsModule → notifier les acteurs de l'escrow
 *   - DashboardModule → mettre à jour les stats en temps réel
 */
export class CommissionCalculatedEvent {
  readonly eventName = COMMISSION_EVENTS.CALCULATED;
  readonly occurredAt = new Date();

  constructor(
    /** Contexte de la commande ayant déclenché le calcul */
    public readonly context:  CommissionContext,
    /** Résultat complet du calcul */
    public readonly result:   CommissionResult,
  ) {}
}

/* ============================================================
 * EVENT : commission.distributed
 * ============================================================ */

/**
 * Émis après que le module appelant (PaiementWebhookService) a
 * persisté les PaiementDistribution records en base.
 *
 * NOTE : Le Commission Engine ne persiste rien. C'est le module
 * appelant qui émet cet événement après avoir sauvegardé les données.
 *
 * Utilisé par :
 *   - FinancialAuditLog → enregistrer la distribution complète
 *   - DashboardModule → statistiques de commissions distribuées
 */
export class CommissionDistributedEvent {
  readonly eventName = COMMISSION_EVENTS.DISTRIBUTED;
  readonly occurredAt = new Date();

  constructor(
    /** UUID de la commande */
    public readonly commandeId:     string,
    /** Référence lisible */
    public readonly commandeNumero: string,
    /** Résultat du calcul utilisé */
    public readonly result:         CommissionResult,
    /** Liste des UUIDs PaiementDistribution créés */
    public readonly distributionIds: string[],
  ) {}
}

/* ============================================================
 * EVENT : commission.failed
 * ============================================================ */

/**
 * Émis quand le calcul ou la validation échoue.
 *
 * Permet à l'AdminModule de déclencher une alerte et au service
 * d'audit de logguer un événement CRITICAL dans FinancialAuditLog.
 *
 * Utilisé par :
 *   - AdminModule → alerte admin
 *   - FinancialAuditLog → severity CRITICAL
 */
export class CommissionFailedEvent {
  readonly eventName = COMMISSION_EVENTS.FAILED;
  readonly occurredAt = new Date();

  constructor(
    /** Contexte de la commande en erreur */
    public readonly context:      CommissionContext,
    /** Type d'erreur du moteur */
    public readonly erreurType:   CommissionErreurType,
    /** Message d'erreur lisible */
    public readonly erreurMessage: string,
    /** Données supplémentaires (stacktrace, valeurs impliquées) */
    public readonly metadata?:    Record<string, unknown>,
  ) {}
}

/* ============================================================
 * EVENT : commission.configuration_changed
 * ============================================================ */

/**
 * Émis quand un Super Admin modifie les taux de commission
 * dans PlatformSettings.
 *
 * Déclenche la création d'une nouvelle CommissionRule versionnée.
 *
 * Utilisé par :
 *   - CommissionConfigService → crée une nouvelle CommissionRule
 *   - FinancialAuditLog → severity HIGH
 *   - AdminModule → notif Super Admin (confirmation de changement)
 */
export class CommissionConfigurationChangedEvent {
  readonly eventName = COMMISSION_EVENTS.CONFIGURATION_CHANGED;
  readonly occurredAt = new Date();

  constructor(
    /** UUID du Super Admin ayant effectué le changement */
    public readonly changedByUserId: string,
    /** Valeurs des taux avant modification */
    public readonly before:          Record<string, number>,
    /** Valeurs des taux après modification */
    public readonly after:           Record<string, number>,
    /** Note de changement fournie par le Super Admin */
    public readonly note?:           string,
  ) {}
}

/* ============================================================
 * EVENT : commission.rule_activated
 * ============================================================ */

/**
 * Émis quand une nouvelle CommissionRule devient active.
 *
 * Utilisé par :
 *   - FinancialAuditLog → COMMISSION_RULE_CHANGED
 *   - AdminModule → log d'audit admin
 */
export class CommissionRuleActivatedEvent {
  readonly eventName = COMMISSION_EVENTS.RULE_ACTIVATED;
  readonly occurredAt = new Date();

  constructor(
    /** UUID de la nouvelle règle active */
    public readonly ruleId:          string,
    /** Numéro de version de cette règle */
    public readonly version:         number,
    /** UUID de l'ancienne règle désactivée (null si première règle) */
    public readonly previousRuleId:  string | null,
    /** UUID du Super Admin */
    public readonly activatedByUserId: string | null,
  ) {}
}

/* ============================================================
 * EVENT : commission.rule_disabled
 * ============================================================ */

/**
 * Émis quand une CommissionRule est désactivée.
 * Toujours suivi d'un commission.rule_activated pour la nouvelle règle.
 *
 * Utilisé par :
 *   - FinancialAuditLog → audit trail du versionnage
 */
export class CommissionRuleDisabledEvent {
  readonly eventName = COMMISSION_EVENTS.RULE_DISABLED;
  readonly occurredAt = new Date();

  constructor(
    /** UUID de la règle désactivée */
    public readonly ruleId:           string,
    /** Numéro de version */
    public readonly version:          number,
    /** UUID du Super Admin */
    public readonly disabledByUserId: string | null,
  ) {}
}
