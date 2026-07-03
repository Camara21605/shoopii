/* ============================================================
 * FICHIER : messaging-audit.service.ts
 *
 * RÔLE : Journalise chaque décision de permission de manière
 *        asynchrone (fire-and-forget) pour ne jamais bloquer
 *        la requête principale.
 *
 * DESIGN :
 *   - Écriture en DB APRÈS la réponse HTTP (async void)
 *   - Logs structurés pour monitoring / alertes
 *   - Détection flood : > 10 tentatives DENIED en 1 min
 *     → log WARNING (peut déclencher un ban automatique)
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';
import { InjectRedis }        from '@nestjs-modules/ioredis';
import type { Redis }         from 'ioredis';
import { MessagingAuditLog, AuditDecision } from 'src/database/entities/messaging/messaging-audit-log.entity';
import type { PermissionContext, PermissionResult } from './interfaces/permission-context.interface';

const FLOOD_KEY    = (userId: string) => `perm:flood:${userId}`;
const FLOOD_TTL    = 60;   // secondes
const FLOOD_LIMIT  = 10;   // tentatives DENIED par minute

@Injectable()
export class MessagingAuditService {
  private readonly logger = new Logger(MessagingAuditService.name);

  constructor(
    @InjectRepository(MessagingAuditLog)
    private readonly auditRepo: Repository<MessagingAuditLog>,

    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  /**
   * Enregistre une décision de permission.
   * Appelé en fire-and-forget — ne bloque jamais la requête.
   */
  async log(
    ctx:    PermissionContext,
    result: PermissionResult,
  ): Promise<void> {
    /* Enregistrement DB asynchrone */
    void this.persistLog(ctx, result);

    /* Détection flood DENIED */
    if (!result.granted) {
      void this.checkFlood(ctx.requestorUserId);
    }
  }

  // ── Persistance ─────────────────────────────────────────────

  private async persistLog(
    ctx:    PermissionContext,
    result: PermissionResult,
  ): Promise<void> {
    try {
      const entry = this.auditRepo.create({
        requestorType: ctx.requestorType,
        requestorId:   ctx.requestorId,
        targetType:    ctx.targetType,
        targetId:      ctx.targetId,
        decision:      result.granted ? AuditDecision.GRANTED : AuditDecision.DENIED,
        reason:        result.reason,
        evaluator:     result.evaluator,
        durationMs:    result.durationMs ?? null,
        cached:        result.cached ?? false,
        ipAddress:     ctx.ipAddress ?? null,
        callerUserId:  ctx.requestorUserId,
      });

      await this.auditRepo.save(entry);
    } catch (err) {
      /* L'audit ne doit JAMAIS faire planter l'application */
      this.logger.error('[Audit] Échec persistance:', (err as Error).message);
    }
  }

  // ── Détection flood ─────────────────────────────────────────

  private async checkFlood(userId: string): Promise<void> {
    try {
      const key   = FLOOD_KEY(userId);
      const count = await this.redis.incr(key);

      if (count === 1) {
        /* Premier refus dans la fenêtre → pose le TTL */
        await this.redis.expire(key, FLOOD_TTL);
      }

      if (count >= FLOOD_LIMIT) {
        this.logger.warn(
          `[Audit] 🚨 FLOOD DÉTECTÉ userId=${userId} → ${count} tentatives DENIED en ${FLOOD_TTL}s`,
        );
        /* TODO : déclencher un bannissement temporaire automatique */
      }
    } catch {
      /* Redis indisponible → pas de détection flood, mais jamais de crash */
    }
  }

  // ── Statistiques ─────────────────────────────────────────────

  async getDeniedStats(userId: string): Promise<number> {
    try {
      const raw = await this.redis.get(FLOOD_KEY(userId));
      return raw ? parseInt(raw, 10) : 0;
    } catch {
      return 0;
    }
  }
}
