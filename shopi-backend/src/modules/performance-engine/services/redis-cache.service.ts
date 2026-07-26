/* ============================================================
 * FICHIER      : src/modules/performance-engine/services/redis-cache.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Service de cache Redis générique, utilisable par n'importe
 * quel module Shopi.
 *
 * CONCEPTION
 * ─────────────────────────────────────────────────────────────
 * Ce service est un wrapper autour de ioredis qui :
 *   - Gère la sérialisation/désérialisation JSON
 *   - Ne propage jamais les erreurs Redis (degraded gracefully)
 *   - Comptabilise hits/misses par namespace pour le monitoring
 *   - Supporte l'invalidation par clé exacte ou par préfixe
 *
 * PATTERN D'UTILISATION
 * ─────────────────────────────────────────────────────────────
 * const cached = await this.cache.get<PlatformSettings>('ps:1');
 * if (cached) return cached;
 * const fresh = await this.repo.findOne({ where: { id: 1 } });
 * await this.cache.set('ps:1', fresh, 300);
 * return fresh;
 *
 * SÉCURITÉ
 * ─────────────────────────────────────────────────────────────
 * Ne jamais mettre en cache :
 *   - Tokens JWT / clés secrètes
 *   - Données personnelles non chiffrées (RGPD)
 *   - Données financières unitaires (soldes en temps réel)
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis }        from '@nestjs-modules/ioredis';
import Redis                  from 'ioredis';

import { CacheStats } from '../types/performance.types';

/* ============================================================
 * CONSTANTES
 * ============================================================ */

/** TTL par défaut : 5 minutes */
const DEFAULT_TTL_SEC = 300;

/** TTL maximum autorisé : 24 heures */
const MAX_TTL_SEC = 86_400;

/** Préfixe global pour toutes les clés Shopi */
const KEY_PREFIX = 'shopi:';

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class RedisCacheService {

  private readonly logger = new Logger(RedisCacheService.name);

  /** Compteurs de monitoring (réinitialisés à minuit côté scheduler) */
  private hits   = 0;
  private misses = 0;
  private lastFlushAt: Date | null = null;

  constructor(
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  /* ==========================================================
   * LECTURE
   * ========================================================== */

  /**
   * Récupère une valeur depuis Redis.
   * Retourne null si la clé est absente, expirée ou en cas d'erreur Redis.
   * Ne propage jamais d'exception.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(this.prefix(key));
      if (raw === null) {
        this.misses++;
        return null;
      }
      this.hits++;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(`[Cache] get(${key}) erreur Redis: ${(err as Error).message}`);
      this.misses++;
      return null;
    }
  }

  /* ==========================================================
   * ÉCRITURE
   * ========================================================== */

  /**
   * Stocke une valeur dans Redis avec TTL en secondes.
   * Ne propage jamais d'exception.
   *
   * @param key     Clé sans préfixe (ex: 'platform_settings:1')
   * @param value   Valeur sérialisable en JSON
   * @param ttlSec  TTL en secondes (défaut : 300s = 5 min)
   */
  async set<T>(key: string, value: T, ttlSec = DEFAULT_TTL_SEC): Promise<void> {
    try {
      const safeTtl = Math.min(Math.max(1, ttlSec), MAX_TTL_SEC);
      await this.redis.set(
        this.prefix(key),
        JSON.stringify(value),
        'EX',
        safeTtl,
      );
    } catch (err) {
      this.logger.warn(`[Cache] set(${key}) erreur Redis: ${(err as Error).message}`);
    }
  }

  /* ==========================================================
   * INVALIDATION
   * ========================================================== */

  /**
   * Supprime une clé spécifique.
   * Ne propage jamais d'exception.
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(this.prefix(key));
    } catch (err) {
      this.logger.warn(`[Cache] del(${key}) erreur Redis: ${(err as Error).message}`);
    }
  }

  /**
   * Supprime toutes les clés dont le nom commence par un préfixe.
   * Utilise SCAN pour éviter de bloquer Redis (pas de KEYS *).
   *
   * @param pattern  Préfixe de recherche (sans le préfixe global 'shopi:')
   */
  async delByPattern(pattern: string): Promise<number> {
    try {
      const fullPattern = `${KEY_PREFIX}${pattern}*`;
      let deleted  = 0;
      let cursor   = '0';

      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor, 'MATCH', fullPattern, 'COUNT', 100,
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          await this.redis.del(...keys);
          deleted += keys.length;
        }
      } while (cursor !== '0');

      this.logger.debug(`[Cache] delByPattern(${pattern}) — ${deleted} clé(s) supprimée(s)`);
      return deleted;
    } catch (err) {
      this.logger.warn(`[Cache] delByPattern(${pattern}) erreur: ${(err as Error).message}`);
      return 0;
    }
  }

  /**
   * Vide toutes les clés Shopi (namespace 'shopi:*').
   * Usage : invalidation globale après une migration de données.
   * ATTENTION : opération coûteuse — utiliser avec précaution.
   */
  async flushAll(): Promise<number> {
    const deleted = await this.delByPattern('');
    this.lastFlushAt = new Date();
    this.hits   = 0;
    this.misses = 0;
    return deleted;
  }

  /* ==========================================================
   * UTILITAIRES
   * ========================================================== */

  /**
   * Vérifie si une clé existe sans la lire.
   */
  async exists(key: string): Promise<boolean> {
    try {
      const n = await this.redis.exists(this.prefix(key));
      return n > 0;
    } catch {
      return false;
    }
  }

  /**
   * Retourne le TTL restant en secondes, ou -1 si absente/sans TTL.
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(this.prefix(key));
    } catch {
      return -1;
    }
  }

  /**
   * Statistiques de monitoring (hits/misses/hit-rate).
   */
  getStats(): CacheStats {
    const total   = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;
    return {
      keys:        0, // non disponible sans SCAN (trop coûteux)
      hits:        this.hits,
      misses:      this.misses,
      hitRate:     Math.round(hitRate * 100) / 100,
      lastFlushAt: this.lastFlushAt,
    };
  }

  /** Remet les compteurs à zéro (appelé par le scheduler de minuit). */
  resetStats(): void {
    this.hits   = 0;
    this.misses = 0;
  }

  /* ==========================================================
   * HELPER PRIVÉ
   * ========================================================== */

  private prefix(key: string): string {
    return `${KEY_PREFIX}${key}`;
  }
}
