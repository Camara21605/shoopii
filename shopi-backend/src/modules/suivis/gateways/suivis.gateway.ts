/* ============================================================
 * FICHIER : src/modules/suivis/gateways/suivis.gateway.ts
 *
 * Gateway WebSocket PRO pour les notifications de suivi en temps réel.
 *
 * ARCHITECTURE
 * ─────────────
 * - Namespace isolé : /suivis
 * - Rooms utilisateur : user-{userId}
 * - Rooms profils : {targetType}-{targetId}
 * - Compatible multi-instance (Redis adapter recommandé)
 *
 * SÉCURITÉ
 * ─────────
 * - Auth JWT vérifiée ICI, à la connexion — mêmes règles que JwtStrategy
 *   et les autres gateways (compte actif, mot de passe / déconnexion
 *   postérieurs au jeton, session unique).
 *
 *   ⚠️ BUG CORRIGÉ — la connexion lisait `socket.data.userId`, censé être
 *   « injecté par un Guard ». Or un Guard NestJS ne s'exécute jamais sur
 *   handleConnection (seulement sur les @SubscribeMessage) : userId était
 *   toujours absent et TOUTES les connexions étaient refusées.
 *
 * - Enregistré auprès de NotificationBroadcastService : le socket est
 *   coupé à la révocation de session et au bannissement du compte.
 * - `join-room` : uniquement les rooms publiques de profil
 *   ({type}-{uuid}) — jamais la room privée `user-{id}` d'un autre.
 * ============================================================ */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User, UserStatus } from '../../../database/entities/user.entity';
import { TargetActorType } from '../../../database/entities/follow/follow.entity';
import { SessionService } from '../../session/session.service';
import { NotificationBroadcastService } from '../../notifications/services/notification-broadcast.service';

import type {
  WsNewFollowerPayload,
  WsUnfollowedPayload,
} from '../dto/suivis.dto';
import { getSocketAllowedOrigins } from '../../../common/utils/socket-cors.util';

/** Rooms publiques de profil : `{targetType}-{uuid}` (compteur d'abonnés). */
const ROOM_PROFIL = new RegExp(
  `^(${Object.values(TargetActorType).join('|')})-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`,
  'i',
);

@WebSocketGateway({
  namespace: '/suivis',
  cors: {
    origin: getSocketAllowedOrigins(),
    credentials: true,
  },
})
export class SuivisGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SuivisGateway.name);

  /**
   * Map mémoire locale (OK DEV, pas utilisé pour logique critique prod)
   * → remplacer par Redis si scaling horizontal
   */
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly sessionService: SessionService,
    private readonly notifBroadcast: NotificationBroadcastService,
  ) {}

  // ─────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────

  afterInit(server: Server) {
    /* Révocation de session et bannissement coupent aussi ce namespace. */
    this.notifBroadcast.registerSessionServer(server);
    this.logger.log('🔌 Gateway /suivis initialisée');
  }

  /**
   * Vérifie le jeton et le compte. Renvoie l'id utilisateur, ou null si
   * la connexion doit être refusée.
   */
  private async authentifier(token: string): Promise<{ userId: string; sid?: string } | null> {
    let payload: { sub: string; sid?: string; iat?: number };
    try {
      payload = this.jwt.verify(token);
    } catch {
      return null;
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || user.status === UserStatus.BANNED || user.status === UserStatus.SUSPENDED) return null;

    const emisLe = payload.iat !== undefined ? new Date(payload.iat * 1000) : null;
    if (emisLe && user.lastPasswordChangedAt && new Date(user.lastPasswordChangedAt) > emisLe) return null;
    if (emisLe && user.lastLogoutAt && new Date(user.lastLogoutAt) > emisLe) return null;

    if (payload.sid && !(await this.sessionService.validateSession(payload.sub, payload.sid))) return null;

    return { userId: payload.sub, sid: payload.sid };
  }

  // ─────────────────────────────────────────────
  // CONNECTION
  // ─────────────────────────────────────────────

  async handleConnection(socket: Socket) {
    try {
      // ─── extraction token sécurisée ───
      const rawToken =
        socket.handshake.auth?.token ||
        (socket.handshake.query.token) ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

      if (!token) {
        this.logger.warn(`❌ Connexion refusée (pas de token) socket=${socket.id}`);
        return socket.disconnect();
      }

      const auth = await this.authentifier(token);

      if (!auth) {
        this.logger.warn(`❌ Connexion refusée (jeton ou compte invalide) socket=${socket.id}`);
        return socket.disconnect();
      }

      const { userId, sid } = auth;
      socket.data.userId = userId;

      // ─── join room utilisateur (+ session, pour la révocation) ───
      await socket.join(`user-${userId}`);
      if (sid) await socket.join(`session:${sid}`);

      // ─── tracking socket ───
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }

      this.userSockets.get(userId)!.add(socket.id);

      this.logger.log(`✅ Connecté user=${userId} socket=${socket.id}`);

      // ─── event handshake (frontend debug + sync) ───
      socket.emit('connected', {
        userId,
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.error(`❌ Erreur connexion socket=${socket.id}`, err);
      socket.disconnect();
    }
  }

  // ─────────────────────────────────────────────
  // DISCONNECT
  // ─────────────────────────────────────────────

  handleDisconnect(socket: Socket) {
    const userId = socket.data?.userId;

    if (!userId) return;

    const sockets = this.userSockets.get(userId);

    if (sockets) {
      sockets.delete(socket.id);

      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    this.logger.log(`🔌 Déconnecté user=${userId} socket=${socket.id}`);
  }

  // ─────────────────────────────────────────────
  // EVENTS CLIENT → SERVER
  // ─────────────────────────────────────────────

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() roomName: string,
  ) {
    /* ⚠️ FAILLE CORRIGÉE — n'importe quelle room était acceptée, y compris
     * `user-{id}` d'un autre utilisateur (ses notifications privées). */
    if (!socket.data?.userId || typeof roomName !== 'string' || !ROOM_PROFIL.test(roomName)) {
      this.logger.warn(`⛔ join-room refusé socket=${socket.id} room=${String(roomName).slice(0, 80)}`);
      return;
    }

    await socket.join(roomName);

    this.logger.debug(
      `📥 socket=${socket.id} rejoint room=${roomName}`,
    );
  }

  // ─────────────────────────────────────────────
  // EVENTS SERVER → CLIENT
  // ─────────────────────────────────────────────

  /**
   * Nouveau follower
   */
  notifyNewFollower(
    targetUserId: string,
    payload: WsNewFollowerPayload,
  ): void {
    this.server.to(`user-${targetUserId}`).emit('new-follower', {
      ...payload,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `📡 new-follower → user=${targetUserId} follower=${payload.followerName}`,
    );
  }

  /**
   * Unfollow
   */
  notifyUnfollowed(
    targetUserId: string,
    payload: WsUnfollowedPayload,
  ): void {
    this.server.to(`user-${targetUserId}`).emit('unfollowed', {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Update compteur followers
   */
  broadcastFollowersCount(
    targetType: string,
    targetId: string,
    count: number,
  ): void {
    const room = `${targetType}-${targetId}`;

    this.server.to(room).emit('followers-count-updated', {
      targetType,
      targetId,
      followersCount: count,
      timestamp: new Date().toISOString(),
    });
  }

  // ─────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────

  isUserOnline(userId: string): boolean {
    return (this.userSockets.get(userId)?.size ?? 0) > 0;
  }
}