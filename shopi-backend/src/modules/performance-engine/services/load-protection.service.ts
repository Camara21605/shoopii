/* ============================================================
 * FICHIER      : src/modules/performance-engine/services/load-protection.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Circuit breaker in-memory pour protéger les ressources critiques
 * (providers de paiement, services externes, opérations lourdes)
 * contre les surcharges et les cascades de failure.
 *
 * ÉTATS DU CIRCUIT BREAKER
 * ─────────────────────────────────────────────────────────────
 *
 *                 ┌──────────────────────────────────────────────────┐
 *                 │                                                  │
 *   reset()       ▼          threshold dépassé                      │
 *   HALF_OPEN → CLOSED ──────────────────────────► OPEN ────────────┘
 *      ▲                                              │  (cooldown expiré)
 *      │                                              ▼
 *      └──────────────────────────────────────── HALF_OPEN
 *                       (1 requête test autorisée)
 *
 * CONFIGURATION PAR DÉFAUT
 * ─────────────────────────────────────────────────────────────
 *   - Seuil d'ouverture       : 5 failures consécutives
 *   - Fenêtre de comptage     : 60 secondes
 *   - Cooldown OPEN→HALF_OPEN : 30 secondes
 *
 * UTILISATION
 * ─────────────────────────────────────────────────────────────
 * // Avant d'appeler le provider externe :
 * if (!this.loadProtection.canProceed('orange-money')) {
 *   throw new ServiceUnavailableException('Provider temporairement indisponible');
 * }
 * try {
 *   const result = await this.orangeMoneyClient.charge(amount);
 *   this.loadProtection.recordSuccess('orange-money');
 *   return result;
 * } catch (err) {
 *   this.loadProtection.recordFailure('orange-money');
 *   throw err;
 * }
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';

import {
  CircuitState,
  CircuitBreakerEntry,
  LoadProtectionStats,
} from '../types/performance.types';

/* ============================================================
 * CONFIGURATION
 * ============================================================ */

/** Nombre de failures consécutives avant OPEN */
const FAILURE_THRESHOLD = 5;

/** Fenêtre de comptage des failures (ms) */
const COUNTING_WINDOW_MS = 60_000;

/** Cooldown avant de passer OPEN → HALF_OPEN (ms) */
const COOLDOWN_MS = 30_000;

/* ============================================================
 * TYPES INTERNES
 * ============================================================ */

interface CircuitEntry extends CircuitBreakerEntry {
  /** Timestamps des failures récentes (pour la fenêtre glissante) */
  recentFailureTimes: number[];
}

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class LoadProtectionService {

  private readonly logger   = new Logger(LoadProtectionService.name);
  private readonly circuits = new Map<string, CircuitEntry>();

  /* ==========================================================
   * API PUBLIQUE
   * ========================================================== */

  /**
   * Vérifie si une requête peut passer pour la ressource donnée.
   * Retourne false si le circuit est OPEN.
   *
   * @param resource Identifiant unique de la ressource (ex: 'orange-money')
   */
  canProceed(resource: string): boolean {
    const entry = this.getOrCreate(resource);
    const now   = Date.now();

    switch (entry.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        /* Vérifier si le cooldown est expiré → passer HALF_OPEN */
        if (entry.nextRetryAt && now >= entry.nextRetryAt.getTime()) {
          entry.state     = CircuitState.HALF_OPEN;
          entry.nextRetryAt = null;
          this.logger.log(`[CircuitBreaker] ${resource} → HALF_OPEN (test autorisé)`);
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        /* Une seule requête de test autorisée */
        return true;
    }
  }

  /**
   * Enregistre un succès.
   * Si HALF_OPEN → ferme le circuit (CLOSED).
   */
  recordSuccess(resource: string): void {
    const entry = this.getOrCreate(resource);
    entry.successCount++;
    entry.lastSuccessAt = new Date();

    if (entry.state === CircuitState.HALF_OPEN) {
      entry.state             = CircuitState.CLOSED;
      entry.recentFailureTimes = [];
      entry.openedAt          = null;
      this.logger.log(`[CircuitBreaker] ${resource} → CLOSED (rétabli)`);
    }
  }

  /**
   * Enregistre un failure.
   * Si seuil dépassé → ouvre le circuit (OPEN).
   */
  recordFailure(resource: string): void {
    const entry = this.getOrCreate(resource);
    const now   = Date.now();

    entry.failureCount++;
    entry.lastFailureAt = new Date();

    /* Purger les failures hors-fenêtre */
    entry.recentFailureTimes = entry.recentFailureTimes.filter(
      t => now - t < COUNTING_WINDOW_MS,
    );
    entry.recentFailureTimes.push(now);

    /* Si HALF_OPEN et failure → ré-ouvrir */
    if (entry.state === CircuitState.HALF_OPEN) {
      this.openCircuit(entry, resource);
      return;
    }

    /* Si CLOSED et seuil dépassé → ouvrir */
    if (
      entry.state === CircuitState.CLOSED &&
      entry.recentFailureTimes.length >= FAILURE_THRESHOLD
    ) {
      this.openCircuit(entry, resource);
    }
  }

  /**
   * Force la fermeture d'un circuit (reset manuel via admin).
   */
  reset(resource: string): void {
    const entry = this.getOrCreate(resource);
    entry.state              = CircuitState.CLOSED;
    entry.recentFailureTimes = [];
    entry.openedAt           = null;
    entry.nextRetryAt        = null;
    this.logger.log(`[CircuitBreaker] ${resource} → CLOSED (reset manuel)`);
  }

  /**
   * Retourne l'état d'un circuit.
   */
  getState(resource: string): CircuitState {
    return this.getOrCreate(resource).state;
  }

  /**
   * Statistiques globales de tous les circuits connus.
   */
  getStats(): LoadProtectionStats {
    const circuits: CircuitBreakerEntry[] = [];
    for (const [resource, entry] of this.circuits) {
      circuits.push({
        resource,
        state:          entry.state,
        failureCount:   entry.failureCount,
        successCount:   entry.successCount,
        lastFailureAt:  entry.lastFailureAt,
        lastSuccessAt:  entry.lastSuccessAt,
        openedAt:       entry.openedAt,
        nextRetryAt:    entry.nextRetryAt,
      });
    }

    return {
      circuits,
      totalOpen: circuits.filter(c => c.state === CircuitState.OPEN).length,
    };
  }

  /* ==========================================================
   * HELPERS PRIVÉS
   * ========================================================== */

  private getOrCreate(resource: string): CircuitEntry {
    if (!this.circuits.has(resource)) {
      this.circuits.set(resource, {
        resource,
        state:               CircuitState.CLOSED,
        failureCount:        0,
        successCount:        0,
        lastFailureAt:       null,
        lastSuccessAt:       null,
        openedAt:            null,
        nextRetryAt:         null,
        recentFailureTimes:  [],
      });
    }
    return this.circuits.get(resource)!;
  }

  private openCircuit(entry: CircuitEntry, resource: string): void {
    entry.state       = CircuitState.OPEN;
    entry.openedAt    = new Date();
    entry.nextRetryAt = new Date(Date.now() + COOLDOWN_MS);
    this.logger.warn(
      `[CircuitBreaker] ${resource} → OPEN ` +
      `(${entry.recentFailureTimes.length} failures en ${COUNTING_WINDOW_MS / 1000}s) ` +
      `retry dans ${COOLDOWN_MS / 1000}s`,
    );
  }
}
