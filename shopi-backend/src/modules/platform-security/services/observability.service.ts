/* ============================================================
 * FICHIER      : src/modules/platform-security/services/observability.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Tracing distribué in-process de Shopi.
 * Permet de suivre le parcours complet d'une opération
 * de bout en bout via des spans rattachés au correlationId.
 *
 * USAGE TYPIQUE
 * ─────────────────────────────────────────────────────────────
 *   const spanId = obs.startSpan(correlationId, 'WalletEngine.credit');
 *   try {
 *     await walletEngine.credit(...);
 *     obs.endSpan(correlationId, spanId, 'success', { amount: 5000 });
 *   } catch (err) {
 *     obs.endSpan(correlationId, spanId, 'error', { error: err.message });
 *   }
 *
 * STOCKAGE
 * ─────────────────────────────────────────────────────────────
 * In-memory uniquement — pas de persistance DB pour les traces.
 * Les traces sont conservées 1 heure puis purgées automatiquement
 * par le SecurityScheduler.
 *
 * SCALABILITÉ
 * ─────────────────────────────────────────────────────────────
 * En production multi-instances, les traces sont limitées à
 * l'instance courante. Pour un tracing distribué complet,
 * intégrer OpenTelemetry (hors scope de ce Prompt).
 *
 * DÉPENDANCES
 * ─────────────────────────────────────────────────────────────
 *   randomUUID (crypto built-in Node.js)
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID }         from 'crypto';

import { Span, TransactionTrace } from '../types/security.types';

/* ============================================================
 * CONSTANTES
 * ============================================================ */

/** Durée de vie d'une trace en mémoire (1 heure). */
const TRACE_TTL_MS     = 60 * 60 * 1000;
/** Nombre maximum de traces simultanées en mémoire. */
const MAX_TRACES       = 5000;
/** Nombre maximum de spans par trace. */
const MAX_SPANS_TRACE  = 200;

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class ObservabilityService {

  private readonly logger = new Logger(ObservabilityService.name);

  /**
   * Map principale : correlationId → { spans, lastUpdated }
   * Structurée ainsi pour pouvoir purger par TTL efficacement.
   */
  private readonly traces = new Map<string, {
    spans: Span[];
    lastUpdatedMs: number;
  }>();

  /* ==========================================================
   * GESTION DES SPANS
   * ========================================================== */

  /**
   * Démarre un nouveau span.
   * Retourne le spanId à conserver pour appeler endSpan().
   */
  startSpan(correlationId: string, operationName: string): string {
    const spanId = randomUUID();
    const span: Span = {
      spanId,
      correlationId,
      operationName,
      startedAt: Date.now(),
    };

    const existing = this.traces.get(correlationId);

    if (existing) {
      /* Protège contre la croissance infinie d'une trace (bug ou boucle) */
      if (existing.spans.length < MAX_SPANS_TRACE) {
        existing.spans.push(span);
      }
      existing.lastUpdatedMs = Date.now();
    } else {
      /* Si la limite globale est atteinte, on abandonne silencieusement */
      if (this.traces.size >= MAX_TRACES) {
        this.logger.warn(`[Observability] Limite MAX_TRACES (${MAX_TRACES}) atteinte — span ignoré`);
        return spanId;
      }
      this.traces.set(correlationId, {
        spans:         [span],
        lastUpdatedMs: Date.now(),
      });
    }

    return spanId;
  }

  /**
   * Clôture un span existant et enregistre le résultat.
   */
  endSpan(
    correlationId: string,
    spanId:         string,
    result:         'success' | 'error',
    metadata?:      Record<string, unknown>,
  ): void {
    const entry = this.traces.get(correlationId);
    if (!entry) return;

    const span = entry.spans.find(s => s.spanId === spanId);
    if (!span) return;

    const now = Date.now();
    span.endedAt    = now;
    span.durationMs = now - span.startedAt;
    span.result     = result;
    span.metadata   = metadata;

    entry.lastUpdatedMs = now;
  }

  /* ==========================================================
   * CONSULTATION
   * ========================================================== */

  /**
   * Retourne la trace complète pour un correlationId.
   * Retourne null si aucune trace n'existe (expirée ou inconnue).
   */
  getTrace(correlationId: string): TransactionTrace | null {
    const entry = this.traces.get(correlationId);
    if (!entry || entry.spans.length === 0) return null;

    const sorted  = [...entry.spans].sort((a, b) => a.startedAt - b.startedAt);
    const first   = sorted[0];
    const last    = sorted[sorted.length - 1];
    const endMs   = last.endedAt ?? Date.now();
    const errors  = sorted.filter(s => s.result === 'error').length;
    const hasOpen = sorted.some(s => !s.endedAt);

    return {
      correlationId,
      spans: sorted,
      totalDurationMs: endMs - first.startedAt,
      status: hasOpen ? 'in_progress' : (errors > 0 ? 'error' : 'success'),
      errorCount: errors,
    };
  }

  /** Retourne le nombre de traces actuellement en mémoire. */
  getActiveTraceCount(): number {
    return this.traces.size;
  }

  /* ==========================================================
   * NETTOYAGE
   * ========================================================== */

  /**
   * Supprime les traces dont le dernier span remonte à plus de TRACE_TTL_MS.
   * Appelé par SecurityScheduler toutes les 15 minutes.
   * Retourne le nombre de traces purgées.
   */
  cleanupOldTraces(): number {
    const threshold = Date.now() - TRACE_TTL_MS;
    let purged = 0;

    for (const [id, entry] of this.traces.entries()) {
      if (entry.lastUpdatedMs < threshold) {
        this.traces.delete(id);
        purged++;
      }
    }

    if (purged > 0) {
      this.logger.debug(`[Observability] ${purged} trace(s) expirée(s) purgée(s)`);
    }

    return purged;
  }
}
