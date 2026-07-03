/* ============================================================
 * FICHIER : permission-cache.service.ts
 *
 * RÔLE : Cache Redis L1 pour les décisions de permission.
 *
 * OBJECTIF PERFORMANCE :
 *   Sans cache : chaque getOrCreateConversation() fait
 *   1-3 requêtes SQL (follows, commandes, contacts).
 *   Avec cache : O(1) Redis GET pour les paires déjà vérifiées.
 *
 * STRATÉGIE DE CLÉ :
 *   perm:{sourceType}:{sourceId}:{targetType}:{targetId}
 *   Exemple : perm:client:abc123:company:def456
 *
 * TTL PAR TYPE DE RÈGLE :
 *   ALWAYS (client→company, partner→*) : 3600s (1h)
 *   FOLLOW-BASED                        : 300s  (5 min)
 *   ORDER-BASED                         : 600s  (10 min)
 *
 * INVALIDATION :
 *   Les follow/unfollow et les nouvelles commandes invalident
 *   les clés concernées via invalidate().
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis }        from '@nestjs-modules/ioredis';
import type { Redis }         from 'ioredis';
import type { PermissionResult } from './interfaces/permission-context.interface';

const PREFIX = 'perm:';

/** Sérialisé dans Redis */
interface CachedDecision {
  granted:   boolean;
  reason:    string;
  evaluator: string;
  cachedAt:  number;
}

@Injectable()
export class PermissionCacheService {
  private readonly logger = new Logger(PermissionCacheService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  // ── Clé Redis ───────────────────────────────────────────────

  private key(
    sourceType: string, sourceId: string,
    targetType: string, targetId: string,
  ): string {
    return `${PREFIX}${sourceType}:${sourceId}:${targetType}:${targetId}`;
  }

  // ── Lecture ─────────────────────────────────────────────────

  async get(
    sourceType: string, sourceId: string,
    targetType: string, targetId: string,
  ): Promise<PermissionResult | null> {
    try {
      const raw = await this.redis.get(
        this.key(sourceType, sourceId, targetType, targetId),
      );
      if (!raw) return null;

      const cached = JSON.parse(raw) as CachedDecision;
      return {
        granted:   cached.granted,
        reason:    cached.reason,
        evaluator: cached.evaluator,
        cached:    true,
      };
    } catch {
      return null;
    }
  }

  // ── Écriture ────────────────────────────────────────────────

  async set(
    sourceType: string, sourceId: string,
    targetType: string, targetId: string,
    result: PermissionResult,
    ttlSeconds = 300,
  ): Promise<void> {
    try {
      const value: CachedDecision = {
        granted:   result.granted,
        reason:    result.reason,
        evaluator: result.evaluator,
        cachedAt:  Date.now(),
      };

      await this.redis.setex(
        this.key(sourceType, sourceId, targetType, targetId),
        ttlSeconds,
        JSON.stringify(value),
      );
    } catch (err) {
      /* Cache miss ne bloque JAMAIS l'application */
      this.logger.warn(`[PermCache] Écriture échouée: ${(err as Error).message}`);
    }
  }

  // ── Invalidation ciblée ─────────────────────────────────────

  /**
   * Invalide toutes les clés impliquant un acteur spécifique.
   * Appelé lors d'un unfollow, blocage ou annulation de commande.
   *
   * ATTENTION : SCAN + DEL est O(n) sur les clés, acceptable
   * car le nombre de clés par acteur est borné.
   */
  async invalidateForActor(actorType: string, actorId: string): Promise<void> {
    try {
      const pattern1 = `${PREFIX}${actorType}:${actorId}:*`;
      const pattern2 = `${PREFIX}*:${actorType}:${actorId}`;

      for (const pattern of [pattern1, pattern2]) {
        let cursor = '0';
        do {
          const [nextCursor, keys] = await this.redis.scan(
            cursor, 'MATCH', pattern, 'COUNT', 100,
          );
          cursor = nextCursor;
          if (keys.length > 0) {
            await this.redis.del(...keys);
            this.logger.debug(`[PermCache] Invalidé ${keys.length} clés pour ${actorType}:${actorId}`);
          }
        } while (cursor !== '0');
      }
    } catch (err) {
      this.logger.warn(`[PermCache] Invalidation échouée: ${(err as Error).message}`);
    }
  }

  /**
   * Invalide une paire spécifique (après unfollow A↔B par exemple).
   */
  async invalidatePair(
    typeA: string, idA: string,
    typeB: string, idB: string,
  ): Promise<void> {
    try {
      await this.redis.del(
        this.key(typeA, idA, typeB, idB),
        this.key(typeB, idB, typeA, idA),
      );
    } catch {
      /* Silencieux */
    }
  }

  /** TTL recommandé selon le type d'évaluateur */
  static ttlFor(evaluatorName: string): number {
    if (evaluatorName.includes('PartnerAs') ||
        evaluatorName.includes('ClientCompany') ||
        evaluatorName.includes('CorrespondentCorrespondent')) {
      return 3600;  // Règles ALWAYS → 1h
    }
    if (evaluatorName.includes('Order') || evaluatorName.includes('Client')) {
      return 600;   // Règles basées commandes → 10 min
    }
    return 300;     // Défaut → 5 min
  }
}
