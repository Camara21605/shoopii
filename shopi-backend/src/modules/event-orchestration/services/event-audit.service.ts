/* ============================================================
 * FICHIER      : src/modules/event-orchestration/services/event-audit.service.ts
 * MODULE       : EventOrchestrationEngine
 * ROLE         : Observabilité — métriques et statistiques en temps réel
 * RESPONSABILITES :
 *   - Comptabiliser les événements publiés, consommés, échoués
 *   - Mesurer les délais de traitement (histogramme simple)
 *   - Exposer un snapshot de métriques pour le dashboard Super Admin
 *   - Enregistrer les événements critiques dans les logs
 * DEPENDANCES  : Aucune (métriques in-memory)
 * MODULES UTILISATEURS :
 *   EventPublisherService, RetryManagerService, DlqService
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { EventMetrics }       from '../types/events.types';

/* ============================================================
 * TYPES INTERNES
 * ============================================================ */

interface PerEventCounter {
  published: number;
  consumed:  number;
  failed:    number;
}

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class EventAuditService {

  private readonly logger = new Logger(EventAuditService.name);

  /* -- Compteurs globaux -------------------------------------- */
  private totalPublished    = 0;
  private totalConsumed     = 0;
  private totalFailed       = 0;
  private totalRetried      = 0;
  private totalDlq          = 0;
  private duplicatesBlocked = 0;

  /* -- Par nom d'événement ----------------------------------- */
  private readonly perEvent = new Map<string, PerEventCounter>();

  /* -- Histogramme des temps de traitement (ms) -------------- */
  private readonly processingTimes: number[] = [];
  private readonly MAX_SAMPLES = 1000;

  /* -- Heure de démarrage du service ------------------------- */
  private readonly startedAt = Date.now();

  /* ==========================================================
   * ENREGISTREMENTS (appelés par les autres services)
   * ========================================================== */

  recordPublished(eventName: string): void {
    this.totalPublished++;
    this.getOrCreate(eventName).published++;
  }

  recordConsumed(eventName: string, processingMs?: number): void {
    this.totalConsumed++;
    this.getOrCreate(eventName).consumed++;
    if (processingMs !== undefined) {
      this.addProcessingTime(processingMs);
    }
  }

  recordFailed(eventName: string): void {
    this.totalFailed++;
    this.getOrCreate(eventName).failed++;
  }

  incrementRetried(): void {
    this.totalRetried++;
  }

  incrementDlq(): void {
    this.totalDlq++;
    this.logger.warn(`[DLQ] Entrée ajoutée — total DLQ : ${this.totalDlq}`);
  }

  incrementDuplicatesBlocked(): void {
    this.duplicatesBlocked++;
  }

  /* ==========================================================
   * LECTURE DES MÉTRIQUES
   * ========================================================== */

  /**
   * Retourne un snapshot complet des métriques.
   * Utilisé par EventOrchestrationEngine.getMetrics() et le dashboard.
   */
  getMetrics(): EventMetrics {
    const byEventName: Record<string, PerEventCounter> = {};
    for (const [name, counters] of this.perEvent.entries()) {
      byEventName[name] = { ...counters };
    }

    return {
      totalPublished:    this.totalPublished,
      totalConsumed:     this.totalConsumed,
      totalFailed:       this.totalFailed,
      totalRetried:      this.totalRetried,
      totalDlq:          this.totalDlq,
      duplicatesBlocked: this.duplicatesBlocked,
      byEventName,
      avgProcessingMs:   this.computeAvgProcessing(),
      uptimeMs:          Date.now() - this.startedAt,
    };
  }

  /**
   * Top N événements les plus publiés (pour le dashboard).
   */
  topEvents(n = 10): Array<{ eventName: string; count: number }> {
    return Array.from(this.perEvent.entries())
      .map(([name, c]) => ({ eventName: name, count: c.published }))
      .sort((a, b) => b.count - a.count)
      .slice(0, n);
  }

  /**
   * Taux d'échec global : failed / published × 100
   */
  failureRate(): number {
    if (this.totalPublished === 0) return 0;
    return Math.round(this.totalFailed / this.totalPublished * 10000) / 100;
  }

  /**
   * Réinitialise les compteurs (utile pour les tests ou les redémarrages).
   */
  reset(): void {
    this.totalPublished    = 0;
    this.totalConsumed     = 0;
    this.totalFailed       = 0;
    this.totalRetried      = 0;
    this.totalDlq          = 0;
    this.duplicatesBlocked = 0;
    this.perEvent.clear();
    this.processingTimes.length = 0;
  }

  /* ==========================================================
   * MÉTHODES PRIVÉES
   * ========================================================== */

  private getOrCreate(eventName: string): PerEventCounter {
    let counter = this.perEvent.get(eventName);
    if (!counter) {
      counter = { published: 0, consumed: 0, failed: 0 };
      this.perEvent.set(eventName, counter);
    }
    return counter;
  }

  private addProcessingTime(ms: number): void {
    if (this.processingTimes.length >= this.MAX_SAMPLES) {
      this.processingTimes.shift();
    }
    this.processingTimes.push(ms);
  }

  private computeAvgProcessing(): number {
    if (this.processingTimes.length === 0) return 0;
    const sum = this.processingTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.processingTimes.length);
  }
}
