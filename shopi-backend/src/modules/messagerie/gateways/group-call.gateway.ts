/**
 * FICHIER : src/modules/messagerie/gateways/group-call.gateway.ts
 *
 * Gateway Socket.IO pour les appels audio/vidéo de groupe.
 * Partage le namespace /messaging avec MessagerieGateway.
 *
 * ARCHITECTURE : Mesh WebRTC
 *   Chaque participant maintient une RTCPeerConnection avec chaque autre.
 *   Ce gateway est un relais pur de signalisation (SDP + ICE).
 *   Aucun flux média ne transite par le serveur.
 *
 * ÉTAT EN MÉMOIRE :
 *   Map<groupId, ActiveGroupCall> — léger, approprié pour appels éphémères.
 *   Survie au redémarrage non garantie (fonctionnalité temps réel).
 *
 * SÉCURITÉ :
 *   Appartenance au groupe vérifiée avant chaque événement.
 *   Statut du groupe vérifié (pas expired/cancelled).
 *   Signalisation relayée uniquement entre participants actifs.
 *
 * ÉVÉNEMENTS CLIENT → SERVEUR :
 *   group_call:initiate       { groupId, callType? }
 *   group_call:join           { groupId, callId }
 *   group_call:leave          { groupId, callId }
 *   group_call:decline        { groupId, callId }
 *   group_call:offer          { groupId, callId, targetUserId, sdp }
 *   group_call:answer         { groupId, callId, targetUserId, sdp }
 *   group_call:ice_candidate  { groupId, callId, targetUserId, candidate }
 *   group_call:toggle_media   { groupId, callId, audioEnabled?, videoEnabled? }
 *
 * ÉVÉNEMENTS SERVEUR → CLIENT :
 *   group_call:incoming           { callId, groupId, initiatorId, initiatorName, callType }
 *   group_call:joined             { callId, groupId, callType, participants }
 *   group_call:participant_joined { callId, userId, displayName }
 *   group_call:participant_left   { callId, userId, reason? }
 *   group_call:participant_declined { callId, userId }
 *   group_call:ended              { callId, reason }
 *   group_call:offer              { callId, fromUserId, sdp }
 *   group_call:answer             { callId, fromUserId, sdp }
 *   group_call:ice_candidate      { callId, fromUserId, candidate }
 *   group_call:media_toggled      { callId, userId, audioEnabled?, videoEnabled? }
 *   group_call:error              { code, message }
 */

import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, ConnectedSocket, MessageBody,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Server } from 'socket.io';
import { v4 as uuid } from 'uuid';

import { DeliveryGroupMember } from 'src/database/entities/delivery-group/delivery-group-member.entity';
import { DeliveryGroup }       from 'src/database/entities/delivery-group/delivery-group.entity';
import { GroupMessage, GroupMessageContentType } from 'src/database/entities/delivery-group/group-message.entity';
import { BroadcastService }    from '../services/broadcast.service';
import type { AuthenticatedSocket } from '../interfaces/messaging.interfaces';

// ── Types internes ────────────────────────────────────────────

interface CallParticipant {
  displayName: string;
  joinedAt:    Date;
}

interface ActiveGroupCall {
  callId:          string;
  groupId:         string;
  initiatorId:     string;
  initiatorName:   string;
  callType:        'audio' | 'video';
  startedAt:       Date;
  /** Nombre max de participants simultanés (pour détecter appel manqué) */
  maxParticipants: number;
  /** userId → info participant */
  participants:    Map<string, CallParticipant>;
  /** Membres ayant rejoint l'appel au moins une fois */
  everJoined:      Set<string>;
  /** Membres ayant explicitement décliné */
  declined:        Set<string>;
}

// ── Payloads entrants ─────────────────────────────────────────

interface InitiatePayload {
  groupId:   string;
  callType?: 'audio' | 'video';
}

interface CallRefPayload {
  groupId: string;
  callId:  string;
}

interface SignalPayload {
  groupId:      string;
  callId:       string;
  targetUserId: string;
  sdp?:         RTCSessionDescriptionInit;
  candidate?:   RTCIceCandidateInit;
}

