/**
 * ============================================================
 * FICHIER : src/modules/support/gateways/support.gateway.ts
 *
 * RÔLE : Gateway Socket.IO pour le fil de discussion d'un ticket
 *        de support EN TEMPS RÉEL — "la communication doit être
 *        instantanée" : avant ce gateway, seule la notification-bell
 *        (bell/toast, room privée par utilisateur) existait ; un
 *        agent ou un client avec le fil déjà ouvert à l'écran ne
 *        voyait jamais arriver un nouveau message sans fermer/
 *        rouvrir ou recharger la page.
 *
 * NAMESPACE : /support
 *   → Isolé des autres gateways (mêmes garanties d'auth/session que
 *     /messaging et /notifications, code volontairement dupliqué —
 *     voir messagerie.gateway.ts, même remarque de conception).
 *
 * ROOMS :
 *   ticket:{ticketId} → rejointe par quiconque consulte activement
 *                        ce ticket (client auteur OU agent autorisé).
 *
 * SÉCURITÉ :
 *   • JWT vérifié à la connexion (mêmes contrôles que MessagerieGateway :
 *     banni/suspendu, mdp changé après émission du token, session unique).
 *   • join_ticket vérifie l'accès via SupportService.canAccessTicket()
 *     AVANT de rejoindre la room — même portée hiérarchique que les
 *     endpoints REST /support/agent/* (SupportPermissionService), pas
 *     de logique dupliquée.
 *
 * ÉVÉNEMENTS CLIENT → SERVEUR :
 *   join_ticket   { ticketId }
 *   leave_ticket  { ticketId }
 *
 * ÉVÉNEMENTS SERVEUR → CLIENT :
 *   connected             { userId, socketId }
 *   support:new_message   WsSupportMessagePayload
 *   support:ticket_updated WsSupportTicketUpdatedPayload
 *   error                 { code, message }
 * ============================================================
 */

import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService }    from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Server } from 'socket.io';

import { User, UserStatus } from '../../../database/entities/user.entity';
import { SessionService } from '../../session/session.service';
import { SupportService } from '../services/support.service';
import { SupportBroadcastService } from '../services/support-broadcast.service';
import type { AuthenticatedSocket } from '../../messagerie/interfaces/messaging.interfaces';

interface WsTicketRoomPayload { ticketId: string }

@WebSocketGateway({
  namespace: '/support',
  cors: {
    /* NE PAS utiliser process.env ici : les décorateurs sont évalués à
     * l'import du fichier, AVANT que dotenv charge le .env — même
     * remarque que messagerie.gateway.ts. origin:true = réfléchit
     * l'Origin du client, compatible credentials:true sans wildcard. */
    origin:      true,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class SupportGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SupportGateway.name);

  constructor(
    private readonly jwt:            JwtService,
    private readonly config:         ConfigService,
    private readonly sessionService: SessionService,
    private readonly supportService: SupportService,
    private readonly broadcast:      SupportBroadcastService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  afterInit(server: Server): void {
    this.broadcast.setServer(server);
    this.logger.log('🔌 Gateway /support initialisée');
  }

  // ─────────────────────────────────────────────────────────
  // CONNEXION — mêmes contrôles que MessagerieGateway
  // ─────────────────────────────────────────────────────────

  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      const token = this.extractToken(socket);
      if (!token) return this.rejectSocket(socket, 'TOKEN_MISSING', 'Token manquant.');

      let payload: { sub: string; role: string; sid?: string; iat?: number; actorId?: string };
      try {
        payload = this.jwt.verify(token, { secret: this.config.get<string>('JWT_SECRET') });
      } catch {
        return this.rejectSocket(socket, 'TOKEN_INVALID', 'Token invalide.');
      }

      const userId = payload.sub;
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) return this.rejectSocket(socket, 'TOKEN_INVALID', 'Utilisateur introuvable.');
      if (user.status === UserStatus.BANNED || user.status === UserStatus.SUSPENDED) {
        return this.rejectSocket(socket, 'ACCOUNT_DISABLED', 'Compte banni ou suspendu.');
      }
      if (user.lastPasswordChangedAt && payload.iat !== undefined) {
        const tokenIssuedAt   = new Date(payload.iat * 1000);
        const passwordChanged = new Date(user.lastPasswordChangedAt);
        if (passwordChanged > tokenIssuedAt) {
          return this.rejectSocket(socket, 'TOKEN_INVALID', 'Session expirée suite à un changement de mot de passe.');
        }
      }
      if (payload.sid && !(await this.sessionService.validateSession(userId, payload.sid))) {
        return this.rejectSocket(socket, 'SESSION_REVOKED', 'Session révoquée — connectée ailleurs.');
      }

      socket.data.userId   = userId;
      socket.data.userRole = payload.role;
      socket.data.actorId  = payload.actorId;

      socket.emit('connected', { userId, socketId: socket.id, timestamp: new Date().toISOString() });
      this.logger.log(`✅ Connecté user=${userId} socket=${socket.id}`);
    } catch (err) {
      this.logger.error(`❌ Erreur connexion socket=${socket.id}`, err);
      socket.disconnect();
    }
  }

  handleDisconnect(socket: AuthenticatedSocket): void {
    this.logger.log(`🔌 Déconnecté user=${socket.data?.userId} socket=${socket.id}`);
  }

  // ─────────────────────────────────────────────────────────
  // ÉVÉNEMENTS CLIENT → SERVEUR
  // ─────────────────────────────────────────────────────────

  @SubscribeMessage('join_ticket')
  async handleJoinTicket(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody()    body:   WsTicketRoomPayload,
  ): Promise<void> {
    const { userId, actorId, userRole } = socket.data;
    const { ticketId } = body;

    const allowed = await this.supportService.canAccessTicket(userId, actorId, userRole ?? '', ticketId);
    if (!allowed) {
      throw new WsException('Accès refusé à ce ticket.');
    }

    await socket.join(`ticket:${ticketId}`);
    this.logger.debug(`join_ticket: user=${userId} ticket=${ticketId}`);
  }

  @SubscribeMessage('leave_ticket')
  async handleLeaveTicket(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody()    body:   WsTicketRoomPayload,
  ): Promise<void> {
    await socket.leave(`ticket:${body.ticketId}`);
  }

  // ─────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────

  private extractToken(socket: AuthenticatedSocket): string | null {
    const a = socket.handshake.auth?.token as string | undefined;
    if (a) return a;
    const q = socket.handshake.query?.token;
    if (q) return Array.isArray(q) ? q[0] : q as string;
    const h = socket.handshake.headers?.authorization;
    if (h?.startsWith('Bearer ')) return h.slice(7);
    return null;
  }

  private rejectSocket(socket: AuthenticatedSocket, code: string, msg: string): void {
    socket.emit('error', { code, message: msg });
    socket.disconnect();
  }
}
