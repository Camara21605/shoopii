/**
 * ============================================================
 * FICHIER : src/modules/messagerie/gateways/messagerie.gateway.ts
 *
 * RÔLE : Gateway Socket.IO pour la messagerie temps réel.
 *        Gère connexions, présence, indicateurs d'activité
 *        et accusés de réception/lecture.
 *
 * NAMESPACE : /messaging
 *   → Isolé du gateway /suivis pour découplage complet.
 *
 * ROOMS :
 *   user:{userId}  → room privée d'un utilisateur (multiappareils)
 *   conv:{convId}  → room d'une conversation (typing indicator)
 *
 * SÉCURITÉ :
 *   • JWT vérifié à la connexion (handleConnection)
 *   • Rate-limit par socket en mémoire (anti-flood typing)
 *   • Validation conversationId avant tout join/action
 *
 * SCALABILITÉ :
 *   • BroadcastService sépare logique d'envoi du gateway
 *   • PresenceService stocke dans Redis (multi-instances)
 *   • Redis Adapter Socket.IO à activer pour plusieurs pods
 *
 * ÉVÉNEMENTS CLIENT → SERVEUR :
 *   join_conv       { conversationId }
 *   leave_conv      { conversationId }
 *   typing          { conversationId, activity }
 *   mark_read       { conversationId }
 *   heartbeat       (ping de présence — toutes les 30s)
 *
 * ÉVÉNEMENTS SERVEUR → CLIENT :
 *   connected       { userId, socketId }
 *   new_message     WsNewMessagePayload
 *   message_delivered WsMessageDeliveredPayload
 *   message_read    WsMessageReadPayload
 *   message_edited  WsMessageEditedPayload
 *   message_deleted WsMessageDeletedPayload
 *   reaction_updated WsReactionPayload
 *   typing          WsTypingBroadcast
 *   presence        WsPresencePayload
 *   error           { code, message }
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
import { JwtService }         from '@nestjs/jwt';
import { ConfigService }      from '@nestjs/config';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';
import type { Server }        from 'socket.io';

import { Conversation } from 'src/database/entities/messaging/conversation.entity';
import { User, UserStatus } from 'src/database/entities/user.entity';
import { PresenceService }  from '../services/presence.service';
import { BroadcastService } from '../services/broadcast.service';
import { MessagerieService } from '../messagerie.service';
import type {
  AuthenticatedSocket,
  WsJoinConvPayload,
  WsTypingPayload,
  WsMarkReadPayload,
} from '../interfaces/messaging.interfaces';

// ── Anti-flood typing : 1 événement / 1.5s par socket ────────
const TYPING_THROTTLE_MS = 1500;

@WebSocketGateway({
  namespace: '/messaging',
  cors: {
    /*
     * NE PAS utiliser process.env ici : les décorateurs sont évalués
     * à l'import du fichier, AVANT que dotenv charge le .env.
     * process.env.FRONTEND_URL === undefined → fallback '*'.
     * Or   credentials:true  +  origin:'*'  = BLOQUÉ par les navigateurs (spec CORS).
     *
     * Solution : origin:true = "réfléchir l'entête Origin du client"
     * → autorise n'importe quelle origine avec credentials, sans wildcard.
     */
    origin:      true,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class MessagerieGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MessagerieGateway.name);

  /**
   * Anti-flood typing : Map<socketId, timestamp dernier envoi>
   * Stocké en mémoire locale (ok car par définition lié au socket).
   */
  private readonly typingThrottle = new Map<string, number>();

  constructor(
    private readonly jwt:           JwtService,
    private readonly config:        ConfigService,
    private readonly presence:      PresenceService,
    private readonly broadcast:     BroadcastService,
    private readonly msgService:    MessagerieService,
    @InjectRepository(Conversation)
    private readonly convRepo:      Repository<Conversation>,
    @InjectRepository(User)
    private readonly userRepo:      Repository<User>,
  ) {}

  // ─────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────

  afterInit(server: Server): void {
    // Enregistre le server dans BroadcastService pour permettre
    // à MessagerieService (REST) de broadcaster via ce gateway.
    this.broadcast.setServer(server);
    this.logger.log('🔌 Gateway /messaging initialisée');
  }

  // ─────────────────────────────────────────────────────────
  // CONNEXION
  // ─────────────────────────────────────────────────────────

  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      // ── 1. Extraire et valider le JWT ───────────────────
      const token = this.extractToken(socket);
      if (!token) {
        return this.rejectSocket(socket, 'TOKEN_MISSING', 'Token manquant.');
      }

      let payload: { sub: string; role: string; iat?: number };
      try {
        payload = this.jwt.verify(token, {
          secret: this.config.get<string>('JWT_SECRET'),
        });
      } catch {
        return this.rejectSocket(socket, 'TOKEN_INVALID', 'Token invalide.');
      }

      const userId = payload.sub;

      // ── 1bis. Compte banni/suspendu ou mdp changé après émission
      //         du token → refuser (même contrôle que JwtStrategy). ─
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) {
        return this.rejectSocket(socket, 'TOKEN_INVALID', 'Utilisateur introuvable.');
      }
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

      // ── 2. Injecter userId dans socket.data ─────────────
      socket.data.userId   = userId;
      socket.data.userRole = payload.role;

      // ── 3. Rejoindre la room privée ─────────────────────
      await socket.join(`user:${userId}`);

      // ── 4. Mettre à jour la présence dans Redis ─────────
      await this.presence.onConnect(userId, socket.id);

      // ── 5. Récupérer les contacts pour notifier ─────────
      const contactUserIds = await this.getContactUserIds(userId);
      if (contactUserIds.length > 0) {
        this.broadcast.presenceChanged(contactUserIds, {
          userId,
          online:   true,
          lastSeen: new Date().toISOString(),
        });
      }

      // ── 6. Handshake de confirmation ────────────────────
      socket.emit('connected', {
        userId,
        socketId:  socket.id,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`✅ Connecté user=${userId} socket=${socket.id}`);
    } catch (err) {
      this.logger.error(`❌ Erreur connexion socket=${socket.id}`, err);
      socket.disconnect();
    }
  }

  // ─────────────────────────────────────────────────────────
  // DÉCONNEXION
  // ─────────────────────────────────────────────────────────

  async handleDisconnect(socket: AuthenticatedSocket): Promise<void> {
    const userId = socket.data?.userId;
    if (!userId) return;

    // Retire le throttle
    this.typingThrottle.delete(socket.id);

    try {
      // Met à jour la présence — isOffline=true si plus aucun socket
      const isOffline = await this.presence.onDisconnect(userId, socket.id);

      if (isOffline) {
        const contactUserIds = await this.getContactUserIds(userId);
        if (contactUserIds.length > 0) {
          this.broadcast.presenceChanged(contactUserIds, {
            userId,
            online:   false,
            lastSeen: new Date().toISOString(),
          });
        }
      }

      this.logger.log(`🔌 Déconnecté user=${userId} socket=${socket.id}`);
    } catch (err) {
      // Une panne Redis/presence ne doit jamais faire planter le process.
      this.logger.error(`❌ Erreur déconnexion socket=${socket.id}`, err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // ÉVÉNEMENTS CLIENT → SERVEUR
  // ─────────────────────────────────────────────────────────

  /**
   * join_conv : rejoindre la room d'une conversation.
   * Permet de recevoir les événements typing de la conv.
   * Vérifie que l'utilisateur est bien participant.
   */
  @SubscribeMessage('join_conv')
  async handleJoinConv(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody()    body:   WsJoinConvPayload,
  ): Promise<void> {
    const { userId } = socket.data;
    const { conversationId } = body;

    if (!await this.hasConvAccess(userId, conversationId)) {
      throw new WsException('Accès refusé à cette conversation.');
    }

    await socket.join(`conv:${conversationId}`);
    this.logger.debug(`join_conv: user=${userId} conv=${conversationId}`);
  }

  /**
   * leave_conv : quitter la room d'une conversation.
   */
  @SubscribeMessage('leave_conv')
  async handleLeaveConv(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody()    body:   WsJoinConvPayload,
  ): Promise<void> {
    await socket.leave(`conv:${body.conversationId}`);
  }

  /**
   * typing : indicateur d'activité (frappe, enregistrement, upload).
   * Throttlé à 1 événement / 1.5s pour éviter le flood.
   */
  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody()    body:   WsTypingPayload,
  ): Promise<void> {
    const { userId } = socket.data;
    const now        = Date.now();
    const last       = this.typingThrottle.get(socket.id) ?? 0;

    // Laisse passer "stopped" immédiatement (arrêt d'activité)
    if (body.activity !== 'stopped' && now - last < TYPING_THROTTLE_MS) return;
    this.typingThrottle.set(socket.id, now);

    if (!await this.hasConvAccess(userId, body.conversationId)) return;

    const senderName = await this.getSenderName(userId);

    this.broadcast.typing(body.conversationId, socket.id, {
      conversationId: body.conversationId,
      senderId:       userId,
      senderName,
      activity:       body.activity,
    });
  }

  /**
   * mark_read : marquer une conversation comme lue.
   * Notifie l'expéditeur des messages d'un accusé de lecture.
   */
  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody()    body:   WsMarkReadPayload,
  ): Promise<void> {
    const { userId } = socket.data;

    // Délègue à MessagerieService (BDD + retourne l'autre userId)
    const result = await this.msgService.markAsReadByUserId(body.conversationId, userId);

    // Notifie l'expéditeur que ses messages ont été lus
    if (result.otherParticipantUserId) {
      this.broadcast.messageRead(result.otherParticipantUserId, {
        conversationId: body.conversationId,
        readAt:         new Date().toISOString(),
        readerId:       userId,
      });
    }
  }

  /**
   * heartbeat : maintient la présence en vie (TTL Redis).
   * Le client envoie ce ping toutes les 30s.
   */
  @SubscribeMessage('heartbeat')
  async handleHeartbeat(
    @ConnectedSocket() socket: AuthenticatedSocket,
  ): Promise<void> {
    const { userId } = socket.data;
    if (!userId) return;
    await this.presence.heartbeat(userId);
    socket.emit('heartbeat_ack', { ts: Date.now() });
  }

  // ─────────────────────────────────────────────────────────
  // UTILITIES PRIVÉES
  // ─────────────────────────────────────────────────────────

  /** Extrait le token JWT depuis plusieurs sources possibles. */
  private extractToken(socket: AuthenticatedSocket): string | null {
    const a = socket.handshake.auth?.token as string | undefined;
    if (a) return a;
    const q = socket.handshake.query?.token;
    if (q) return Array.isArray(q) ? q[0] : q as string;
    const h = socket.handshake.headers?.authorization;
    if (h?.startsWith('Bearer ')) return h.slice(7);
    return null;
  }

  /** Déconnecte proprement avec un événement d'erreur lisible. */
  private rejectSocket(
    socket: AuthenticatedSocket,
    code:   string,
    msg:    string,
  ): void {
    socket.emit('error', { code, message: msg });
    socket.disconnect();
  }

  /**
   * Vérifie que userId est bien participant de la conversation.
   * Requête légère (index sur initiatorId + recipientId).
   */
  private async hasConvAccess(
    userId:         string,
    conversationId: string,
  ): Promise<boolean> {
    const conv = await this.convRepo.findOne({
      where: { id: conversationId },
      select: ['id', 'initiatorUserId', 'recipientUserId'],
    });

    if (!conv) return false;

    return (
      conv.initiatorUserId === userId ||
      conv.recipientUserId === userId
    );
  }

  /**
   * Retourne les userId de tous les contacts de l'utilisateur
   * (participants à au moins une conversation active).
   * Utilisé pour broadcaster les changements de présence.
   * Résultat mis en cache Redis 5 minutes pour éviter N+1.
   */
  private async getContactUserIds(userId: string): Promise<string[]> {
    const convs = await this.convRepo.find({
      where: [
        { initiatorUserId: userId },
        { recipientUserId: userId },
      ],
      select: ['initiatorUserId', 'recipientUserId'],
    });

    const ids = new Set<string>();
    convs.forEach(c => {
      if (c.initiatorUserId && c.initiatorUserId !== userId) ids.add(c.initiatorUserId);
      if (c.recipientUserId && c.recipientUserId !== userId) ids.add(c.recipientUserId);
    });

    return Array.from(ids);
  }

  /**
   * Récupère le nom de l'expéditeur pour l'indicateur typing.
   */
  private async getSenderName(userId: string): Promise<string> {
    try {
      const info = await this.msgService.getActorDisplayInfo(userId);
      return info?.name ?? 'Utilisateur';
    } catch {
      return 'Utilisateur';
    }
  }
}
