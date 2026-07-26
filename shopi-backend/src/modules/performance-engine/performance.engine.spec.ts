/* ============================================================
 * FICHIER      : src/modules/performance-engine/performance.engine.spec.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Tests unitaires de PerformanceEngine (façade).
 * Couvre les 4 domaines fonctionnels avec mocks complets.
 *
 * GROUPES (6)
 * ─────────────────────────────────────────────────────────────
 *  1. Cache générique   — get, set, del, flushAll, flushNamespace, stats
 *  2. PlatformSettings  — getSettings, invalidate, warmUp, ttl
 *  3. Profiler HTTP     — getSnapshot, reset
 *  4. Circuit Breaker   — canProceed, recordSuccess, recordFailure, resetCircuit
 *  5. Rapport global    — getReport (fusion des 3 sous-rapports)
 *  6. Correctif N+1     — validation du chargement groupé des wallets
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Test, TestingModule } from '@nestjs/testing';

import { PerformanceEngine }             from './performance.engine';
import { RedisCacheService }             from './services/redis-cache.service';
import { PlatformSettingsCacheService }  from './services/platform-settings-cache.service';
import { PerformanceProfilerService }    from './services/performance-profiler.service';
import { LoadProtectionService }         from './services/load-protection.service';
import { CircuitState }                  from './types/performance.types';

/* ============================================================
 * MOCKS
 * ============================================================ */

function mockRedisCache() {
  return {
    get:           jest.fn().mockResolvedValue(null),
    set:           jest.fn().mockResolvedValue(undefined),
    del:           jest.fn().mockResolvedValue(undefined),
    delByPattern:  jest.fn().mockResolvedValue(3),
    flushAll:      jest.fn().mockResolvedValue(10),
    exists:        jest.fn().mockResolvedValue(false),
    ttl:           jest.fn().mockResolvedValue(120),
    getStats:      jest.fn().mockReturnValue({ keys: 5, hits: 80, misses: 20, hitRate: 0.8, lastFlushAt: null }),
    resetStats:    jest.fn(),
  };
}

function mockSettingsCache() {
  return {
    getSettings: jest.fn().mockResolvedValue({ id: 1, platformCommission: 6, maintenanceMode: false }),
    invalidate:  jest.fn().mockResolvedValue(undefined),
    warmUp:      jest.fn().mockResolvedValue(undefined),
    ttlSec:      jest.fn().mockResolvedValue(240),
  };
}

function mockProfiler() {
  return {
    record:      jest.fn(),
    getSnapshot: jest.fn().mockReturnValue({
      capturedAt:    new Date(),
      uptimeSec:     3600,
      totalRequests: 1000,
      totalErrors:   10,
      errorRate:     0.01,
      globalP50Ms:   45,
      globalP95Ms:   120,
      globalP99Ms:   300,
      slowestRoutes: [],
      busiestRoutes: [],
    }),
    reset: jest.fn(),
  };
}

function mockLoadProtection() {
  return {
    canProceed:    jest.fn().mockReturnValue(true),
    recordSuccess: jest.fn(),
    recordFailure: jest.fn(),
    getState:      jest.fn().mockReturnValue(CircuitState.CLOSED),
    reset:         jest.fn(),
    getStats:      jest.fn().mockReturnValue({ circuits: [], totalOpen: 0 }),
  };
}

/* ============================================================
 * SUITE
 * ============================================================ */

