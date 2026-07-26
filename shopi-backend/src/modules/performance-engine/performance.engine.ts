/* ============================================================
 * FICHIER      : src/modules/performance-engine/performance.engine.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Façade publique du Performance & Scalability Engine.
 *
 * Les modules externes n'importent JAMAIS les services internes
 * directement — ils passent uniquement par PerformanceEngine.
 *
 * DOMAINES EXPOSÉS
 * ─────────────────────────────────────────────────────────────
 *   Cache Redis          — RedisCacheService
 *   Settings cachées     — PlatformSettingsCacheService
 *   Profiler HTTP        — PerformanceProfilerService
 *   Circuit breaker      — LoadProtectionService
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';

import { RedisCacheService }             from './services/redis-cache.service';
import { PlatformSettingsCacheService }  from './services/platform-settings-cache.service';
import { PerformanceProfilerService }    from './services/performance-profiler.service';
import { LoadProtectionService }         from './services/load-protection.service';

import { PlatformSettings } from '../../database/entities/platform-settings.entity';
import {
  CacheStats,
  PerformanceReport,
  PerformanceSnapshot,
  LoadProtectionStats,
  CircuitState,
} from './types/performance.types';

/* ============================================================
 * FAÇADE
 * ============================================================ */

@Injectable()
export class PerformanceEngine {

  constructor(
    private readonly cache:    RedisCacheService,
    private readonly settings: PlatformSettingsCacheService,
    private readonly profiler: PerformanceProfilerService,
    private readonly circuit:  LoadProtectionService,
  ) {}

  /* ==========================================================
   * CACHE GÉNÉRIQUE
   * ========================================================== */

  /** Récupère une valeur depuis Redis (null si absente/erreur). */
  async cacheGet<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(key);
  }

  /** Stocke une valeur dans Redis avec TTL. */
  async cacheSet<T>(key: string, value: T, ttlSec?: number): Promise<void> {
    return this.cache.set(key, value, ttlSec);
  }

  /** Invalide une clé spécifique. */
  async cacheDel(key: string): Promise<void> {
    return this.cache.del(key);
  }

  /**
   * Invalide toutes les clés d'un namespace (pattern).
   * Utilise SCAN pour ne pas bloquer Redis.
   */
  async cacheFlushNamespace(pattern: string): Promise<number> {
    return this.cache.delByPattern(pattern);
  }

  /** Vide tout le cache Shopi. Opération coûteuse — admin uniquement. */
  async cacheFlushAll(): Promise<number> {
    return this.cache.flushAll();
  }

  /** Statistiques de cache (hits/misses/hit-rate). */
  getCacheStats(): CacheStats {
    return this.cache.getStats();
  }

  /* ==========================================================
   * PLATFORM SETTINGS — CACHE
   * ========================================================== */

  /**
   * Retourne le singleton PlatformSettings depuis le cache Redis.
   * Miss-through automatique vers la DB si absent.
   */
  async getPlatformSettings(): Promise<PlatformSettings> {
    return this.settings.getSettings();
  }

  /**
   * Invalide le cache PlatformSettings.
   * Appeler après chaque PUT /api/settings par le Super Admin.
   */
  async invalidatePlatformSettings(): Promise<void> {
    return this.settings.invalidate();
  }

  /** Préchauffe le cache PlatformSettings (startup). */
  async warmUpSettings(): Promise<void> {
    return this.settings.warmUp();
  }

  /** TTL restant du cache PlatformSettings en secondes. */
  async settingsCacheTtl(): Promise<number> {
    return this.settings.ttlSec();
  }

  /* ==========================================================
   * PROFILER HTTP
   * ========================================================== */

  /** Instantané des métriques de latence HTTP. */
  getPerformanceSnapshot(): PerformanceSnapshot {
    return this.profiler.getSnapshot();
  }

  /** Remet à zéro le profiler. Admin uniquement. */
  resetProfiler(): void {
    this.profiler.reset();
  }

  /* ==========================================================
   * CIRCUIT BREAKER
   * ========================================================== */

  /**
   * Vérifie si une ressource externe est disponible.
   * Retourner false = circuit OPEN (ressource indisponible).
   */
  canProceed(resource: string): boolean {
    return this.circuit.canProceed(resource);
  }

  recordSuccess(resource: string): void {
    this.circuit.recordSuccess(resource);
  }

  recordFailure(resource: string): void {
    this.circuit.recordFailure(resource);
  }

  getCircuitState(resource: string): CircuitState {
    return this.circuit.getState(resource);
  }

  /** Force la réouverture (CLOSED) d'un circuit. Admin uniquement. */
  resetCircuit(resource: string): void {
    this.circuit.reset(resource);
  }

  /** Statistiques de tous les circuits. */
  getLoadProtectionStats(): LoadProtectionStats {
    return this.circuit.getStats();
  }

  /* ==========================================================
   * RAPPORT GLOBAL
   * ========================================================== */

  /**
   * Rapport de performance complet (snapshot + cache + circuits).
   * Utilisé par GET /performance/report.
   */
  getReport(): PerformanceReport {
    return {
      generatedAt:    new Date(),
      profiler:       this.profiler.getSnapshot(),
      cache:          this.cache.getStats(),
      loadProtection: this.circuit.getStats(),
    };
  }
}
