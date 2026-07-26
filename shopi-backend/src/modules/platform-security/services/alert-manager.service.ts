/* ============================================================
 * FICHIER      : src/modules/platform-security/services/alert-manager.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Gestionnaire d'alertes techniques et de sécurité.
 * Maintient une liste d'alertes actives en mémoire avec déduplication
 * par ruleId, et persiste l'historique dans security_event_logs.
 *
 * DÉDUPLICATION
 * ─────────────────────────────────────────────────────────────
 * Si la même ruleId est déclenchée plusieurs fois, l'alerte existante
 * est mise à jour (lastSeenAt, count++) plutôt que dupliquée.
 * Cela évite le "alert fatigue" en production.
 *
 * CYCLE DE VIE D'UNE ALERTE
 * ─────────────────────────────────────────────────────────────
 * trigger() → alerte active (Map)
 * resolve() → alerte supprimée de la Map + log ALERT_RESOLVED
 *
 * PERSISTANCE
 * ─────────────────────────────────────────────────────────────
 * Chaque déclenchement et résolution est persisté dans
 * security_event_logs via SecurityEventService.
 * La liste active est uniquement in-memory (redémarrage = reset).
 *
 * DÉPENDANCES
 * ─────────────────────────────────────────────────────────────
 *   SecurityEventService → log() pour la persistance
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID }         from 'crypto';

import { SecurityEventService }               from './security-event.service';
import { SecurityEventType, SecuritySeverity } from '../../../database/entities/security/security-event-log.entity';
import { AlertTrigger, ActiveAlert }           from '../types/security.types';

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class AlertManagerService {

  private readonly logger = new Logger(AlertManagerService.name);

  /**
   * Alertes actives indexées par ruleId.
   * Une seule alerte active par règle à un instant donné.
   */
  private readonly activeAlerts = new Map<string, ActiveAlert>();

  constructor(private readonly securityEvent: SecurityEventService) {}

  /* ==========================================================
   * DÉCLENCHEMENT
   * ========================================================== */

  /**
   * Déclenche ou met à jour une alerte.
   * Si l'alerte existe déjà pour ce ruleId :
   *   → lastSeenAt est mis à jour
   *   → count est incrémenté
   * Si elle n'existe pas → nouvelle alerte créée.
   */
  trigger(trigger: AlertTrigger): ActiveAlert {
    const existing = this.activeAlerts.get(trigger.ruleId);

    if (existing) {
      /* Mise à jour de l'alerte existante — déduplication */
      existing.lastSeenAt = new Date();
      existing.count++;
      existing.message    = trigger.message; // peut changer d'une occurrence à l'autre
      existing.metadata   = trigger.metadata;

      this.logger.warn(
        `[AlertManager] Alerte mise à jour — ruleId=${trigger.ruleId} ` +
        `component=${trigger.component} count=${existing.count}`,
      );

      return existing;
    }

    /* Nouvelle alerte */
    const alert: ActiveAlert = {
      id:          randomUUID(),
      ruleId:      trigger.ruleId,
      severity:    trigger.severity,
      component:   trigger.component,
      message:     trigger.message,
      metadata:    trigger.metadata,
      triggeredAt: new Date(),
      lastSeenAt:  new Date(),
      count:       1,
    };

    this.activeAlerts.set(trigger.ruleId, alert);

    this.logger.warn(
      `[AlertManager] Nouvelle alerte — ruleId=${trigger.ruleId} ` +
      `severity=${trigger.severity} component=${trigger.component}`,
    );

    /* Persistance fire-and-forget */
    this.securityEvent.logAsync({
      eventType: SecurityEventType.ALERT_TRIGGERED,
      severity:  trigger.severity,
      resource:  trigger.component,
      action:    'alert_triggered',
      details: {
        ruleId:    trigger.ruleId,
        alertId:   alert.id,
        message:   trigger.message,
        metadata:  trigger.metadata,
      },
    });

    return alert;
  }

  /* ==========================================================
   * RÉSOLUTION
   * ========================================================== */

  /**
   * Résout une alerte active par son ruleId.
   * Retourne true si l'alerte existait, false sinon.
   */
  resolve(ruleId: string, resolvedBy?: string): boolean {
    const alert = this.activeAlerts.get(ruleId);
    if (!alert) return false;

    this.activeAlerts.delete(ruleId);

    this.logger.log(
      `[AlertManager] Alerte résolue — ruleId=${ruleId} alertId=${alert.id} ` +
      `resolvedBy=${resolvedBy ?? 'system'}`,
    );

    /* Persistance de la résolution */
    this.securityEvent.logAsync({
      eventType: SecurityEventType.ALERT_RESOLVED,
      severity:  SecuritySeverity.INFO,
      resource:  alert.component,
      action:    'alert_resolved',
      actorId:   resolvedBy,
      details: {
        ruleId,
        alertId:     alert.id,
        triggeredAt: alert.triggeredAt.toISOString(),
        count:       alert.count,
        durationMs:  Date.now() - alert.triggeredAt.getTime(),
      },
    });

    return true;
  }

  /**
   * Marque une alerte comme acquittée (reconnue par un humain).
   * L'alerte reste active mais ne génère plus de notifications répétées.
   */
  acknowledge(ruleId: string, acknowledgedBy: string): boolean {
    const alert = this.activeAlerts.get(ruleId);
    if (!alert) return false;

    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    this.logger.log(`[AlertManager] Alerte acquittée — ruleId=${ruleId} by=${acknowledgedBy}`);

    return true;
  }

  /* ==========================================================
   * CONSULTATION
   * ========================================================== */

  /** Retourne toutes les alertes actives, triées par sévérité puis par date. */
  getActiveAlerts(): ActiveAlert[] {
    const severityOrder: Record<SecuritySeverity, number> = {
      [SecuritySeverity.CRITICAL]: 0,
      [SecuritySeverity.HIGH]:     1,
      [SecuritySeverity.MEDIUM]:   2,
      [SecuritySeverity.LOW]:      3,
      [SecuritySeverity.INFO]:     4,
    };

    return [...this.activeAlerts.values()].sort((a, b) => {
      const diff = severityOrder[a.severity] - severityOrder[b.severity];
      if (diff !== 0) return diff;
      return b.triggeredAt.getTime() - a.triggeredAt.getTime();
    });
  }

  /** Retourne le nombre d'alertes actives. */
  getActiveCount(): number {
    return this.activeAlerts.size;
  }

  /** Retourne true si une alerte critique est active. */
  hasCriticalAlert(): boolean {
    return [...this.activeAlerts.values()].some(a => a.severity === SecuritySeverity.CRITICAL);
  }

  /**
   * Retourne l'alerte active pour un ruleId donné.
   * Retourne null si aucune alerte active pour ce ruleId.
   */
  getAlert(ruleId: string): ActiveAlert | null {
    return this.activeAlerts.get(ruleId) ?? null;
  }

  /* ==========================================================
   * MAINTENANCE
   * ========================================================== */

  /**
   * Résout automatiquement les alertes dont le composant est redevenu healthy.
   * Appelé par SecurityScheduler après chaque deep health check.
   */
  autoResolveForHealthyComponents(healthyComponents: string[]): void {
    for (const [ruleId, alert] of this.activeAlerts.entries()) {
      if (healthyComponents.includes(alert.component)) {
        this.resolve(ruleId, 'auto-heal');
      }
    }
  }
}
