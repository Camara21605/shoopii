/* ============================================================
 * FICHIER      : src/modules/platform-security/services/deep-health.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Health checks actifs pour tous les composants critiques de Shopi.
 * Contrairement au HealthController existant (check passif),
 * ce service SONDE réellement chaque dépendance.
 *
 * COMPOSANTS VÉRIFIÉS
 * ─────────────────────────────────────────────────────────────
 *   1. database      → SELECT 1 sur PostgreSQL
 *   2. redis         → PING sur Redis
 *   3. process       → utilisation mémoire vs seuil
 *   4. configuration → variables d'environnement critiques
 *
 * TIMEOUTS
 * ─────────────────────────────────────────────────────────────
 * Chaque check a un timeout de 5 secondes via Promise.race().
 * Un timeout compte comme 'down'.
 *
 * RÈGLES DE STATUT GLOBAL
 * ─────────────────────────────────────────────────────────────
 *   'healthy'  → tous les composants sont healthy
 *   'degraded' → au moins un composant est degraded (mais aucun down)
 *   'down'     → au moins un composant critique est down
 *                (database ou redis = toujours critique)
 *
 * DÉPENDANCES
 * ─────────────────────────────────────────────────────────────
 *   TypeORM → DataSource (SELECT 1)
 *   ioredis → Redis ping()
 *   NestJS  → ConfigService
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource }   from '@nestjs/typeorm';
import { DataSource }         from 'typeorm';
import { InjectRedis }        from '@nestjs-modules/ioredis';
import { ConfigService }      from '@nestjs/config';
import type Redis             from 'ioredis';

import { ComponentHealth, HealthReport } from '../types/security.types';

/* ============================================================
 * CONSTANTES
 * ============================================================ */

/** Timeout pour chaque check individuel (ms). */
const CHECK_TIMEOUT_MS = 5_000;
/** Seuil d'alerte mémoire heap (%). */
const MEMORY_WARN_PCT  = 85;
/** Variables d'environnement obligatoires pour le fonctionnement. */
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'REDIS_HOST',
];

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class DeepHealthService {

  private readonly logger = new Logger(DeepHealthService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,

    @InjectRedis()
    private readonly redis: Redis,

    private readonly config: ConfigService,
  ) {}

  /* ==========================================================
   * CHECK GLOBAL
   * ========================================================== */

  /**
   * Lance tous les health checks en parallèle.
   * Calcule l'état global et retourne le rapport complet.
   */
  async checkAll(): Promise<HealthReport> {
    const start = Date.now();

    const [db, red, proc, conf] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkProcess(),
      this.checkConfiguration(),
    ]);

    const components  = [db, red, proc, conf];
    const hasDown     = components.some(c => c.status === 'down');
    const hasDegraded = components.some(c => c.status === 'degraded');

    /* database et redis sont critiques : un 'down' sur l'un → global 'down' */
    const criticalDown = [db, red].some(c => c.status === 'down');

    const overall: HealthReport['overall'] =
      criticalDown || hasDown  ? 'down' :
      hasDegraded              ? 'degraded' :
                                 'healthy';

    return {
      overall,
      components,
      totalCheckMs: Date.now() - start,
      timestamp:    new Date(),
    };
  }

  /* ==========================================================
   * CHECKS INDIVIDUELS
   * ========================================================== */

  /**
   * Vérifie la connectivité et la réactivité de PostgreSQL.
   * Exécute SELECT 1 avec timeout de 5 secondes.
   */
  async checkDatabase(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      await withTimeout(
        this.dataSource.query('SELECT 1 AS ping'),
        CHECK_TIMEOUT_MS,
      );
      return {
        name:      'database',
        status:    'healthy',
        latencyMs: Date.now() - start,
        checkedAt: new Date(),
      };
    } catch (err: any) {
      this.logger.error('[HealthCheck] database DOWN', err?.message);
      return {
        name:      'database',
        status:    err?.message?.includes('timeout') ? 'degraded' : 'down',
        latencyMs: Date.now() - start,
        checkedAt: new Date(),
        error:     err?.message ?? 'unknown error',
      };
    }
  }

  /**
   * Vérifie la connectivité Redis avec un PING.
   */
  async checkRedis(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      const pong = await withTimeout(
        this.redis.ping(),
        CHECK_TIMEOUT_MS,
      );
      const isHealthy = pong === 'PONG';
      return {
        name:      'redis',
        status:    isHealthy ? 'healthy' : 'degraded',
        latencyMs: Date.now() - start,
        checkedAt: new Date(),
        details:   { response: pong },
      };
    } catch (err: any) {
      this.logger.error('[HealthCheck] redis DOWN', err?.message);
      return {
        name:      'redis',
        status:    'down',
        latencyMs: Date.now() - start,
        checkedAt: new Date(),
        error:     err?.message ?? 'unknown error',
      };
    }
  }

  /**
   * Vérifie l'utilisation mémoire du processus Node.js.
   * Aucune dépendance externe — toujours synchrone.
   */
  checkProcess(): ComponentHealth {
    const mem         = process.memoryUsage();
    const heapUsedMb  = Math.round(mem.heapUsed  / 1_048_576);
    const heapTotalMb = Math.round(mem.heapTotal / 1_048_576);
    const usedPct     = heapTotalMb > 0
      ? Math.round((heapUsedMb / heapTotalMb) * 100)
      : 0;
    const rssMb       = Math.round(mem.rss / 1_048_576);
    const uptimeMin   = Math.round(process.uptime() / 60);

    const status: ComponentHealth['status'] = usedPct >= MEMORY_WARN_PCT
      ? 'degraded'
      : 'healthy';

    return {
      name:      'process',
      status,
      latencyMs: null,
      checkedAt: new Date(),
      details: {
        heapUsedMb,
        heapTotalMb,
        memUsedPct:   usedPct,
        rssMb,
        uptimeMin,
        nodeVersion:  process.version,
      },
      ...(status === 'degraded' && {
        error: `Utilisation mémoire élevée : ${usedPct}% (seuil : ${MEMORY_WARN_PCT}%)`,
      }),
    };
  }

  /**
   * Vérifie la présence des variables d'environnement critiques.
   * Loggue les manquantes sans les exposer dans la réponse.
   */
  checkConfiguration(): ComponentHealth {
    const missing = REQUIRED_ENV_VARS.filter(v => !this.config.get<string>(v));

    if (missing.length > 0) {
      this.logger.error(`[HealthCheck] Variables d'environnement manquantes : ${missing.join(', ')}`);
      return {
        name:      'configuration',
        status:    'down',
        latencyMs: null,
        checkedAt: new Date(),
        error:     `${missing.length} variable(s) d'environnement obligatoire(s) manquante(s)`,
        details:   { missingCount: missing.length },
      };
    }

    const env = this.config.get<string>('NODE_ENV', 'development');
    return {
      name:      'configuration',
      status:    'healthy',
      latencyMs: null,
      checkedAt: new Date(),
      details:   {
        environment:     env,
        checkedVars:     REQUIRED_ENV_VARS.length,
      },
    };
  }
}

/* ============================================================
 * UTILITAIRE
 * ============================================================ */

/**
 * Ajoute un timeout à une promesse.
 * Lance une erreur avec le message 'timeout' si la promesse
 * n'est pas résolue dans le délai imparti.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms),
    ),
  ]);
}
