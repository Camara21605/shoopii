/* ============================================================
 * FICHIER      : src/modules/platform-security/types/security.types.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Interfaces, DTOs et types partagés du moteur de sécurité,
 * conformité, monitoring et fiabilité de Shopi.
 *
 * CONVENTION
 * ─────────────────────────────────────────────────────────────
 * Ce fichier contient UNIQUEMENT des types (zéro logique).
 * Il est importé par tous les services du module.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { SecurityEventType, SecuritySeverity } from '../../../database/entities/security/security-event-log.entity';
import { IncidentSeverity, IncidentStatus }     from '../../../database/entities/security/platform-incident.entity';

/* re-export pour éviter de doubler les imports dans les consommateurs */
export { SecurityEventType, SecuritySeverity, IncidentSeverity, IncidentStatus };

/* ============================================================
 * HEALTH CHECKS
 * ============================================================ */

/**
 * État d'un composant unique lors d'un health check actif.
 */
export interface ComponentHealth {
  /** Nom du composant (database, redis, event-bus, queue, ...) */
  name: string;
  /** État opérationnel */
  status: 'healthy' | 'degraded' | 'down';
  /** Latence mesurée (ms) — null si non applicable */
  latencyMs: number | null;
  /** Informations complémentaires libres */
  details?: Record<string, unknown>;
  /** Horodatage du check */
  checkedAt: Date;
  /** Message d'erreur si status != 'healthy' */
  error?: string;
}

/**
 * Rapport complet de santé de la plateforme.
 * Agrège tous les checks des composants.
 */
export interface HealthReport {
  /**
   * État global calculé :
   *   'healthy'  — tous les composants sont opérationnels
   *   'degraded' — au moins un composant est dégradé
   *   'down'     — au moins un composant critique est hors service
   */
  overall: 'healthy' | 'degraded' | 'down';
  components: ComponentHealth[];
  /** Durée totale de l'ensemble des checks (ms) */
  totalCheckMs: number;
  timestamp: Date;
}

/* ============================================================
 * MÉTRIQUES
 * ============================================================ */

/**
 * Instantané des métriques système en temps réel.
 * Produit par MetricsCollectorService.getSnapshot().
 */
export interface MetricsSnapshot {
  timestamp: Date;
  process: {
    uptimeMs:        number;
    memoryUsedMb:    number;
    memoryHeapTotalMb: number;
    memoryUsedPct:   number;
    rssMb:           number;
  };
  http: {
    totalRequests:  number;
    activeRequests: number;
    errorCount:     number;
    errorRatePct:   number;
    avgDurationMs:  number;
  };
  events: {
    published:      number;
    consumed:       number;
    failed:         number;
    dlqSize:        number;
    failureRatePct: number;
  };
}

/* ============================================================
 * ALERTES
 * ============================================================ */

/**
 * DTO pour déclencher une alerte.
 * Envoyé par les services qui détectent une anomalie.
 */
export interface AlertTrigger {
  /** Identifiant unique de la règle d'alerte (sert à la déduplication). */
  ruleId: string;
  severity: SecuritySeverity;
  /** Composant à l'origine de l'alerte (database, paiement, ...) */
  component: string;
  /** Message lisible décrivant l'anomalie. */
  message: string;
  /** Données contextuelles supplémentaires. */
  metadata?: Record<string, unknown>;
}

/**
 * Alerte active dans le gestionnaire d'alertes.
 */
