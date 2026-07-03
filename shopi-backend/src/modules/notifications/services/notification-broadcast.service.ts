/* ============================================================
 * FICHIER : src/modules/notifications/services/notification-broadcast.service.ts
 *
 * RÔLE : Pont entre les services REST et le gateway Socket.IO.
 *
 * POURQUOI CE SERVICE ?
 *   Le gateway NotificationGateway possède le serveur Socket.IO.
 *   Les services (NotificationService, etc.) ont besoin d'émettre
 *   des events sans dépendre du gateway → dépendance circulaire.
 *
 *   Solution (identique à BroadcastService dans MessagerieModule) :
 *     1. Ce service commence sans serveur (server = null).
 *     2. NotificationGateway.afterInit() injecte le serveur via setServer().
 *     3. Les services peuvent ensuite émettre des events.
 *
 * MAPPING actorType + actorId → room Socket.IO :
 *   Room : `notif:user:{userId}`
 *
 *   PROBLÈME : on a actorType + actorId (profil), pas userId (users.id).
 *   SOLUTION : Redis cache actorKey → userId (peuplé à la connexion socket).
 *              Si cache miss → pas d'émission (acteur hors ligne, OK).
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis }        from '@nestjs-modules/ioredis';
import Redis                  from 'ioredis';
import type { Server }        from 'socket.io';
import type { NotificationActorType } from 'src/database/entities/notification/notification.entitiy';

/** Préfixe des clés Redis pour le mapping acteur → userId */
const ACTOR_USER_KEY_PREFIX = 'notif:actor:';

/** TTL du cache acteur → userId : 24h */
const ACTOR_CACHE_TTL = 86_400;

@Injectable()
export class NotificationBroadcastService {

  private server: Server | null = null;

  private readonly logger = new Logger(NotificationBroadcastService.name);

  constructor(
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  // ─────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────

  /**
   * Appelé par NotificationGateway.afterInit().
   * Injecte le serveur Socket.IO dans ce service.
   */
  setServer(server: Server): void {
    this.server = server;
    this.logger.log('🔌 NotificationBroadcastService: server Socket.IO enregistré');
  }

  // ─────────────────────────────────────────────────────────
  // CACHE ACTEUR → USERID
  // ─────────────────────────────────────────────────────────

  /**
   * Stocke le mapping actorType:actorId → userId dans Redis.
   * Appelé par NotificationGateway.handleConnection().
   */
  async cacheActorUserId(
    actorType: NotificationActorType,
    actorId:   string,
    userId:    string,
  ): Promise<void> {
    const key = `${ACTOR_USER_KEY_PREFIX}${actorType}:${actorId}`;
    await this.redis.set(key, userId, 'EX', ACTOR_CACHE_TTL);
  }

  /**
   * Résout actorType + actorId → userId depuis Redis.
   * @returns userId ou null si cache miss (acteur jamais connecté)
   */
  async resolveUserId(
    actorType: NotificationActorType,
    actorId:   string,
  ): Promise<string | null> {
    const key = `${ACTOR_USER_KEY_PREFIX}${actorType}:${actorId}`;
    return this.redis.get(key);
  }

  // ─────────────────────────────────────────────────────────
  // ÉMISSIONS
  // ─────────────────────────────────────────────────────────

  /**
   * Émet un événement Socket.IO sur la room d'un acteur.
   *
   * @returns true si l'acteur était connecté (émission effective)
   *          false si cache miss ou server non initialisé
   */
  async emitToActor(
    actorType: NotificationActorType,
    actorId:   string,
    event:     string,
    payload:   unknown,
  ): Promise<boolean> {
    if (!this.server) {
      this.logger.warn('emitToActor: server Socket.IO non encore initialisé');
      return false;
    }

    const userId = await this.resolveUserId(actorType, actorId);
    if (!userId) {
      // Acteur hors ligne ou jamais connecté → notification en base uniquement
      return false;
    }

    const room = `notif:user:${userId}`;
    this.server.to(room).emit(event, payload);

    this.logger.debug(
      `emit actor=${actorType}:${actorId} room=${room} event=${event}`,
    );

    return true;
  }

  /**
   * Émet une mise à jour du compteur non lu pour un acteur.
   * Raccourci pour notif:unread_count.
   */
  async emitUnreadCount(
    actorType:   NotificationActorType,
    actorId:     string,
    unreadCount: number,
  ): Promise<void> {
    await this.emitToActor(actorType, actorId, 'notif:unread_count', { unreadCount });
  }

  /**
   * Émet directement sur une room userId (quand userId est connu).
   * Utilisé par NotificationGateway pour les events sync.
   */
  emitToUser(userId: string, event: string, payload: unknown): void {
    if (!this.server) return;
    this.server.to(`notif:user:${userId}`).emit(event, payload);
  }
}
