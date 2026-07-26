/* ============================================================
 * FICHIER      : src/modules/event-orchestration/services/retry-manager.service.ts
 * MODULE       : EventOrchestrationEngine
 * ROLE         : Gestion des re-tentatives avec backoff exponentiel
 * RESPONSABILITES :
 *   - Réessayer automatiquement les handlers ayant échoué
 *   - Appliquer un backoff exponentiel configurable
 *   - Envoyer en DLQ après N tentatives épuisées
 *   - Journaliser chaque tentative et résultat
 * DEPENDANCES  :
 *   DlqService, EventAuditService
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';

import { DlqService }        from './dlq.service';
import { EventAuditService } from './event-audit.service';
import { ShopiEvent }        from '../types/events.types';

/* ============================================================
 * CONFIGURATION PAR DÉFAUT
 * ============================================================ */

export interface RetryConfig {
  /** Nombre maximum de tentatives avant envoi en DLQ */
  maxAttempts:  number;
  /** Délai de base en ms (multiplié par 2^attempt) */
  baseDelayMs:  number;
  /** Délai maximum pour éviter des attentes trop longues */
  maxDelayMs:   number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  baseDelayMs: 1_000,  // 1s, 2s, 4s, 8s, 16s → max 31s
  maxDelayMs:  30_000,
};

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class RetryManagerService {

  private readonly logger = new Logger(RetryManagerService.name);

  constructor(
    private readonly dlq:   DlqService,
    private readonly audit: EventAuditService,
  ) {}

  /* ==========================================================
   * MÉTHODE PRINCIPALE
   * ========================================================== */

  /**
   * Exécute un handler avec re-tentatives automatiques.
   *
   * Algorithme :
   *   1. Tente d'exécuter le handler
   *   2. Si succès → retourne true
   *   3. Si échec ET tentatives restantes → attend (backoff) puis réessaie
   *   4. Si tentatives épuisées → envoie en DLQ → retourne false
   *
   * @param handler      Fonction à exécuter (peut être async)
   * @param event        Événement traité (pour le DLQ)
   * @param subscriberName Nom du subscriber (pour les logs)
   * @param config       Configuration optionnelle
   */
  async executeWithRetry<T>(
    handler:        () => Promise<void>,
    event:          ShopiEvent<T>,
    subscriberName: string,
    config:         RetryConfig = DEFAULT_RETRY_CONFIG,
  ): Promise<boolean> {
    let attempt = 0;

    while (attempt < config.maxAttempts) {
      try {
        const start = Date.now();
        await handler();
        this.audit.recordConsumed(event.eventName, Date.now() - start);
        return true;

      } catch (err) {
        attempt++;
        const isLast = attempt >= config.maxAttempts;

        const delay = this.computeDelay(attempt, config);
        const errMsg = err instanceof Error ? err.message : String(err);

        this.logger.warn(
          `[Retry] ${subscriberName} → ${event.eventName} ` +
          `tentative ${attempt}/${config.maxAttempts} — ${errMsg}` +
          (isLast ? ' → DLQ' : ` → retry dans ${delay}ms`),
        );

        this.audit.incrementRetried();

        if (isLast) {
          /* Toutes les tentatives épuisées → Dead Letter Queue */
          await this.dlq.push(event, subscriberName, errMsg, attempt);
          this.audit.recordFailed(event.eventName);
          return false;
        }

        /* Attente avec backoff avant la prochaine tentative */
        await this.sleep(delay);
      }
    }

    return false;
  }

  /* ==========================================================
   * MÉTHODES PRIVÉES
   * ========================================================== */

  /**
   * Calcule le délai de backoff exponentiel.
   * delay = min(baseDelay × 2^(attempt-1), maxDelay)
   * + jitter aléatoire ±10% pour éviter les pics de charge synchronisés
   */
  private computeDelay(attempt: number, config: RetryConfig): number {
    const base  = config.baseDelayMs * Math.pow(2, attempt - 1);
    const capped = Math.min(base, config.maxDelayMs);
    const jitter = capped * 0.1 * (Math.random() * 2 - 1);
    return Math.round(Math.max(0, capped + jitter));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
