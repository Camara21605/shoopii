/* ============================================================
 * FICHIER      : src/modules/performance-engine/performance.controller.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Endpoints REST d'administration du Performance Engine.
 * Lecture des métriques, gestion du cache, circuit breakers.
 *
 * ROUTES
 * ─────────────────────────────────────────────────────────────
 * GET  /performance/report            — rapport complet   (ADMIN)
 * GET  /performance/profile           — latences HTTP     (ADMIN)
 * POST /performance/profile/reset     — reset profiler    (SUPER_ADMIN)
 * GET  /performance/cache             — stats cache       (ADMIN)
 * POST /performance/cache/warm-up     — préchauffage      (SUPER_ADMIN)
 * DELETE /performance/cache           — flush global      (SUPER_ADMIN)
 * DELETE /performance/cache/:ns       — flush namespace   (SUPER_ADMIN)
 * GET  /performance/circuit-breakers  — état circuits     (ADMIN)
 * POST /performance/circuit-breakers/:resource/reset — reset (SUPER_ADMIN)
 *
 * SÉCURITÉ
 * ─────────────────────────────────────────────────────────────
 * - JwtAuthGuard sur toutes les routes
 * - ADMIN : lecture seule
 * - SUPER_ADMIN : actions d'écriture (flush, reset)
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  Controller, Get, Post, Delete,
  Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard }   from '../../common/guards/roles.guard';
import { Roles }        from '../../common/decorators/roles.decorator';
import { UserRole }     from '../../common/enums/user-role.enum';

import { PerformanceEngine } from './performance.engine';

/* ============================================================
 * CONTROLLER
 * ============================================================ */

@Controller('performance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PerformanceController {

  constructor(private readonly engine: PerformanceEngine) {}

  /* ==========================================================
   * RAPPORT GLOBAL
   * ========================================================== */

  /** Rapport de performance complet : profiler + cache + circuits. */
  @Get('report')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getReport() {
    return this.engine.getReport();
  }

  /* ==========================================================
   * PROFILER HTTP
   * ========================================================== */

  /** Métriques de latence HTTP par route (P50/P95/P99). */
  @Get('profile')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getProfile() {
    return this.engine.getPerformanceSnapshot();
  }

  /** Remet à zéro le profiler HTTP. */
  @Post('profile/reset')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  resetProfile() {
    this.engine.resetProfiler();
    return { success: true, message: 'Profiler HTTP réinitialisé' };
  }

  /* ==========================================================
   * CACHE
   * ========================================================== */

  /** Statistiques de cache Redis (hits/misses/hit-rate). */
  @Get('cache')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getCacheStats() {
    return this.engine.getCacheStats();
  }

  /** TTL restant du cache PlatformSettings. */
  @Get('cache/settings-ttl')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getSettingsTtl() {
    const ttl = await this.engine.settingsCacheTtl();
    return { key: 'platform_settings:1', ttlSec: ttl };
  }

  /** Préchauffage : force le rechargement du cache PlatformSettings. */
  @Post('cache/warm-up')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async warmUp() {
    await this.engine.warmUpSettings();
    return { success: true, message: 'Cache PlatformSettings préchauffé' };
  }

  /** Vide tout le cache Redis Shopi (opération coûteuse). */
  @Delete('cache')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async flushAll() {
    const deleted = await this.engine.cacheFlushAll();
    return { success: true, deletedKeys: deleted };
  }

  /**
   * Vide toutes les clés d'un namespace.
   * Exemple : DELETE /performance/cache/platform_settings
   */
  @Delete('cache/:namespace')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async flushNamespace(@Param('namespace') namespace: string) {
    const deleted = await this.engine.cacheFlushNamespace(namespace);
    return { success: true, namespace, deletedKeys: deleted };
  }

  /* ==========================================================
   * CIRCUIT BREAKERS
   * ========================================================== */

  /** État de tous les circuits breakers connus. */
  @Get('circuit-breakers')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getCircuits() {
    return this.engine.getLoadProtectionStats();
  }

  /**
   * Réinitialise (force CLOSED) un circuit breaker spécifique.
   * Utile après la résolution manuelle d'un incident provider.
   */
  @Post('circuit-breakers/:resource/reset')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  resetCircuit(@Param('resource') resource: string) {
    this.engine.resetCircuit(resource);
    return { success: true, resource, state: 'CLOSED' };
  }
}