interface ToggleMediaPayload {
  groupId:       string;
  callId:        string;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
}

// ─────────────────────────────────────────────────────────────

@WebSocketGateway({
  namespace:  '/messaging',
  cors:       { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class GroupCallGateway implements OnGatewayDisconnect {

  @WebSocketServer()
  private readonly server: Server;

  private readonly logger = new Logger(GroupCallGateway.name);

  /** groupId → appel actif */
  private readonly activeCalls = new Map<string, ActiveGroupCall>();

  constructor(
    @InjectRepository(DeliveryGroupMember)
    private readonly memberRepo:  Repository<DeliveryGroupMember>,
    @InjectRepository(DeliveryGroup)
    private readonly groupRepo:   Repository<DeliveryGroup>,
    @InjectRepository(GroupMessage)
    private readonly msgRepo:     Repository<GroupMessage>,
    private readonly broadcast:   BroadcastService,
  ) {}

  // ── Helpers d'accès ──────────────────────────────────────────

  private uid(socket: AuthenticatedSocket): string {
    return socket.data.userId;
  }

  /** Vérifie l'appartenance active au groupe — lève une erreur si non-membre. */
  private async assertMember(groupId: string, userId: string): Promise<DeliveryGroupMember> {
    const m = await this.memberRepo.findOne({ where: { groupId, userId, isActive: true } });
    if (!m) throw Object.assign(new Error('NOT_MEMBER'), { code: 'NOT_MEMBER' });
    return m;
  }

  /** Vérifie que le groupe n'est pas expiré/annulé. */
  private async assertGroupActive(groupId: string): Promise<void> {
    const g = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!g || g.status === 'expired' || g.status === 'cancelled') {
      throw Object.assign(new Error('GROUP_INACTIVE'), { code: 'GROUP_INACTIVE' });
    }
  }

  /** Récupère tous les membres actifs du groupe. */
  private getActiveMembers(groupId: string): Promise<DeliveryGroupMember[]> {
    return this.memberRepo.find({ where: { groupId, isActive: true } });
  }

  /** Émet un événement à tous les membres d'une liste. */
  private emitToMembers(members: DeliveryGroupMember[], event: string, payload: object): void {
    for (const m of members) {
      this.broadcast.emitToUser(m.userId, event, payload);
    }
  }

  /** Émet un événement à tous les membres SAUF un. */
  private emitToOthers(members: DeliveryGroupMember[], excludeUserId: string, event: string, payload: object): void {
    for (const m of members) {
      if (m.userId !== excludeUserId) {
        this.broadcast.emitToUser(m.userId, event, payload);
      }
    }
  }

  // ── Déconnexion ───────────────────────────────────────────────

  async handleDisconnect(socket: AuthenticatedSocket): Promise<void> {
    const userId = socket.data?.userId;
    if (!userId) return;

    /* Retirer l'utilisateur de tous les appels où il était participant */
    for (const [groupId, call] of this.activeCalls.entries()) {
      if (!call.participants.has(userId)) continue;

      call.participants.delete(userId);
      call.everJoined.add(userId);

      try {
        const members = await this.getActiveMembers(groupId);
        this.emitToMembers(members, 'group_call:participant_left', {
          callId: call.callId,
          userId,
          reason: 'disconnected',
        });

        if (call.participants.size === 0) {
          this.activeCalls.delete(groupId);
          this.emitToMembers(members, 'group_call:ended', { callId: call.callId, reason: 'empty' });
          this.logger.log(`[GroupCall] ${call.callId} terminé (déconnexion, plus de participants)`);
          await this.saveCallMessage(call, members);
        } else {
          await this.checkIfCallShouldEnd(call, members);
        }
      } catch { /* silencieux */ }
    }
  }

  // ── Lancer un appel ───────────────────────────────────────────

  @SubscribeMessage('group_call:initiate')
  async handleInitiate(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() payload: InitiatePayload,
  ): Promise<void> {
    const userId = this.uid(socket);
    try {
      const member = await this.assertMember(payload.groupId, userId);
      await this.assertGroupActive(payload.groupId);

      /* Un seul appel simultané par groupe */
      if (this.activeCalls.has(payload.groupId)) {
        socket.emit('group_call:error', {
          code:    'CALL_ALREADY_ACTIVE',
          message: 'Un appel est déjà en cours dans ce groupe.',
        });
        return;
      }

      const callId   = uuid();
      const callType = payload.callType ?? 'audio';
      const members  = await this.getActiveMembers(payload.groupId);

      /* Créer l'appel — l'initiateur est d'emblée participant */
      this.activeCalls.set(payload.groupId, {
        callId,
        groupId:         payload.groupId,
        initiatorId:     userId,
        initiatorName:   member.displayName,
        callType,
        startedAt:       new Date(),
        maxParticipants: 1,
        participants:    new Map([[userId, { displayName: member.displayName, joinedAt: new Date() }]]),
        everJoined:      new Set([userId]),
        declined:        new Set(),
      });

      /* L'initiateur est déjà dans l'appel → lui envoyer group_call:joined
         directement (pas group_call:incoming, sinon il verrait sa propre invitation). */
      socket.emit('group_call:joined', {
        callId,
        groupId:      payload.groupId,
        callType,
        participants: [],  // personne d'autre pour l'instant
      });

      /* Notifier uniquement les AUTRES membres */
      this.emitToOthers(members, userId, 'group_call:incoming', {
        callId,
        groupId:       payload.groupId,
        initiatorId:   userId,
        initiatorName: member.displayName,
        callType,
      });

      this.logger.log(`[GroupCall] ${callId} démarré — groupe ${payload.groupId} — initiateur ${userId}`);

      /* Sonnerie de 30 secondes — coupe l'appel si personne n'a rejoint */
      setTimeout(async () => {
        const call = this.activeCalls.get(payload.groupId);
        /* Appel déjà terminé ou remplacé, ou quelqu'un a rejoint → ignorer */
        if (!call || call.callId !== callId || call.participants.size > 1) return;
        this.activeCalls.delete(payload.groupId);
        const m = await this.getActiveMembers(payload.groupId);
        this.emitToMembers(m, 'group_call:ended', { callId, reason: 'timeout' });
        this.logger.log(`[GroupCall] ${callId} terminé — sonnerie 30 s sans réponse`);
        await this.saveCallMessage(call, m);
      }, 30_000);
    } catch (e: any) {
      socket.emit('group_call:error', { code: e.code ?? 'ERROR', message: e.message });
    }
  }

  // ── Rejoindre un appel ────────────────────────────────────────

  @SubscribeMessage('group_call:join')
  async handleJoin(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() payload: CallRefPayload,
  ): Promise<void> {
    const userId = this.uid(socket);
    try {
      const member = await this.assertMember(payload.groupId, userId);

      const call = this.activeCalls.get(payload.groupId);
      if (!call || call.callId !== payload.callId) {
        socket.emit('group_call:error', { code: 'CALL_NOT_FOUND', message: 'Appel introuvable ou terminé.' });
        return;
      }

      /* Ajouter le participant (idempotent) */
      if (!call.participants.has(userId)) {
        call.participants.set(userId, { displayName: member.displayName, joinedAt: new Date() });
        call.everJoined.add(userId);
        if (call.participants.size > call.maxParticipants) {
          call.maxParticipants = call.participants.size;
        }
      }

      /* Participants déjà présents — le nouveau devra recevoir leurs offres */
      const existingPeers = [...call.participants.entries()]
        .filter(([uid]) => uid !== userId)
        .map(([uid, p]) => ({ userId: uid, displayName: p.displayName }));

      /* Confirmer au nouveau : callId, type, et qui est déjà là */
      socket.emit('group_call:joined', {
        callId:       payload.callId,
        groupId:      payload.groupId,
        callType:     call.callType,
        participants: existingPeers,
      });

      /* Notifier les autres : quelqu'un arrive — ils doivent lui envoyer une offre */
      const members = await this.getActiveMembers(payload.groupId);
      this.emitToOthers(members, userId, 'group_call:participant_joined', {
        callId:      payload.callId,
        userId,
        displayName: member.displayName,
      });

      this.logger.log(`[GroupCall] ${userId} a rejoint ${payload.callId}`);
    } catch (e: any) {
      socket.emit('group_call:error', { code: e.code ?? 'ERROR', message: e.message });
    }
  }

  // ── Quitter un appel ──────────────────────────────────────────

  @SubscribeMessage('group_call:leave')
  async handleLeave(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() payload: CallRefPayload,
  ): Promise<void> {
    const userId = this.uid(socket);
    try {
      await this.assertMember(payload.groupId, userId);

      const call = this.activeCalls.get(payload.groupId);
      if (!call || call.callId !== payload.callId) return;

      call.participants.delete(userId);
      const members = await this.getActiveMembers(payload.groupId);

      this.emitToMembers(members, 'group_call:participant_left', {
        callId: payload.callId,
        userId,
      });

      if (call.participants.size === 0) {
        this.activeCalls.delete(payload.groupId);
        this.emitToMembers(members, 'group_call:ended', { callId: payload.callId, reason: 'empty' });
        this.logger.log(`[GroupCall] ${payload.callId} terminé (plus de participants)`);
        await this.saveCallMessage(call, members);
      } else {
        await this.checkIfCallShouldEnd(call, members);
      }
    } catch { /* silencieux */ }
  }

  // ── Décliner une invitation ───────────────────────────────────

  @SubscribeMessage('group_call:decline')
  async handleDecline(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() payload: CallRefPayload,
  ): Promise<void> {
    const userId = this.uid(socket);
    try {
      await this.assertMember(payload.groupId, userId);
      const call = this.activeCalls.get(payload.groupId);
      if (!call || call.callId !== payload.callId) return;

      call.declined.add(userId);

      const members = await this.getActiveMembers(payload.groupId);
      this.emitToOthers(members, userId, 'group_call:participant_declined', {
        callId: payload.callId,
        userId,
      });

      await this.checkIfCallShouldEnd(call, members);
    } catch { /* silencieux */ }
  }

  // ── Signalisation WebRTC ──────────────────────────────────────

  @SubscribeMessage('group_call:offer')
  async handleOffer(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() payload: SignalPayload,
  ): Promise<void> {
    const userId = this.uid(socket);
    try {
      await this.assertMember(payload.groupId, userId);
      const call = this.activeCalls.get(payload.groupId);
      if (!call || call.callId !== payload.callId) return;
      /* Vérifier que les deux sont participants avant de relayer */
      if (!call.participants.has(userId) || !call.participants.has(payload.targetUserId)) return;

      this.broadcast.emitToUser(payload.targetUserId, 'group_call:offer', {
        callId:     payload.callId,
        fromUserId: userId,
        sdp:        payload.sdp,
      });
    } catch { /* silencieux */ }
  }

  @SubscribeMessage('group_call:answer')
  async handleAnswer(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() payload: SignalPayload,
  ): Promise<void> {
    const userId = this.uid(socket);
    try {
      await this.assertMember(payload.groupId, userId);
      const call = this.activeCalls.get(payload.groupId);
      if (!call || call.callId !== payload.callId) return;

      this.broadcast.emitToUser(payload.targetUserId, 'group_call:answer', {
        callId:     payload.callId,
        fromUserId: userId,
        sdp:        payload.sdp,
      });
    } catch { /* silencieux */ }
  }

  @SubscribeMessage('group_call:ice_candidate')
  async handleIceCandidate(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() payload: SignalPayload,
  ): Promise<void> {
    const userId = this.uid(socket);
    try {
      await this.assertMember(payload.groupId, userId);
      const call = this.activeCalls.get(payload.groupId);
      if (!call || call.callId !== payload.callId) return;

      this.broadcast.emitToUser(payload.targetUserId, 'group_call:ice_candidate', {
        callId:     payload.callId,
        fromUserId: userId,
        candidate:  payload.candidate,
      });
    } catch { /* silencieux */ }
  }

  // ── État micro / caméra ───────────────────────────────────────

  @SubscribeMessage('group_call:toggle_media')
  async handleToggleMedia(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() payload: ToggleMediaPayload,
  ): Promise<void> {
    const userId = this.uid(socket);
    try {
      await this.assertMember(payload.groupId, userId);
      const call = this.activeCalls.get(payload.groupId);
      if (!call || call.callId !== payload.callId) return;

      const members = await this.getActiveMembers(payload.groupId);
      this.emitToOthers(members, userId, 'group_call:media_toggled', {
        callId:       payload.callId,
        userId,
        audioEnabled: payload.audioEnabled,
        videoEnabled: payload.videoEnabled,
      });
    } catch { /* silencieux */ }
  }

  // ── Fin d'appel intelligente ──────────────────────────────────

  /**
   * Émet group_call:ended à l'initiateur s'il est seul ET que tous les
   * autres membres ont soit rejoint+raccroché, soit décliné.
   * Appelé après chaque départ / déclinaison quand il reste encore ≥1 participant.
   */
  private async checkIfCallShouldEnd(
    call:    ActiveGroupCall,
    members: DeliveryGroupMember[],
  ): Promise<void> {
    /* La règle ne s'applique que quand seul l'initiateur reste dans l'appel */
    if (call.participants.size !== 1 || !call.participants.has(call.initiatorId)) return;

    const nonInitiators = members.filter(m => m.userId !== call.initiatorId);

    /* Tous les autres membres sont comptabilisés (rejoint un jour OU décliné) */
    const allAccountedFor = nonInitiators.every(
      m => call.everJoined.has(m.userId) || call.declined.has(m.userId),
    );

    if (allAccountedFor) {
      this.activeCalls.delete(call.groupId);
      this.emitToMembers(members, 'group_call:ended', { callId: call.callId, reason: 'empty' });
      this.logger.log(`[GroupCall] ${call.callId} terminé — tous les participants ont raccroché`);
      await this.saveCallMessage(call, members);
    }
  }

  // ── Persistance appel ─────────────────────────────────────────

  private async saveCallMessage(
    call:    ActiveGroupCall,
    members: DeliveryGroupMember[],
  ): Promise<void> {
    try {
      const duration = Math.round((Date.now() - call.startedAt.getTime()) / 1000);
      const status   = call.maxParticipants >= 2 ? 'completed' : 'missed';

      const msg = await this.msgRepo.save(this.msgRepo.create({
        groupId:      call.groupId,
        senderType:   null,
        senderId:     null,
        senderUserId: call.initiatorId,
        senderName:   call.initiatorName,
        contentType:  GroupMessageContentType.CALL,
        content:      JSON.stringify({
          status,
          callType:         call.callType,
          duration:         status === 'completed' ? duration : undefined,
          participantCount: call.maxParticipants,
        }),
      }));

      const group = await this.groupRepo.findOne({ where: { id: call.groupId } });
      if (!group) return;

      const basePayload = {
        id:            msg.id,
        groupId:       call.groupId,
        senderId:      null,
        senderUserId:  call.initiatorId,
        senderName:    call.initiatorName,
        senderType:    null,
        contentType:   GroupMessageContentType.CALL,
        mediaUrl:      null, mediaName: null, mediaMimeType: null, mediaDuration: null,
        isEdited:      false, deleted: false, reactions: {}, replyToId: null, replyTo: null,
        createdAt:     msg.createdAt.toISOString(),
      };

      for (const m of members) {
        this.broadcast.emitToUser(m.userId, 'group_new_message', {
          groupId:        call.groupId,
          commandeNumero: group.commandeNumero,
          message: {
            ...basePayload,
            fromMe:  m.userId === call.initiatorId,
            content: msg.content,
          },
        });
      }
    } catch (e) {
      this.logger.error('[GroupCall] saveCallMessage error', e);
    }
  }

  // ── API interne (utilisable par d'autres services) ────────────

  /** Retourne l'état de l'appel actif d'un groupe (null si aucun). */
  getActiveCall(groupId: string): { callId: string; callType: string; participantCount: number } | null {
    const c = this.activeCalls.get(groupId);
    if (!c) return null;
    return { callId: c.callId, callType: c.callType, participantCount: c.participants.size };
  }
}
