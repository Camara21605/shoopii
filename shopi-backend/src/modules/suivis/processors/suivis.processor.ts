/* ============================================================
 * FICHIER : src/modules/suivis/processors/suivis.processor.ts
 *
 * PROCESSEUR BULK ASYNCHRONE (BullMQ)
 *
 * RESPONSABILITÉ
 * ───────────────
 * Traiter toutes les opérations NON BLOQUANTES liées au système
 * de suivi :
 *
 * - Notifications (push / email)
 * - Mise à jour cache Redis
 * - Feed social
 * - Stats followers
 *
 * OBJECTIF
 * ────────
 * API ultra rapide (<10ms) → tout est déporté ici
 * ============================================================ */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { Job } from 'bullmq';

import {
  SUIVIS_QUEUE,
  SUIVIS_JOBS,
  type FollowJobPayload,
} from '../suivis.queue';
import { NotificationEventService } from 'src/modules/notifications/events/notification-event.service';

@Processor(SUIVIS_QUEUE)
export class SuivisProcessor extends WorkerHost {

  private readonly logger = new Logger(SuivisProcessor.name);

  constructor(
    @InjectRedis()
    private readonly redis: Redis,
    private readonly notifEventSvc: NotificationEventService,
  ) {
    super();
  }

  // ─────────────────────────────────────────────
  // ENTRY POINT BULLMQ
  // ─────────────────────────────────────────────

  /**
   * Dispatcher principal des jobs BullMQ
   */
  async process(job: Job<FollowJobPayload>): Promise<void> {
    this.logger.debug(
      `📦 Job reçu : ${job.name} (id=${job.id})`,
    );

    switch (job.name) {

      case SUIVIS_JOBS.NOTIFY_FOLLOWED:
        await this.handleNotifyFollowed(job.data);
        break;

      case SUIVIS_JOBS.NOTIFY_UNFOLLOWED:
        await this.handleNotifyUnfollowed(job.data);
        break;

      case SUIVIS_JOBS.UPDATE_FOLLOW_COUNT:
        await this.handleUpdateFollowCount(job.data);
        break;

      case SUIVIS_JOBS.UPDATE_FEED:
        await this.handleUpdateFeed(job.data);
        break;

      default:
        this.logger.warn(`⚠️ Job inconnu : ${job.name}`);
    }
  }

  // ─────────────────────────────────────────────
  // NOTIFICATIONS FOLLOW
  // ─────────────────────────────────────────────

  /**
   * Notification NEW FOLLOWER
   */
  private async handleNotifyFollowed(
    payload: FollowJobPayload,
  ): Promise<void> {
    try {
      this.logger.log(
        `📬 New follow → ${payload.targetName} suivi par ${payload.followerName}`,
      );

      await this.notifEventSvc.notifyNewFollower({
        targetType:   payload.targetType,
        targetId:     payload.targetId,
        followerType: payload.followerType,
        followerId:   payload.followerId,
        followerName: payload.followerName,
        followId:     payload.followId,
      });

    } catch (err) {
      this.logger.error(
        `❌ Erreur notify-followed`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err; // retry BullMQ
    }
  }

  // ─────────────────────────────────────────────
  // NOTIFICATIONS UNFOLLOW
  // ─────────────────────────────────────────────

  /**
   * Notification UNFOLLOW (optionnel UX)
   */
  private async handleNotifyUnfollowed(
    payload: FollowJobPayload,
  ): Promise<void> {
    try {
      this.logger.log(
        `👋 Unfollow → ${payload.followerName} → ${payload.targetName}`,
      );

      // généralement NON critique → pas de push obligatoire

    } catch (err) {
      this.logger.error(
        `❌ Erreur notify-unfollowed`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // ─────────────────────────────────────────────
  // CACHE FOLLOWERS COUNT
  // ─────────────────────────────────────────────

  /**
   * Met à jour le cache des followers
   *
   * ⚠️ IMPORTANT :
   * On NE fait PAS INCR global
   * On stocke une valeur réelle (set) ou recalculée côté service
   */
  private async handleUpdateFollowCount(
    payload: FollowJobPayload,
  ): Promise<void> {
    const cacheKey = `followers:${payload.targetType}:${payload.targetId}`;

    try {
      // ⚠️ meilleure pratique : recalcul ou incr contrôlé
      const current = await this.redis.get(cacheKey);

      const newValue = current
        ? Number(current) + 1
        : 1;

      await this.redis.set(cacheKey, newValue, 'EX', 3600);

      this.logger.debug(
        `📊 Followers cache updated → ${cacheKey} = ${newValue}`,
      );

    } catch (err) {
      this.logger.error(
        `❌ Redis update error (followers cache)`,
        err instanceof Error ? err.stack : String(err),
      );

      throw err;
    }
  }

  // ─────────────────────────────────────────────
  // FEED SOCIAL UPDATE
  // ─────────────────────────────────────────────

  /**
   * Ajoute une relation follow dans le feed social
   *
   * STRUCTURE :
   * feed:{type}:{id}:targets → SET
   */
  private async handleUpdateFeed(
    payload: FollowJobPayload,
  ): Promise<void> {
    const feedKey = `feed:${payload.followerType}:${payload.followerId}:targets`;
    const target  = `${payload.targetType}:${payload.targetId}`;

    try {
      await this.redis.sadd(feedKey, target);

      this.logger.debug(
        `📰 Feed updated → ${feedKey} + ${target}`,
      );

    } catch (err) {
      this.logger.error(
        `❌ Feed update error`,
        err instanceof Error ? err.stack : String(err),
      );

      throw err;
    }
  }
}