export interface ActiveAlert {
  id: string;
  ruleId: string;
  severity: SecuritySeverity;
  component: string;
  message: string;
  metadata?: Record<string, unknown>;
  triggeredAt: Date;
  lastSeenAt:  Date;
  count:       number; // nombre de fois déclenchée (déduplication)
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

/* ============================================================
 * INCIDENTS
 * ============================================================ */

/**
 * DTO pour ouvrir un incident.
 */
export interface OpenIncidentDto {
  title: string;
  description: string;
  severity: IncidentSeverity;
  affectedComponents: string[];
  detectedAt?: Date;
  createdBy?: string;
}

/**
 * DTO pour mettre à jour un incident.
 */
export interface UpdateIncidentDto {
  title?:              string;
  description?:        string;
  severity?:           IncidentSeverity;
  status?:             IncidentStatus;
  affectedComponents?: string[];
  rootCause?:          string;
  remediation?:        string;
}

/** Filtre pour la liste des incidents. */
export interface IncidentFilter {
  status?:    IncidentStatus;
  severity?:  IncidentSeverity;
  from?:      Date;
  to?:        Date;
  limit?:     number;
}

/* ============================================================
 * OBSERVABILITÉ / TRACING
 * ============================================================ */

/**
 * Span de tracing représentant une opération unitaire.
 * Rattaché à un correlationId HTTP ou à un eventId.
 */
export interface Span {
  /** Identifiant unique du span (UUID v4). */
  spanId: string;
  /** Identifiant de corrélation de la requête parente. */
  correlationId: string;
  /** Nom de l'opération (ex: 'WalletEngine.credit', 'paiement.confirm'). */
  operationName: string;
  /** Timestamp de démarrage (ms depuis epoch). */
  startedAt: number;
  /** Timestamp de fin. Absent si le span est encore ouvert. */
  endedAt?: number;
  /** Durée calculée à la fin du span. */
  durationMs?: number;
  /** Résultat de l'opération. */
  result?: 'success' | 'error';
  /** Métadonnées libres (paramètres, résultat, erreur). */
  metadata?: Record<string, unknown>;
}

/**
 * Trace complète d'une opération de bout en bout.
 * Agrège tous les spans d'un même correlationId.
 */
export interface TransactionTrace {
  correlationId: string;
  /** Durée totale calculée du premier span au dernier. */
  totalDurationMs: number;
  spans: Span[];
  /** 'in_progress' si au moins un span est encore ouvert. */
  status: 'success' | 'error' | 'in_progress';
  /** Nombre de spans en erreur. */
  errorCount: number;
}

/* ============================================================
 * ANOMALY DETECTION
 * ============================================================ */

/**
 * Résultat d'une vérification d'anomalie.
 */
export interface AnomalyResult {
  /** true si une anomalie a été détectée. */
  isAnomaly: boolean;
  /** Raison de la détection. */
  reason?: string;
  /** Niveau de criticité si anomalie. */
  severity?: SecuritySeverity;
  /** Données de contexte. */
  metadata?: Record<string, unknown>;
}

/* ============================================================
 * CONFORMITÉ
 * ============================================================ */

/**
 * Politique de conservation des données.
 * Configurable via PlatformSettings.dataRetentionYears.
 */
export interface RetentionPolicy {
  financialAuditLogsYears: number;
  securityEventsYears:     number;
  metricsRetentionDays:    number;
  incidentsRetentionYears: number;
  generalAuditLogsYears:   number;
}

/**
 * Résultat d'une vérification de conformité de rétention.
 */
export interface RetentionCheckResult {
  checkedAt: Date;
  tables: Array<{
    name: string;
    retentionYears: number;
    recordsToArchive: number;
    oldestRecord?: Date;
  }>;
  totalRecordsToArchive: number;
}

/**
 * Rapport de conformité périodique.
 */
export interface ComplianceReport {
  generatedAt: Date;
  period: { from: Date; to: Date };
  securityEvents: {
    total:          number;
    bySeverity:     Record<string, number>;
    byType:         Record<string, number>;
    topIps:         Array<{ ip: string; count: number }>;
  };
  incidents: {
    total:          number;
    bySeverity:     Record<string, number>;
    avgResolutionHours: number | null;
    openCount:      number;
  };
  retention: RetentionCheckResult;
  recommendations: string[];
}

/* ============================================================
 * SAUVEGARDES & REPRISE
 * ============================================================ */

/**
 * Stratégie de sauvegarde documentée.
 */
export interface BackupStrategy {
  database: {
    frequency:      string; // 'daily' | 'hourly'
    type:           'full' | 'incremental';
    retentionDays:  number;
    tool:           string;
    location:       string;
    description:    string;
  };
  files: {
    frequency:      string;
    retentionDays:  number;
    tool:           string;
    location:       string;
    description:    string;
  };
  /** Objectif de point de reprise (Recovery Point Objective) en heures */
  rpoHours: number;
  /** Objectif de temps de reprise (Recovery Time Objective) en heures */
  rtoHours: number;
  contacts: string[];
  lastUpdated: string; // ISO date
}

/**
 * Plan de reprise après incident.
 */
export interface DisasterRecoveryPlan {
  steps: Array<{
    order:       number;
    title:       string;
    description: string;
    responsible: string;
    estimatedMinutes: number;
  }>;
  escalation: {
    level1: string;
    level2: string;
    level3: string;
  };
  communicationTemplate: string;
}

/* ============================================================
 * LOGS DE SÉCURITÉ — DTOs
 * ============================================================ */

/**
 * DTO pour créer un événement de sécurité.
 */
export interface LogSecurityEventDto {
  eventType:     SecurityEventType;
  severity:      SecuritySeverity;
  actorId?:      string;
  actorRole?:    string;
  ipAddress?:    string;
  userAgent?:    string;
  resource?:     string;
  action?:       string;
  correlationId?: string;
  details?:      Record<string, unknown>;
}

/** Filtre pour la liste des événements de sécurité. */
export interface SecurityEventFilter {
  eventType?: SecurityEventType;
  severity?:  SecuritySeverity;
  actorId?:   string;
  ipAddress?: string;
  from?:      Date;
  to?:        Date;
  limit?:     number;
}

/** Résumé de sécurité pour le tableau de bord admin. */
export interface SecuritySummary {
  last24hEvents:    number;
  criticalEvents:   number;
  activeAlerts:     number;
  openIncidents:    number;
  bruteForceBlocks: number;
  anomaliesDetected: number;
}
