/* ============================================================
 * FICHIER : src/modules/notifications/gateway/notification.gateway.ts
 *
 * RÔLE : Gateway Socket.IO pour les notifications temps réel.
 *
 * NAMESPACE : /notifications
 *   → Isolé de /messaging, /suivis, /location.
 *   → Pas de conflit de rooms ou d'events.
 *
 * ROOMS :
 *   notif:user:{userId}   → room privée par utilisateur
 *   notif:admin           → room des admins (annonces système)
 *
 * SÉCURITÉ :
 *   JWT vérifié à la connexion (identique à MessagerieGateway).
 *   Role et actorId résolus et injectés dans socket.data.
 *
 * ÉVÉNEMENTS SERVEUR → CLIENT :
 *   notif:new           WsNewNotificationPayload  (nouvelle notif IN_APP)
 *   notif:updated       { id, count, body }        (agrégation)
 *   notif:unread_count  WsUnreadCountPayload       (badge mis à jour)
 *   connected           { userId, unreadCount }    (handshake)
 *
 * ÉVÉNEMENTS CLIENT → SERVEUR :
 *   notif:read          { id }    → marquer une notif comme lue
 *   notif:read_all      {}        → marquer tout comme lu
 *
 * PATTERN BROADCAST :
 *   NotificationBroadcastService.setServer() est appelé dans afterInit().
 *   Les services REST utilisent le broadcast pour émettre sans
 *   dépendance directe au gateway.
 * ============================================================ */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger }        from '@nestjs/common';
import { JwtService }    from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Server }   from 'socket.io';

import {
  NotificationActorType,
} from 'src/database/entities/notification/notification.entitiy';
import type { NotificationSocket } from '../interfaces/notification.interfaces';
import { NotificationBroadcastService } from '../services/notification-broadcast.service';
import { NotificationService }          from '../services/notification.service';
import { ROLE_TO_ACTOR_TYPE }           from '../utils/actor-type.util';

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    /*
     * Identique à MessagerieGateway :
     * origin:true → reflète l'entête Origin du client.
     * Évite les problèmes credentials:true + origin:'*' (bloqué navigateur).
     */
    origin:      true,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(
    private readonly jwt:       JwtService,
    private readonly config:    ConfigService,
    private readonly broadcast: NotificationBroadcastService,
    private readonly service:   NotificationService,
  ) {}

  // ─────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────

  afterInit(server: Server): void {
    /*
     * Injecte le serveur dans BroadcastService.
     * Permet aux services REST d'émettre des events
     * sans dépendance circulaire vers ce gateway.
     */
    this.broadcast.setServer(server);
    this.logger.log('🔔 Gateway /notifications initialisée');
  }

  // ─────────────────────────────────────────────────────────
  // CONNEXION
  // ─────────────────────────────────────────────────────────

  async handleConnection(socket: NotificationSocket): Promise<void> {
    try {
      // ── 1. Vérifier le JWT ────────────────────────────────
      const token = this.extractToken(socket);
      if (!token) {
        return this.rejectSocket(socket, 'TOKEN_MISSING');
      }

      let payload: { sub: string; role: string; actorId?: string };
      try {
        payload = this.jwt.verify(token, {
          secret: this.config.get<string>('JWT_SECRET'),
        });
      } catch {
        return this.rejectSocket(socket, 'TOKEN_INVALID');
      }

      const userId   = payload.sub;
      const userRole = payload.role;

      // ── 2. Résoudre l'actorType ───────────────────────────
      const actorType = ROLE_TO_ACTOR_TYPE[userRole];
      if (!actorType) {
        return this.rejectSocket(socket, 'ROLE_UNKNOWN');
      }

      /*
       * actorId = UUID du profil (companies.id, clients.id…).
       * Le payload JWT doit le contenir (ajouté par AuthService.login()).
       * Si absent → on utilise userId comme fallback (admin).
       */
      const actorId = payload.actorId ?? userId;

      // ── 3. Injecter dans socket.data ─────────────────────
      socket.data.userId    = userId;
      socket.data.userRole  = userRole;
      socket.data.actorType = actorType;
      socket.data.actorId   = actorId;

      // ── 4. Rejoindre la room privée ──────────────────────
      const room = `notif:user:${userId}`;
      await socket.join(room);

      // Room admin pour les annonces système
      if (actorType === NotificationActorType.ADMIN ||
          actorType === NotificationActorType.SUPER_ADMIN) {
        await socket.join('notif:admin');
      }

      // ── 5. Cache acteur → userId pour BroadcastService ───
      await this.broadcast.cacheActorUserId(actorType, actorId, userId);

      // ── 6. Charger le compteur non lu ────────────────────
      const unreadCount = await this.service.getUnreadCount(actorType, actorId);

      // ── 7. Handshake de confirmation ─────────────────────
      socket.emit('connected', {
        userId,
        unreadCount,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(
        `✅ Notif connecté user=${userId} role=${userRole} `
        + `actor=${actorType}:${actorId} unread=${unreadCount}`,
      );
    } catch (err) {
      this.logger.error(`❌ Erreur connexion notif socket=${socket.id}`, err);
      socket.disconnect();
    }
  }

  // ─────────────────────────────────────────────────────────
  // DÉCONNEXION
  // ─────────────────────────────────────────────────────────

  handleDisconnect(socket: NotificationSocket): void {
    const userId = socket.data?.userId;
    if (userId) {
      this.logger.log(`🔌 Notif déconnecté user=${userId} socket=${socket.id}`);
    }
  }

  // ─────────────────────────────────────────────────────────
  // ÉVÉNEMENTS CLIENT → SERVEUR
  // ─────────────────────────────────────────────────────────

  /**
   * notif:read — marquer une notification comme lue.
   *
   * @payload { id: string }
   */
  @SubscribeMessage('notif:read')
  async handleMarkRead(
    @ConnectedSocket() socket: NotificationSocket,
    @MessageBody()    body:   { id: string },
  ): Promise<void> {
    const { actorType, actorId } = socket.data;
    if (!actorType || !actorId || !body?.id) return;

    await this.service.markAsRead(body.id, actorType, actorId);
    // Le badge est mis à jour via broadcast.emitUnreadCount() dans le service
  }

  /**
   * notif:read_all — marquer toutes les notifications comme lues.
   */
  @SubscribeMessage('notif:read_all')
  async handleMarkAllRead(
    @ConnectedSocket() socket: NotificationSocket,
  ): Promise<void> {
    const { actorType, actorId } = socket.data;
    if (!actorType || !actorId) return;

    await this.service.markAllAsRead(actorType, actorId);
  }

  // ─────────────────────────────────────────────────────────
  // HELPERS PRIVÉS
  // ─────────────────────────────────────────────────────────

  /** Extrait le JWT depuis auth.token, query.token ou Authorization header */
  private extractToken(socket: NotificationSocket): string | null {
    const a = socket.handshake.auth?.token as string | undefined;
    if (a) return a;
    const q = socket.handshake.query?.token;
    if (q) return Array.isArray(q) ? q[0] : q as string;
    const h = socket.handshake.headers?.authorization;
    if (h?.startsWith('Bearer ')) return h.slice(7);
    return null;
  }

  private rejectSocket(socket: NotificationSocket, code: string): void {
    socket.emit('error', { code, message: `Connexion refusée : ${code}` });
    socket.disconnect();
  }
}
