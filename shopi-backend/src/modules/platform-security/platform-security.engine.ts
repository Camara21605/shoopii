/* ============================================================
 * FICHIER      : src/modules/platform-security/platform-security.engine.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Façade publique du moteur de sécurité, conformité, monitoring
 * et fiabilité de Shopi.
 *
 * PRINCIPE
 * ─────────────────────────────────────────────────────────────
 * Les modules externes n'importent JAMAIS les services internes
 * directement. Ils passent uniquement par PlatformSecurityEngine.
 *
 * Cela garantit :
 *   - Encapsulation de l'implémentation
 *   - Point d'entrée unique pour l'instrumentation transversale
 *   - Facilité de test (mock un seul service)
 *
 * EXPORT
 * ─────────────────────────────────────────────────────────────
 * Ce service est exporté par PlatformSecurityModule.
 * Importez PlatformSecurityModule dans votre module pour y accéder.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';

import { SecurityEventService }    from './services/security-event.service';
import { MetricsCollectorService } from './services/metrics-collector.service';
import { DeepHealthService }       from './services/deep-health.service';
import { AlertManagerService }     from './services/alert-manager.service';
import { IncidentManagerService }  from './services/incident-manager.service';
import { ComplianceService }       from './services/compliance.service';
import { ObservabilityService }    from './services/observability.service';
import { AnomalyDetectorService }  from './services/anomaly-detector.service';
import { BackupStrategyService }   from './services/backup-strategy.service';

import {
  LogSecurityEventDto,
  SecurityEventFilter,
  MetricsSnapshot,
  HealthReport,
  AlertTrigger,
  ActiveAlert,
  OpenIncidentDto,
  UpdateIncidentDto,
  IncidentFilter,
  RetentionPolicy,
  ComplianceReport,
  BackupStrategy,
  DisasterRecoveryPlan,
  AnomalyResult,
  TransactionTrace,
  SecuritySummary,
} from './types/security.types';

import { SecurityEventLog }  from '../../database/entities/security/security-event-log.entity';
import { PlatformIncident }  from '../../database/entities/security/platform-incident.entity';

/* ============================================================
 * FAÇADE
 * ============================================================ */

@Injectable()
export class PlatformSecurityEngine {

  constructor(
    private readonly secEvent:  SecurityEventService,
    private readonly metrics:   MetricsCollectorService,
    private readonly health:    DeepHealthService,
    private readonly alerts:    AlertManagerService,
    private readonly incidents: IncidentManagerService,
    private readonly compliance: ComplianceService,
    private readonly obs:       ObservabilityService,
    private readonly anomaly:   AnomalyDetectorService,
    private readonly backup:    BackupStrategyService,
  ) {}

  /* ==========================================================
   * SÉCURITÉ — JOURNALISATION
   * ========================================================== */

  /** Persiste un événement de sécurité. */
  async logSecurityEvent(dto: LogSecurityEventDto): Promise<SecurityEventLog | null> {
    return this.secEvent.log(dto);
  }

  /** Persiste un événement de sécurité de manière fire-and-forget. */
  logSecurityEventAsync(dto: LogSecurityEventDto): void {
    this.secEvent.logAsync(dto);
  }

  /** Récupère les événements de sécurité avec filtres. */
  async getSecurityEvents(filter?: SecurityEventFilter): Promise<SecurityEventLog[]> {
    return this.secEvent.getEvents(filter);
  }

  /** Résumé de sécurité pour le tableau de bord. */
  async getSecuritySummary(): Promise<SecuritySummary> {
    const partial = await this.secEvent.getSummary();
    return {
      ...partial,
      activeAlerts:  this.alerts.getActiveCount(),
      openIncidents: await this.incidents.countOpen(),
    };
  }

  /* ==========================================================
   * MONITORING — MÉTRIQUES
   * ========================================================== */

  /** Retourne l'instantané des métriques en temps réel. */
  getMetricsSnapshot(): MetricsSnapshot {
    return this.metrics.getSnapshot();
  }

  /**
   * Enregistre une requête HTTP complétée.
   * Appelé depuis un intercepteur NestJS global.
   */
  recordRequest(statusCode: number, durationMs: number): void {
    this.metrics.recordRequest(statusCode, durationMs);
  }

  /** Incrémente le compteur de requêtes actives. */
  incrementActiveRequest(): void {
    this.metrics.incrementActive();
  }

  /** Décrémente le compteur de requêtes actives. */
  decrementActiveRequest(): void {
    this.metrics.decrementActive();
  }

  /* ==========================================================
   * HEALTH CHECKS
   * ========================================================== */

  /** Exécute un health check complet de tous les composants. */
  async checkHealth(): Promise<HealthReport> {
    return this.health.checkAll();
  }

  /* ==========================================================
   * ALERTES
   * ========================================================== */

  /** Déclenche ou met à jour une alerte. */
  triggerAlert(trigger: AlertTrigger): ActiveAlert {
    return this.alerts.trigger(trigger);
  }