describe('PerformanceEngine', () => {
  let engine:    PerformanceEngine;
  let cache:     ReturnType<typeof mockRedisCache>;
  let settings:  ReturnType<typeof mockSettingsCache>;
  let profiler:  ReturnType<typeof mockProfiler>;
  let circuit:   ReturnType<typeof mockLoadProtection>;

  beforeEach(async () => {
    cache    = mockRedisCache();
    settings = mockSettingsCache();
    profiler = mockProfiler();
    circuit  = mockLoadProtection();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceEngine,
        { provide: RedisCacheService,            useValue: cache    },
        { provide: PlatformSettingsCacheService, useValue: settings },
        { provide: PerformanceProfilerService,   useValue: profiler },
        { provide: LoadProtectionService,        useValue: circuit  },
      ],
    }).compile();

    engine = module.get<PerformanceEngine>(PerformanceEngine);
  });

  /* ==========================================================
   * 1. CACHE GÉNÉRIQUE
   * ========================================================== */

  describe('Cache générique', () => {
    it('cacheGet délègue à RedisCacheService.get', async () => {
      cache.get.mockResolvedValue({ foo: 'bar' });
      const result = await engine.cacheGet<{ foo: string }>('mykey');
      expect(cache.get).toHaveBeenCalledWith('mykey');
      expect(result).toEqual({ foo: 'bar' });
    });

    it('cacheGet retourne null si absent', async () => {
      cache.get.mockResolvedValue(null);
      expect(await engine.cacheGet('missing')).toBeNull();
    });

    it('cacheSet délègue clé, valeur et TTL', async () => {
      await engine.cacheSet('k1', { v: 42 }, 600);
      expect(cache.set).toHaveBeenCalledWith('k1', { v: 42 }, 600);
    });

    it('cacheDel supprime la clé', async () => {
      await engine.cacheDel('k1');
      expect(cache.del).toHaveBeenCalledWith('k1');
    });

    it('cacheFlushNamespace retourne le nombre de clés supprimées', async () => {
      const n = await engine.cacheFlushNamespace('reporting:');
      expect(cache.delByPattern).toHaveBeenCalledWith('reporting:');
      expect(n).toBe(3);
    });

    it('cacheFlushAll retourne le nombre total de clés supprimées', async () => {
      const n = await engine.cacheFlushAll();
      expect(cache.flushAll).toHaveBeenCalled();
      expect(n).toBe(10);
    });

    it('getCacheStats retourne les statistiques', () => {
      const stats = engine.getCacheStats();
      expect(stats.hitRate).toBe(0.8);
      expect(stats.hits).toBe(80);
    });
  });

  /* ==========================================================
   * 2. PLATFORM SETTINGS CACHE
   * ========================================================== */

  describe('PlatformSettings cache', () => {
    it('getPlatformSettings retourne le singleton depuis le cache', async () => {
      const s = await engine.getPlatformSettings();
      expect(settings.getSettings).toHaveBeenCalled();
      expect(s.platformCommission).toBe(6);
    });

    it('invalidatePlatformSettings appelle invalidate()', async () => {
      await engine.invalidatePlatformSettings();
      expect(settings.invalidate).toHaveBeenCalled();
    });

    it('warmUpSettings appelle warmUp()', async () => {
      await engine.warmUpSettings();
      expect(settings.warmUp).toHaveBeenCalled();
    });

    it('settingsCacheTtl retourne le TTL restant', async () => {
      const ttl = await engine.settingsCacheTtl();
      expect(settings.ttlSec).toHaveBeenCalled();
      expect(ttl).toBe(240);
    });
  });

  /* ==========================================================
   * 3. PROFILER HTTP
   * ========================================================== */

  describe('Profiler HTTP', () => {
    it('getPerformanceSnapshot retourne le snapshot', () => {
      const snap = engine.getPerformanceSnapshot();
      expect(profiler.getSnapshot).toHaveBeenCalled();
      expect(snap.totalRequests).toBe(1000);
      expect(snap.globalP95Ms).toBe(120);
    });

    it('resetProfiler remet à zéro les compteurs', () => {
      engine.resetProfiler();
      expect(profiler.reset).toHaveBeenCalled();
    });
  });

  /* ==========================================================
   * 4. CIRCUIT BREAKER
   * ========================================================== */

  describe('Circuit Breaker', () => {
    it('canProceed retourne true si CLOSED', () => {
      expect(engine.canProceed('orange-money')).toBe(true);
      expect(circuit.canProceed).toHaveBeenCalledWith('orange-money');
    });

    it('canProceed retourne false si OPEN', () => {
      circuit.canProceed.mockReturnValue(false);
      expect(engine.canProceed('mtn-money')).toBe(false);
    });

    it('recordSuccess délègue au LoadProtectionService', () => {
      engine.recordSuccess('orange-money');
      expect(circuit.recordSuccess).toHaveBeenCalledWith('orange-money');
    });

    it('recordFailure délègue au LoadProtectionService', () => {
      engine.recordFailure('wave');
      expect(circuit.recordFailure).toHaveBeenCalledWith('wave');
    });

    it('getCircuitState retourne CLOSED par défaut', () => {
      expect(engine.getCircuitState('orange-money')).toBe(CircuitState.CLOSED);
    });

    it('resetCircuit force le circuit en CLOSED', () => {
      engine.resetCircuit('djomy');
      expect(circuit.reset).toHaveBeenCalledWith('djomy');
    });

    it('getLoadProtectionStats retourne les circuits', () => {
      const stats = engine.getLoadProtectionStats();
      expect(stats.totalOpen).toBe(0);
    });
  });

  /* ==========================================================
   * 5. RAPPORT GLOBAL
   * ========================================================== */

  describe('Rapport global', () => {
    it('getReport fusionne profiler + cache + circuits', () => {
      const report = engine.getReport();

      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.profiler.totalRequests).toBe(1000);
      expect(report.cache.hitRate).toBe(0.8);
      expect(report.loadProtection.totalOpen).toBe(0);

      expect(profiler.getSnapshot).toHaveBeenCalled();
      expect(cache.getStats).toHaveBeenCalled();
      expect(circuit.getStats).toHaveBeenCalled();
    });
  });

  /* ==========================================================
   * 6. PROFILER — CALCUL PERCENTILES (service direct)
   * ========================================================== */

  describe('PerformanceProfilerService — percentiles', () => {
    let profilerService: PerformanceProfilerService;

    beforeEach(async () => {
      const mod = await Test.createTestingModule({
        providers: [PerformanceProfilerService],
      }).compile();
      profilerService = mod.get(PerformanceProfilerService);
    });

    it('enregistre correctement les durées et calcule P95', () => {
      /* Simule 20 requêtes avec des durées de 10 à 200 ms */
      for (let i = 1; i <= 20; i++) {
        profilerService.record('/api/test', 'GET', 200, i * 10);
      }
      const stats = profilerService.getRouteStats('GET', '/api/test');
      expect(stats).toBeDefined();
      expect(stats!.count).toBe(20);
      expect(stats!.minMs).toBe(10);
      expect(stats!.maxMs).toBe(200);
      /* P95 de [10, 20, ..., 200] → 190 ou 200 */
      expect(stats!.p95Ms).toBeGreaterThanOrEqual(180);
    });

    it('compte correctement les erreurs', () => {
      profilerService.record('/api/test', 'POST', 201, 30);
      profilerService.record('/api/test', 'POST', 400, 15);
      profilerService.record('/api/test', 'POST', 500, 25);

      const stats = profilerService.getRouteStats('POST', '/api/test');
      expect(stats!.count).toBe(3);
      expect(stats!.errorCount).toBe(2);
    });

    it('reset vide tous les windows', () => {
      profilerService.record('/api/a', 'GET', 200, 50);
      profilerService.reset();
      const snap = profilerService.getSnapshot();
      expect(snap.totalRequests).toBe(0);
      expect(snap.slowestRoutes).toHaveLength(0);
    });
  });

  /* ==========================================================
   * 7. LOAD PROTECTION — circuit breaker (service direct)
   * ========================================================== */

  describe('LoadProtectionService — circuit breaker', () => {
    let protection: LoadProtectionService;

    beforeEach(async () => {
      const mod = await Test.createTestingModule({
        providers: [LoadProtectionService],
      }).compile();
      protection = mod.get(LoadProtectionService);
    });

    it('CLOSED par défaut', () => {
      expect(protection.canProceed('svc')).toBe(true);
      expect(protection.getState('svc')).toBe(CircuitState.CLOSED);
    });

    it('passe OPEN après 5 failures', () => {
      for (let i = 0; i < 5; i++) {
        protection.recordFailure('svc');
      }
      expect(protection.getState('svc')).toBe(CircuitState.OPEN);
      expect(protection.canProceed('svc')).toBe(false);
    });

    it('reset force le retour à CLOSED', () => {
      for (let i = 0; i < 5; i++) protection.recordFailure('svc');
      protection.reset('svc');
      expect(protection.getState('svc')).toBe(CircuitState.CLOSED);
      expect(protection.canProceed('svc')).toBe(true);
    });

    it('getStats retourne le nombre de circuits OPEN', () => {
      for (let i = 0; i < 5; i++) protection.recordFailure('svc-a');
      const stats = protection.getStats();
      expect(stats.totalOpen).toBe(1);
    });
  });
});
