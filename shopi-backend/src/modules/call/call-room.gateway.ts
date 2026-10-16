/* ============================================================
 * FICHIER : src/modules/call/call-room.gateway.ts
 *
 * RÔLE : Appels à plusieurs (jusqu'à 4) — ajouter une personne à un appel.
 *
 * DÉROULÉ
 *   1. A et B sont en appel 1:1. A touche « Ajouter » et choisit C :
 *      call:room-invite { peerUserId: B, inviteeUserId: C }
 *      → la salle est créée (A, B), C reçoit call:room-invite et sonne.
 *   2. C accepte : call:room-join { roomId } → C reçoit call:room-joined
 *      (la liste des présents) et ENVOIE UNE OFFRE à chacun (règle : c'est
 *      toujours le nouvel arrivant qui propose — jamais deux offres croisées).
 *   3. Offres / réponses / candidats ICE : call:room-signal, relayés
 *      uniquement entre deux participants de la même salle.
 *   4. Départ : call:room-leave (ou déconnexion) ; sous 2 personnes la salle
 *      se ferme (call:room-closed).
 *   A ↔ B gardent leur connexion 1:1 d'origine : elle n'est pas renégociée.
 *
 * SÉCURITÉ
 *   - Seul un participant peut inviter ; créer une salle exige un appel 1:1
 *     ACTIF entre l'inviteur et peerUserId (vérifié en base).
 *   - L'inviteur doit avoir le droit d'appeler l'invité (mêmes règles que
 *     l'appel 1:1 : CallService.assertCanCall, comptes actifs, permissions
 *     de messagerie) ; un invité déjà en appel répond « occupé ».
 *   - 4 personnes maximum (invitations en attente comprises) ; invitation
 *     valable 45 s ; seul l'invité lui-même peut l'accepter.
 *   - Noms et photos résolus côté serveur, jamais fournis par le client.
 *   - Signalisation relayée seulement entre membres d'une même salle,
 *     validée (taille des SDP/ICE) et limitée en débit par connexion.
 * ============================================================ */