  /** Résout une alerte par son ruleId. */
  resolveAlert(ruleId: string, resolvedBy?: string): boolean {
    return this.alerts.resolve(ruleId, resolvedBy);
  }

  /** Acquitte une alerte. */
  acknowledgeAlert(ruleId: string, acknowledgedBy: string): boolean {
    return this.alerts.acknowledge(ruleId, acknowledgedBy);
  }

  /** Retourne toutes les alertes actives. */
  getActiveAlerts(): ActiveAlert[] {
    return this.alerts.getActiveAlerts();
  }

  /** Retourne le nombre d'alertes actives. */
  getAlertCount(): number {
    return this.alerts.getActiveCount();
  }

  /* ==========================================================
   * INCIDENTS
   * ========================================================== */

  /** Ouvre un nouvel incident. */
  async openIncident(dto: OpenIncidentDto): Promise<PlatformIncident> {
    return this.incidents.open(dto);
  }

  /** Met à jour un incident. */
  async updateIncident(id: string, dto: UpdateIncidentDto, actor?: string): Promise<PlatformIncident> {
    return this.incidents.update(id, dto, actor);
  }

  /** Ajoute une entrée de timeline à un incident. */
  async addIncidentTimeline(id: string, message: string, actor?: string): Promise<void> {
    return this.incidents.addTimeline(id, message, actor);
  }

  /** Résout un incident avec cause racine et remédiation. */
  async resolveIncident(
    id:          string,
    rootCause:   string,
    remediation: string,
    resolvedBy:  string,
  ): Promise<PlatformIncident> {
    return this.incidents.resolve(id, rootCause, remediation, resolvedBy);
  }

  /** Clôture un incident. */
  async closeIncident(id: string, actor?: string): Promise<PlatformIncident> {
    return this.incidents.close(id, actor);
  }

  /** Liste les incidents avec filtres. */
  async listIncidents(filter?: IncidentFilter): Promise<PlatformIncident[]> {
    return this.incidents.list(filter);
  }

  /** Retourne un incident par ID. */
  async getIncident(id: string): Promise<PlatformIncident> {
    return this.incidents.findOrFail(id);
  }

  /* ==========================================================
   * OBSERVABILITÉ / TRACING
   * ========================================================== */

  /**
   * Démarre un span de tracing.
   * Retourne le spanId à passer à endSpan().
   */
  startSpan(correlationId: string, operationName: string): string {
    return this.obs.startSpan(correlationId, operationName);
  }

  /** Clôture un span avec résultat. */
  endSpan(
    correlationId: string,
    spanId:        string,
    result:        'success' | 'error',
    metadata?:     Record<string, unknown>,
  ): void {
    this.obs.endSpan(correlationId, spanId, result, metadata);
  }

  /** Retourne la trace complète pour un correlationId. */
  getTrace(correlationId: string): TransactionTrace | null {
    return this.obs.getTrace(correlationId);
  }

  /* ==========================================================
   * DÉTECTION D'ANOMALIES
   * ========================================================== */

  /** Enregistre une tentative de connexion échouée et vérifie le brute force. */
  recordFailedLogin(actorId: string, ipAddress: string): AnomalyResult {
    return this.anomaly.recordFailedLogin(actorId, ipAddress);
  }

  /** Enregistre un retrait et vérifie s'il est anormal. */
  recordWithdrawal(userId: string, amount: number): AnomalyResult {
    return this.anomaly.recordWithdrawal(userId, amount);
  }

  /** Enregistre un paiement confirmé (pour la détection pic remboursements). */
  recordPayment(): void {
    this.anomaly.recordPayment();
  }

  /** Enregistre un remboursement et vérifie le taux de remboursements. */
  recordRefund(): AnomalyResult {
    return this.anomaly.recordRefund();
  }

  /* ==========================================================
   * CONFORMITÉ
   * ========================================================== */

  /** Retourne la politique de rétention des données. */
  getRetentionPolicy(): RetentionPolicy {
    return this.compliance.getRetentionPolicy();
  }

  /** Lance une vérification de conformité de rétention. */
  async runRetentionCheck() {
    return this.compliance.runRetentionCheck();
  }

  /**
   * Génère un rapport de conformité complet.
   * @param period — Période à analyser (défaut : 30 derniers jours)
   */
  async generateComplianceReport(period?: { from: Date; to: Date }): Promise<ComplianceReport> {
    const to   = period?.to   ?? new Date();
    const from = period?.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return this.compliance.generateComplianceReport({ from, to });
  }

  /* ==========================================================
   * SAUVEGARDES
   * ========================================================== */

  /** Retourne la stratégie de sauvegarde documentée. */
  getBackupStrategy(): BackupStrategy {
    return this.backup.getStrategy();
  }

  /** Retourne le plan de reprise après incident. */
  getDisasterRecoveryPlan(): DisasterRecoveryPlan {
    return this.backup.getDisasterRecoveryPlan();
  }

  /** Retourne la checklist de vérification des sauvegardes. */
  getBackupChecklist() {
    return this.backup.getVerificationChecklist();
  }
}
