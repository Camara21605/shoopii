/* ============================================================
 * FICHIER  : src/common/health/health.controller.ts
 * MODULE   : Common / Health
 * ROLE     : Endpoint de health check pour les load balancers et moniteurs.
 *
 * RESPONSABILITES :
 *   - GET /api/health → retourne l'état de l'application.
 *   - Utilisé par Render, Railway, Kubernetes, UptimeRobot, etc.
 *     pour décider si l'instance est prête à recevoir du trafic.
 *
 * POURQUOI UN HEALTH CHECK DÉDIÉ :
 *   - Sans endpoint de santé, un orchestrateur (K8s, Render) ne peut pas
 *     distinguer une instance démarrée d'une instance opérationnelle.
 *   - Prépare l'ajout futur de checks actifs (DB, Redis, queue) sans
 *     modifier les routes métier.
 *
 * SECURITE :
 *   - Endpoint public (@Public) → pas de JWT requis.
 *   - Ne retourne AUCUNE information sensible (pas de version de DB,
 *     pas de variables d'environnement, pas de stack trace).
 *   - Le champ `version` lit uniquement la variable APP_VERSION
 *     définie en CI/CD (jamais le package.json à chaud).
 *
 * EVOLUTION :
 *   Pour ajouter des checks actifs (DB, Redis) : injecter DataSource
 *   et ioRedis ici, effectuer un ping, retourner un statut 503 si KO.
 *   L'interface HealthStatus est conçue pour accueillir ces checks.
 *
 * AUTEUR : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-04
 * ============================================================ */

import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { Public } from '../decorators/public.decorator';

/** Forme de la réponse — contractuelle, ne pas réduire sans dépréciation. */
export interface HealthStatus {
  /** 'ok' tant que l'endpoint répond. 'degraded' si un check secondaire échoue. */
  status:      'ok' | 'degraded';
  timestamp:   string; // ISO 8601 UTC
  environment: string; // 'production' | 'development' | 'staging'
  version:     string; // Tag CI/CD via APP_VERSION, ou 'dev' en local
}

@Controller('health')
export class HealthController {

  constructor(
    private readonly config: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  check(): HealthStatus {
    return {
      status:      'ok',
      timestamp:   new Date().toISOString(),
      environment: this.config.get<string>('NODE_ENV', 'development'),
      /* APP_VERSION peut être injecté en CI/CD (ex: git tag, commit SHA).
       * Défaut 'dev' en local pour ne pas bloquer si la variable est absente. */
      version:     this.config.get<string>('APP_VERSION', 'dev'),
    };
  }

  /**
   * Diagnostic Redis à la demande — pas de secrets exposés (ni host, ni
   * password), juste le résultat brut d'un PING depuis le runtime Render
   * lui-même, pour trancher entre "IP non autorisée" / "TLS mal configuré" /
   * "connexion refusée" sans avoir à interpréter le bruit des logs de démarrage.
   * TEMPORAIRE — à retirer une fois le problème Redis résolu.
   */
  @Get('redis')
  @Public()
  async checkRedis(): Promise<{ status: 'ok' | 'error'; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
      const pong = await Promise.race([
        this.redis.ping(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout après 5s')), 5_000)),
      ]);
      return { status: pong === 'PONG' ? 'ok' : 'error', latencyMs: Date.now() - start };
    } catch (e) {
      return { status: 'error', latencyMs: Date.now() - start, error: (e as Error).message };
    }
  }
}
