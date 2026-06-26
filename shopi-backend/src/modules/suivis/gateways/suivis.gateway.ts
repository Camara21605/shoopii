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
 * - Auth JWT via Guard (pas dans le gateway)
 * - Connexion refusée si token invalide
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

import type {
  WsNewFollowerPayload,
  WsUnfollowedPayload,
} from '../dto/suivis.dto';

@WebSocketGateway({
  namespace: '/suivis',
  cors: {
    origin: process.env.FRONTEND_URL ?? '*',
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

  // ─────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────

  afterInit() {
    this.logger.log('🔌 Gateway /suivis initialisée');
  }

  // ─────────────────────────────────────────────
  // CONNECTION
  // ─────────────────────────────────────────────

  async handleConnection(socket: Socket) {
    try {
      // ─── extraction token sécurisée ───
      const rawToken =
        socket.handshake.auth?.token ||
        (socket.handshake.query.token as string | string[] | undefined) ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

      if (!token) {
        this.logger.warn(`❌ Connexion refusée (pas de token) socket=${socket.id}`);
        return socket.disconnect();
      }

      // ─── récupération user injecté par Guard (PRO APPROACH) ───
      const userId = socket.data?.userId;

      if (!userId) {
        this.logger.warn(`❌ userId absent (Guard manquant ?) socket=${socket.id}`);
        return socket.disconnect();
      }

      // ─── join room utilisateur ───
      await socket.join(`user-${userId}`);

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