import {
  WebSocketGateway, WebSocketServer, SubscribeMessage, ConnectedSocket, MessageBody,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy, OnModuleInit, UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import type { Server } from 'socket.io';

import type { AuthenticatedSocket } from '../messagerie/interfaces/messaging.interfaces';
import { SocketFloodGuard } from '../messagerie/utils/socket-flood-guard';
import { WsValidationExceptionFilter } from '../messagerie/filters/ws-validation.filter';
import { getSocketAllowedOrigins } from '../../common/utils/socket-cors.util';
import { CallService } from './call.service';
import { CallRoomRegistry, type CallRoom, type InviteRefusal, type RoomMember } from './call-room.registry';
import { CallRoomInviteDto, CallRoomRefDto, CallRoomSignalDto } from './dto/call-room.dto';

const SIGNAL_FLOOD_MAX       = 200;      // 3 interlocuteurs → plus de candidats ICE qu'en 1:1
const SIGNAL_FLOOD_WINDOW_MS = 10_000;
const INVITE_FLOOD_MAX       = 10;
const INVITE_FLOOD_WINDOW_MS = 60_000;
const SWEEP_INTERVAL_MS      = 5_000;
export const DISCONNECT_GRACE_MS = 15_000;

const REFUSAL_MESSAGES: Record<InviteRefusal | 'busy', string> = {
  'full':            'L’appel est complet (4 personnes maximum).',
  'already-in':      'Cette personne est déjà dans l’appel.',
  'already-invited': 'Cette personne a déjà été invitée.',
  'self':            'Vous êtes déjà dans l’appel.',
  'busy':            'Cette personne est déjà en appel.',
};

@UsePipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
@UseFilters(WsValidationExceptionFilter)
@WebSocketGateway({
  namespace: '/messaging',
  cors: { origin: getSocketAllowedOrigins(), credentials: true },
  transports: ['websocket', 'polling'],
})
export class CallRoomGateway implements OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  private readonly server: Server;

  private readonly logger = new Logger(CallRoomGateway.name);
  private readonly floodGuard = new SocketFloodGuard();
  readonly registry = new CallRoomRegistry();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly callService: CallService) {}

  onModuleInit(): void {
    this.sweepTimer = setInterval(() => this.sweepInvites(), SWEEP_INTERVAL_MS);
    this.sweepTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) { clearInterval(this.sweepTimer); this.sweepTimer = null; }
  }

  // ── Envois ─────────────────────────────────────────────────────

  private toUser(userId: string, event: string, payload: object): void {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  private broadcastState(room: CallRoom): void {
    const snap = this.registry.snapshot(room);
    for (const userId of room.participants.keys()) this.toUser(userId, 'call:room-state', snap);
  }

  private refuse(socket: AuthenticatedSocket, message: string): void {
    socket.emit('call:room-error', { message });
  }

  private async member(userId: string, actorId?: string): Promise<RoomMember> {
    const info = await this.callService.getCallerDisplayInfo(userId, actorId);
    return { userId, name: info.name, avatar: info.avatar };
  }

  // ── Inviter ────────────────────────────────────────────────────

  @SubscribeMessage('call:room-invite')
  async handleInvite(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: CallRoomInviteDto,
  ): Promise<void> {
    const me = socket.data?.userId;
    if (!me) return;
    if (!this.floodGuard.allow('room-invite', me, INVITE_FLOOD_MAX, INVITE_FLOOD_WINDOW_MS)) {
      this.refuse(socket, 'Trop d’invitations envoyées. Patientez un instant.');
      return;
    }

    try {
      /* Salle existante (j'en fais partie) ou création depuis l'appel 1:1 en cours. */
      let room: CallRoom | undefined;
      if (body.roomId) {
        room = this.registry.get(body.roomId);
        if (!room || !this.registry.isParticipant(room, me)) { this.refuse(socket, 'Cet appel n’existe plus.'); return; }
      } else {
        if (!body.peerUserId) { this.refuse(socket, 'Appel introuvable.'); return; }
        const callId = await this.callService.findActiveCallId(me, body.peerUserId);
        if (!callId) { this.refuse(socket, 'Aucun appel en cours avec cette personne.'); return; }
        room = this.registry.roomForCall(callId);
        if (!room) {
          const [mine, peer] = await Promise.all([this.member(me, socket.data.actorId), this.member(body.peerUserId)]);
          room = this.registry.createFromCall(callId, body.callType ?? 'audio', [mine, peer]);
        }
      }

      const refusal = this.registry.checkInvite(room, me, body.inviteeUserId);
      if (refusal) { this.refuse(socket, REFUSAL_MESSAGES[refusal]); return; }

      /* Mêmes règles qu'un appel 1:1 : comptes actifs, droit de contacter cette personne. */
      await this.callService.assertCanCall(me, body.inviteeUserId, socket.data.actorId);
      const busy = this.registry.isInAnyRoom(body.inviteeUserId) || await this.callService.isUserBusy(body.inviteeUserId);
      if (busy) { this.refuse(socket, REFUSAL_MESSAGES.busy); return; }

      const [invitee, inviter] = await Promise.all([
        this.member(body.inviteeUserId),
        this.member(me, socket.data.actorId),
      ]);

      /* Re-vérifié après les attentes : un autre participant a pu inviter entre-temps. */
      if (!this.registry.get(room.id) || !this.registry.isParticipant(room, me)) return;
      const late = this.registry.checkInvite(room, me, body.inviteeUserId);
      if (late) { this.refuse(socket, REFUSAL_MESSAGES[late]); return; }

      this.registry.invite(room, invitee, me);
      this.logger.log(`👥 call:room-invite room=${room.id} by=${me} invitee=${body.inviteeUserId}`);

      this.toUser(body.inviteeUserId, 'call:room-invite', {
        roomId:       room.id,
        callType:     room.callType,
        inviter,
        participants: [...room.participants.values()],
        expiresAt:    room.invited.get(body.inviteeUserId)?.expiresAt,
      });
      this.broadcastState(room);
    } catch (err) {
      this.refuse(socket, (err as Error).message || 'Invitation impossible.');
    }
  }

  // ── Rejoindre / refuser / quitter ──────────────────────────────

  @SubscribeMessage('call:room-join')
  handleJoin(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: CallRoomRefDto): void {
    const me = socket.data?.userId;
    const room = me ? this.registry.get(body.roomId) : undefined;
    if (!me || !room) { this.refuse(socket, 'Cet appel est terminé.'); return; }

    const joined = this.registry.accept(room, me);
    if (!joined) { this.refuse(socket, 'L’invitation a expiré.'); this.broadcastState(room); return; }

    this.logger.log(`👥 call:room-join room=${room.id} user=${me}`);
    /* Le nouvel arrivant reçoit la liste des autres et leur envoie une offre à chacun. */
    socket.emit('call:room-joined', {
      roomId: room.id,
      callType: room.callType,
      participants: [...room.participants.values()].filter(p => p.userId !== me),
    });
    for (const userId of room.participants.keys()) {
      if (userId !== me) this.toUser(userId, 'call:room-peer-joined', { roomId: room.id, member: joined });
    }
    // Les autres appareils du même compte arrêtent de sonner.
    this.server.to(`user:${me}`).except(socket.id).emit('call:room-invite-cancelled', { roomId: room.id });
    this.broadcastState(room);
  }

  @SubscribeMessage('call:room-decline')
  handleDecline(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: CallRoomRefDto): void {
    const me = socket.data?.userId;
    const room = me ? this.registry.get(body.roomId) : undefined;
    if (!me || !room) return;
    const member = this.registry.removeInvite(room, me);
    if (!member) return;
    for (const userId of room.participants.keys()) {
      this.toUser(userId, 'call:room-declined', { roomId: room.id, member, reason: 'declined' });
    }
    this.server.to(`user:${me}`).emit('call:room-invite-cancelled', { roomId: room.id });
    this.broadcastState(room);
  }

  @SubscribeMessage('call:room-leave')
  handleLeave(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: CallRoomRefDto): void {
    const me = socket.data?.userId;
    const room = me ? this.registry.get(body.roomId) : undefined;
    if (!me || !room || !this.registry.isParticipant(room, me)) return;
    this.leaveRoom(room, me);
  }

  private leaveRoom(room: CallRoom, userId: string): void {
    const pendingInvitees = [...room.invited.keys()];
    const { left, closed, remaining } = this.registry.leave(room, userId);
    if (!left) return;
    this.logger.log(`👥 call:room-leave room=${room.id} user=${userId} closed=${closed}`);
    for (const other of remaining) this.toUser(other, 'call:room-peer-left', { roomId: room.id, userId });
    if (closed) {
      for (const other of remaining) this.toUser(other, 'call:room-closed', { roomId: room.id });
      for (const invitee of pendingInvitees) this.toUser(invitee, 'call:room-invite-cancelled', { roomId: room.id });
    } else {
      this.broadcastState(room);
    }
  }

  // ── Signalisation WebRTC ───────────────────────────────────────

  @SubscribeMessage('call:room-signal')
  handleSignal(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: CallRoomSignalDto): void {
    const me = socket.data?.userId;
    if (!me) return;
    if (!this.floodGuard.allow('room-signal', socket.id, SIGNAL_FLOOD_MAX, SIGNAL_FLOOD_WINDOW_MS)) return;
    if (!body.description && !body.candidate) return;

    const room = this.registry.get(body.roomId);
    /* Relais strictement entre deux membres de la MÊME salle — jamais vers un tiers. */
    if (!room || !this.registry.isParticipant(room, me) || !this.registry.isParticipant(room, body.targetUserId)) return;
    if (body.targetUserId === me) return;

    this.toUser(body.targetUserId, 'call:room-signal', {
      roomId: room.id,
      fromUserId: me,
      ...(body.description && { description: body.description }),
      ...(body.candidate && { candidate: body.candidate }),
    });
  }

  // ── Déconnexion & invitations expirées ─────────────────────────

  /**
   * Une micro-coupure (tunnel, passage Wi-Fi ↔ 4G) déconnecte le socket sans couper
   * les flux, qui vont d'un téléphone à l'autre : on attend avant de sortir la
   * personne de l'appel, et on ne fait rien si elle (ou un autre de ses appareils)
   * est revenue entre-temps.
   */
  handleDisconnect(socket: AuthenticatedSocket): void {
    const userId = socket.data?.userId;
    if (!userId || !this.registry.roomsOf(userId).length) return;
    const t = setTimeout(() => { void this.leaveIfGone(userId, socket.id); }, DISCONNECT_GRACE_MS);
    t.unref?.();
  }

  async leaveIfGone(userId: string, socketId: string): Promise<void> {
    try {
      const others = await this.server.in(`user:${userId}`).fetchSockets();
      if (others.some(s => s.id !== socketId)) return;
    } catch { /* adaptateur indisponible : on traite comme une vraie déconnexion */ }

    for (const room of this.registry.roomsOf(userId)) {
      if (room.invited.has(userId) && !room.participants.has(userId)) {
        const member = this.registry.removeInvite(room, userId);
        if (member) for (const p of room.participants.keys()) this.toUser(p, 'call:room-declined', { roomId: room.id, member, reason: 'unavailable' });
        this.broadcastState(room);
      } else {
        this.leaveRoom(room, userId);
      }
    }
  }

  sweepInvites(now = Date.now()): void {
    for (const { room, member } of this.registry.expireInvites(now)) {
      for (const p of room.participants.keys()) this.toUser(p, 'call:room-declined', { roomId: room.id, member, reason: 'timeout' });
      this.toUser(member.userId, 'call:room-invite-cancelled', { roomId: room.id });
      this.broadcastState(room);
    }
  }
}
