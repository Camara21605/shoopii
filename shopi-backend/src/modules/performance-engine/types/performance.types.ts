/* ============================================================
 * FICHIER      : src/modules/performance-engine/types/performance.types.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Interfaces et types partagés du Performance & Scalability Engine.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

/* ============================================================
 * CACHE
 * ============================================================ */

export interface CacheStats {
  /** Nombre de clés actuellement en cache */
  keys:         number;
  /** Nombre de hits depuis le dernier reset */
  hits:         number;
  /** Nombre de misses depuis le dernier reset */
  misses:       number;
  /** Taux de hit (0–1) */
  hitRate:      number;
  /** Timestamp de la dernière invalidation globale */
  lastFlushAt:  Date | null;
}

export interface CacheNamespaceStats {
  namespace: string;
  keys:      number;
  hits:      number;
  misses:    number;
  hitRate:   number;
}

/* ============================================================
 * PROFILER — MÉTRIQUES HTTP
 * ============================================================ */

export interface RouteStats {
  route:          string;
  method:         string;
  /** Nombre total de requêtes enregistrées */
  count:          number;
  /** Nombre de requêtes avec code >= 400 */
  errorCount:     number;
  /** Durée minimum en ms */
  minMs:          number;
  /** Durée maximum en ms */
  maxMs:          number;
  /** Percentile 50 (médiane) en ms */
  p50Ms:          number;
  /** Percentile 95 en ms */
  p95Ms:          number;
  /** Percentile 99 en ms */
  p99Ms:          number;
  /** Durée moyenne en ms */
  avgMs:          number;
}

export interface PerformanceSnapshot {
  /** Horodatage de la capture */
  capturedAt:     Date;
  /** Durée de vie du process en secondes */
  uptimeSec:      number;
  /** Nombre total de requêtes HTTP enregistrées */
  totalRequests:  number;
  /** Nombre total d'erreurs HTTP */
  totalErrors:    number;
  /** Taux d'erreur global (0–1) */
  errorRate:      number;
  /** P99 global en ms (toutes routes confondues) */
  globalP99Ms:    number | null;
  /** P95 global en ms */
  globalP95Ms:    number | null;
  /** Médiane globale en ms */
  globalP50Ms:    number | null;
  /** Top 5 routes les plus lentes (par P95) */
  slowestRoutes:  RouteStats[];
  /** Top 5 routes les plus chargées (par count) */
  busiestRoutes:  RouteStats[];
}

/* ============================================================
 * CIRCUIT BREAKER
 * ============================================================ */

export enum CircuitState {
  /** Fonctionnement normal — toutes les requêtes passent */
  CLOSED    = 'CLOSED',
  /** Trop de failures — requêtes bloquées */
  OPEN      = 'OPEN',
  /** En cours de test après cooldown — 1 requête test autorisée */
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerEntry {
  resource:         string;
  state:            CircuitState;
  failureCount:     number;
  successCount:     number;
  lastFailureAt:    Date | null;
  lastSuccessAt:    Date | null;
  openedAt:         Date | null;
  /** Timestamp à partir duquel HALF_OPEN est autorisé */
  nextRetryAt:      Date | null;
}

export interface LoadProtectionStats {
  circuits:  CircuitBreakerEntry[];
  totalOpen: number;
}

/* ============================================================
 * RAPPORT DE PERFORMANCE
 * ============================================================ */

export interface PerformanceReport {
  generatedAt:    Date;
  profiler:       PerformanceSnapshot;
  cache:          CacheStats;
  loadProtection: LoadProtectionStats;
}

/* ============================================================
 * PAGINATION PAR CURSEUR
 * ============================================================ */

export interface CursorPage<T> {
  data:       T[];
  /** Curseur opaque pour la page suivante (null si fin) */
  nextCursor: string | null;
  /** Taille du lot retourné */
  count:      number;
  /** Indique s'il existe une page suivante */
  hasMore:    boolean;
}

export interface CursorPageOptions {
  /** Nombre d'éléments par page (défaut : 20, max : 200) */
  limit?:  number;
  /** Curseur opaque de la page précédente */
  cursor?: string;
}
