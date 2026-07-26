/* ============================================================
 * FICHIER      : src/modules/performance-engine/services/performance-profiler.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Collecte et agrège les métriques de latence HTTP en temps réel.
 * Calcule P50, P95, P99 par route et globalement.
 *
 * CONCEPTION
 * ─────────────────────────────────────────────────────────────
 * Stockage en mémoire : sliding window par route (MAX_SAMPLES
 * dernières durées). Pas de persistance DB — ces données sont
 * éphémères par nature (elles reflètent l'état actuel du process).
 *
 * Pour la persistance long-terme, déléguer à MetricsCollectorService
 * du PlatformSecurityEngine qui écrit en DB toutes les 5 minutes.
 *
 * INTÉGRATION
 * ─────────────────────────────────────────────────────────────
 * Appelé depuis PerformanceInterceptor :
 *   profiler.record(route, method, statusCode, durationMs)
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';

import {
  RouteStats,
  PerformanceSnapshot,
} from '../types/performance.types';

/* ============================================================
 * CONSTANTES
 * ============================================================ */

/** Taille maximale du sliding window par route */
const MAX_SAMPLES = 500;

/** Nombre de routes les plus lentes retournées dans le snapshot */
const TOP_SLOW_ROUTES = 5;

/** Nombre de routes les plus actives retournées dans le snapshot */
const TOP_BUSY_ROUTES = 5;

/* ============================================================
 * TYPES INTERNES
 * ============================================================ */

interface RouteWindow {
  durations:  number[];
  errorCount: number;
  count:      number;
  minMs:      number;
  maxMs:      number;
}

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class PerformanceProfilerService {

  /** Map<"METHOD route", RouteWindow> */
  private readonly windows = new Map<string, RouteWindow>();

  private totalRequests = 0;
  private totalErrors   = 0;
  private startedAt     = Date.now();

  /* ==========================================================
   * ENREGISTREMENT
   * ========================================================== */

  /**
   * Enregistre la durée d'une requête HTTP complétée.
   * Appelé depuis PerformanceInterceptor.
   *
   * @param route      Chemin de la route (ex: '/api/commandes/:id')
   * @param method     Méthode HTTP (GET, POST, etc.)
   * @param statusCode Code HTTP de réponse
   * @param durationMs Durée en millisecondes
   */
  record(
    route:      string,
    method:     string,
    statusCode: number,
    durationMs: number,
  ): void {
    const key = `${method} ${route}`;
    let win   = this.windows.get(key);

    if (!win) {
      win = { durations: [], errorCount: 0, count: 0, minMs: Infinity, maxMs: 0 };
      this.windows.set(key, win);
    }

    /* Sliding window : on garde les MAX_SAMPLES dernières mesures */
    if (win.durations.length >= MAX_SAMPLES) {
      win.durations.shift();
    }
    win.durations.push(durationMs);
    win.count++;

    if (durationMs < win.minMs) win.minMs = durationMs;
    if (durationMs > win.maxMs) win.maxMs = durationMs;
    if (statusCode >= 400) win.errorCount++;

    this.totalRequests++;
    if (statusCode >= 400) this.totalErrors++;
  }

  /* ==========================================================
   * LECTURE
   * ========================================================== */

  /**
   * Statistiques agrégées pour une route spécifique.
   */
  getRouteStats(method: string, route: string): RouteStats | undefined {
    const key = `${method} ${route}`;
    const win = this.windows.get(key);
    if (!win) return undefined;
    return buildRouteStats(method, route, win);
  }

  /**
   * Toutes les routes enregistrées.
   */
  getAllRouteStats(): RouteStats[] {
    const result: RouteStats[] = [];
    for (const [key, win] of this.windows) {
      const [method, ...pathParts] = key.split(' ');
      result.push(buildRouteStats(method, pathParts.join(' '), win));
    }
    return result;
  }

  /**
   * Instantané complet du profiler.
   * Utilisé par le contrôleur GET /performance/profile.
   */
  getSnapshot(): PerformanceSnapshot {
    const allStats = this.getAllRouteStats();

    /* Toutes les durées confondues pour les percentiles globaux */
    const allDurations: number[] = [];
    for (const win of this.windows.values()) {
      allDurations.push(...win.durations);
    }
    allDurations.sort((a, b) => a - b);

    const globalP50 = percentile(allDurations, 50);
    const globalP95 = percentile(allDurations, 95);
    const globalP99 = percentile(allDurations, 99);

    const slowestRoutes = [...allStats]
      .sort((a, b) => b.p95Ms - a.p95Ms)
      .slice(0, TOP_SLOW_ROUTES);

    const busiestRoutes = [...allStats]
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_BUSY_ROUTES);

    return {
      capturedAt:    new Date(),
      uptimeSec:     Math.round((Date.now() - this.startedAt) / 1000),
      totalRequests: this.totalRequests,
      totalErrors:   this.totalErrors,
      errorRate:     this.totalRequests > 0
        ? Math.round((this.totalErrors / this.totalRequests) * 1000) / 1000
        : 0,
      globalP50Ms:   globalP50,
      globalP95Ms:   globalP95,
      globalP99Ms:   globalP99,
      slowestRoutes,
      busiestRoutes,
    };
  }

  /**
   * Remet à zéro tous les compteurs.
   * Appelé par le scheduler hebdomadaire ou manuellement via controller.
   */
  reset(): void {
    this.windows.clear();
    this.totalRequests = 0;
    this.totalErrors   = 0;
    this.startedAt     = Date.now();
  }
}

/* ============================================================
 * HELPERS
 * ============================================================ */

function buildRouteStats(
  method: string,
  route:  string,
  win:    RouteWindow,
): RouteStats {
  const sorted = [...win.durations].sort((a, b) => a - b);
  const sum    = sorted.reduce((acc, d) => acc + d, 0);

  return {
    route,
    method,
    count:      win.count,
    errorCount: win.errorCount,
    minMs:      win.minMs === Infinity ? 0 : win.minMs,
    maxMs:      win.maxMs,
    avgMs:      sorted.length > 0 ? Math.round(sum / sorted.length) : 0,
    p50Ms:      percentile(sorted, 50) ?? 0,
    p95Ms:      percentile(sorted, 95) ?? 0,
    p99Ms:      percentile(sorted, 99) ?? 0,
  };
}

/**
 * Calcule le percentile d'un tableau trié.
 * Retourne null si le tableau est vide.
 */
function percentile(sorted: number[], pct: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}
