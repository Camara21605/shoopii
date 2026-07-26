/* ============================================================
 * FICHIER      : src/modules/performance-engine/performance.module.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Câblage NestJS du Performance & Scalability Engine.
 *
 * PROVIDERS (5 services + 1 intercepteur + 1 façade)
 * ─────────────────────────────────────────────────────────────
 *   RedisCacheService             — cache Redis générique
 *   PlatformSettingsCacheService  — cache singleton PlatformSettings
 *   PerformanceProfilerService    — latences HTTP P50/P95/P99
 *   LoadProtectionService         — circuit breaker
 *   PerformanceInterceptor        — intercepteur HTTP global
 *   PerformanceEngine             — façade publique
 *
 * EXPORTS
 * ─────────────────────────────────────────────────────────────
 * Seuls RedisCacheService, PlatformSettingsCacheService et
 * PerformanceEngine sont exportés.
 *
 * Les modules consommateurs importent PerformanceModule et
 * injectent PlatformSettingsCacheService à la place d'un
 * findOne(PlatformSettings) direct.
 *
 * INTERCEPTEUR GLOBAL
 * ─────────────────────────────────────────────────────────────
 * PerformanceInterceptor est enregistré comme APP_INTERCEPTOR
 * (via { provide: APP_INTERCEPTOR, useClass: ... }) — il s'applique
 * automatiquement à toutes les routes de l'application.
 *
 * PRÉREQUIS DANS AppModule
 * ─────────────────────────────────────────────────────────────
 *   - RedisModule (global) → @InjectRedis() pour RedisCacheService
 *   - ConfigModule.forRoot({ isGlobal: true })
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Module }       from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';

/* ── Entité ── */
import { PlatformSettings } from '../../database/entities/platform-settings.entity';

/* ── Services ── */
import { RedisCacheService }            from './services/redis-cache.service';
import { PlatformSettingsCacheService } from './services/platform-settings-cache.service';
import { PerformanceProfilerService }   from './services/performance-profiler.service';
import { LoadProtectionService }        from './services/load-protection.service';

/* ── Intercepteur ── */
import { PerformanceInterceptor } from './interceptors/performance.interceptor';

/* ── Façade + Controller ── */
import { PerformanceEngine }     from './performance.engine';
import { PerformanceController } from './performance.controller';

/* ============================================================
 * MODULE
 * ============================================================ */

@Module({
  imports: [
    TypeOrmModule.forFeature([PlatformSettings]),
  ],

  controllers: [
    PerformanceController,
  ],

  providers: [
    /* Services internes */
    RedisCacheService,
    PlatformSettingsCacheService,
    PerformanceProfilerService,
    LoadProtectionService,

    /* Intercepteur global — s'applique à toutes les routes */
    {
      provide:  APP_INTERCEPTOR,
      useClass: PerformanceInterceptor,
    },

    /* Façade publique */
    PerformanceEngine,
  ],

  exports: [
    /* Exportés pour les modules consommateurs */
    RedisCacheService,
    PlatformSettingsCacheService,
    PerformanceEngine,
  ],
})
export class PerformanceModule {}
