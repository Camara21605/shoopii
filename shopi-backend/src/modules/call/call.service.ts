/* ============================================================
 * FICHIER : src/modules/call/call.service.ts
 *
 * RÔLE : Logique métier des appels audio/vidéo — permission,
 *        anti-spam, persistance (Call = actif, CallHistory =
 *        archive), notifications.
 *
 * RÉUTILISE (ne duplique pas) :
 *   - MessagingPermissionEngine : mêmes règles Cas 1/2/3 que la
 *     messagerie (contact téléphonique, follow, commande partagée).
 *   - PresenceService : présence en ligne/hors ligne (Redis, même
 *     namespace socket /messaging que les appels).
 *   - NotificationService : création + diffusion des notifications.
 * ============================================================ */

import {
  ConflictException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { randomUUID } from 'crypto';

import { Call, CallStatus, CallType } from 'src/database/entities/call/call.entity';
import { CallHistory, CallHistoryStatus } from 'src/database/entities/call/call-history.entity';
import { User, UserStatus } from 'src/database/entities/user.entity';
import { Client }        from 'src/database/entities/profiles/client-profile.entity';
import { Company }       from 'src/database/entities/profiles/entreprise-profile.entity';
import { Delivery }      from 'src/database/entities/profiles/livreur-profile.entity';
import { Correspondent } from 'src/database/entities/profiles/correspondant-profile.entity';
import { Partner }       from 'src/database/entities/profiles/partenaire-profile.entity';
import { UserRole } from 'src/common/enums/user-role.enum';
import { ConversationActorType } from 'src/database/entities/messaging/conversation.entity';

import { MessagingPermissionEngine } from '../messagerie/permissions/messaging-permission.engine';
import type { PermissionContext }    from '../messagerie/permissions/interfaces/permission-context.interface';
import { PresenceService }           from '../messagerie/services/presence.service';
import { NotificationService }       from '../notifications/services/notification.service';
import {
  NotificationActorType, NotificationType, NotificationPriority,
} from 'src/database/entities/notification/notification.entitiy';

import type { StartCallDto } from './dto/call.dto';

/** Nombre max de tentatives d'appel par utilisateur / fenêtre de 60s. */
const RATE_LIMIT_MAX    = 10;
const RATE_LIMIT_TTL_S  = 60;

/** Forme attendue par RTCPeerConnection côté frontend (pas de lib DOM ici). */
export interface IceServerConfig {
  urls:        string | string[];
  username?:   string;
  credential?: string;
}

export type StartCallOutcome =
  | { outcome: 'ringing'; call: Call }
  | { outcome: 'busy' }
  | { outcome: 'offline' };

interface ResolvedActor {
  type: ConversationActorType;
  id:   string;
}

@Injectable()
export class CallService {
  private readonly logger = new Logger(CallService.name);

  constructor(
    @InjectRepository(Call)        private readonly callRepo:    Repository<Call>,
    @InjectRepository(CallHistory) private readonly historyRepo: Repository<CallHistory>,
    @InjectRepository(User)        private readonly userRepo:    Repository<User>,
    @InjectRepository(Client)        private readonly clientRepo: Repository<Client>,
    @InjectRepository(Company)       private readonly companyRepo: Repository<Company>,
    @InjectRepository(Delivery)      private readonly deliveryRepo: Repository<Delivery>,
    @InjectRepository(Correspondent) private readonly corrRepo: Repository<Correspondent>,
    @InjectRepository(Partner)       private readonly partnerRepo: Repository<Partner>,

    private readonly permissionEngine: MessagingPermissionEngine,
    private readonly presence:         PresenceService,
    private readonly notifications:    NotificationService,
    private readonly config:           ConfigService,

    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ── Serveurs ICE (STUN + TURN Metered.ca) ─────────────────────

  private static readonly STATIC_STUN: IceServerConfig[] = [
    { urls: 'stun:stun.l.google.com:19302'  },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  /**
   * Identifiants TURN statiques Metered.ca (host + username/credential fixes,
   * générés une fois dans le dashboard Metered — pas d'appel API externe,
   * pas d'expiration à gérer). Restent côté serveur, jamais exposés au bundle
   * frontend. Fallback STUN seul si mal configuré — les appels pourront
   * échouer derrière un NAT mobile strict, mais ne seront jamais bloqués.
   */
  async getIceServers(): Promise<IceServerConfig[]> {
    const host       = this.config.get<string>('METERED_TURN_HOST');
    const username   = this.config.get<string>('METERED_TURN_USERNAME');
    const credential = this.config.get<string>('METERED_TURN_CREDENTIAL');

    if (!host || !username || !credential) {
      this.logger.warn('[Call] METERED_TURN_HOST/USERNAME/CREDENTIAL manquants — appels en STUN seul (échoueront souvent derrière un NAT mobile)');
      return CallService.STATIC_STUN;
    }

    /* Pas de "stun:${host}" ici — le sous-domaine STUN de Metered
       (stun.relay.metered.ca) est différent du host TURN
       (global.relay.metered.ca) : les 2 entrées Google STATIC_STUN
       ci-dessus suffisent, pas besoin de deviner le bon sous-domaine. */
    return [
      ...CallService.STATIC_STUN,
      { urls: `turn:${host}:80`,               username, credential },
      { urls: `turn:${host}:80?transport=tcp`, username, credential },
      { urls: `turn:${host}:443`,              username, credential },
      { urls: `turns:${host}:443?transport=tcp`, username, credential },
    ];
  }

  // ── Résolution acteur (users.id → type + profil UUID) ────────

  private roleToActorType(role: UserRole): ConversationActorType | null {
    const map: Partial<Record<UserRole, ConversationActorType>> = {
      [UserRole.CLIENT]:        ConversationActorType.CLIENT,
      [UserRole.COMPANY]:       ConversationActorType.COMPANY,
      [UserRole.DELIVERY]:      ConversationActorType.DELIVERY,
      [UserRole.CORRESPONDENT]: ConversationActorType.CORRESPONDENT,
      [UserRole.PARTNER]:       ConversationActorType.PARTNER,
    };
    return map[role] ?? null;
  }

  private async resolveActor(userId: string, role: UserRole): Promise<ResolvedActor | null> {
    const type = this.roleToActorType(role);
    if (!type) return null;

    let profile: { id: string } | null = null;
    switch (type) {
      case ConversationActorType.CLIENT:
        profile = await this.clientRepo.findOne({ where: { userId }, select: ['id'] }); break;
      case ConversationActorType.COMPANY:
        profile = await this.companyRepo.findOne({ where: { userId }, select: ['id'] }); break;
      case ConversationActorType.DELIVERY:
        profile = await this.deliveryRepo.findOne({ where: { userId }, select: ['id'] }); break;
      case ConversationActorType.CORRESPONDENT:
        profile = await this.corrRepo.findOne({ where: { userId }, select: ['id'] }); break;
      case ConversationActorType.PARTNER:
        profile = await this.partnerRepo.findOne({ where: { userId }, select: ['id'] }); break;
    }
    return profile ? { type, id: profile.id } : null;
  }

  /** Résout (type acteur NotificationActorType, profil UUID) pour le destinataire d'une notification d'appel. */
  private async resolveNotificationRecipient(userId: string): Promise<{ type: NotificationActorType; id: string } | null> {
    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'role'] });
    if (!user) return null;
    const actor = await this.resolveActor(userId, user.role);
    if (!actor) return null;
    return { type: actor.type as unknown as NotificationActorType, id: actor.id };
  }

  // ── Vérification de permission (réutilise les règles de messagerie) ──

  async assertCanCall(callerUserId: string, calleeUserId: string): Promise<void> {
    if (callerUserId === calleeUserId) {
      throw new ForbiddenException('Vous ne pouvez pas vous appeler vous-même.');
    }

    const [caller, callee] = await Promise.all([
      this.userRepo.findOne({ where: { id: callerUserId } }),
      this.userRepo.findOne({ where: { id: calleeUserId } }),
    ]);

    if (!caller || caller.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Votre compte doit être actif pour passer un appel.');
    }
    if (!caller.phoneVerified) {
      throw new ForbiddenException('Vérifiez votre numéro de téléphone pour passer des appels.');
    }
    if (!callee || callee.status !== UserStatus.ACTIVE) {
      throw new NotFoundException('Cet utilisateur est introuvable ou son compte est inactif.');
    }
    if (!callee.phoneVerified) {
      throw new ForbiddenException('Cet utilisateur n\'a pas encore vérifié son numéro de téléphone.');
    }

    const callerActor = await this.resolveActor(callerUserId, caller.role);
    const calleeActor = await this.resolveActor(calleeUserId, callee.role);
    if (!callerActor || !calleeActor) {
      throw new ForbiddenException('Profil introuvable pour cet appel.');
    }

    const ctx: PermissionContext = {
      requestorType:   callerActor.type,
      requestorId:     callerActor.id,
      requestorUserId: callerUserId,
      targetType:      calleeActor.type,
      targetId:        calleeActor.id,
      targetUserId:    calleeUserId,
      requestedAt:     new Date(),
    };

    const result = await this.permissionEngine.check(ctx);
    if (!result.granted) {
      throw new ForbiddenException(
        `Vous ne pouvez pas encore appeler cet utilisateur (${result.reason})`,
      );
    }
  }

  // ── Occupé / anti-spam ────────────────────────────────────────

  async isUserBusy(userId: string): Promise<boolean> {
    const count = await this.callRepo.count({
      where: [{ callerId: userId }, { calleeId: userId }],
    });
    return count > 0;
  }

  /** Trouve l'appel actif entre deux utilisateurs (peu importe qui a appelé qui). */
  async findActiveCallId(userA: string, userB: string): Promise<string | null> {
    const call = await this.callRepo.findOne({
      where: [
        { callerId: userA, calleeId: userB },
        { callerId: userB, calleeId: userA },
      ],
    });
    return call?.id ?? null;
  }

  private async checkRateLimit(userId: string): Promise<void> {
    const key = `call:rate:${userId}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, RATE_LIMIT_TTL_S);
    if (count > RATE_LIMIT_MAX) {
      throw new ForbiddenException('Trop de tentatives d\'appel. Réessayez dans une minute.');
    }
  }

  // ── Cycle de vie de l'appel ───────────────────────────────────

  async startCall(callerUserId: string, dto: StartCallDto): Promise<StartCallOutcome> {
    await this.checkRateLimit(callerUserId);
    await this.assertCanCall(callerUserId, dto.calleeUserId);

    if (await this.isUserBusy(callerUserId)) {
      throw new ForbiddenException('Vous êtes déjà en appel.');
    }

    if (await this.isUserBusy(dto.calleeUserId)) {
      await this.recordShortCircuit(callerUserId, dto, CallHistoryStatus.BUSY);
      await this.notifyCaller(callerUserId, dto.calleeUserId, NotificationType.CALL_BUSY,
        'Utilisateur occupé', 'La personne que vous appelez est déjà en appel.');
      return { outcome: 'busy' };
    }

    /* isOnlineOrUnknown (pas isOnline) : une panne Redis ne doit jamais
       bloquer silencieusement tous les appels 1:1 — voir presence.service.ts. */
    const online = await this.presence.isOnlineOrUnknown(dto.calleeUserId);
    if (!online) {
      await this.recordShortCircuit(callerUserId, dto, CallHistoryStatus.MISSED);
      await this.notifyCaller(callerUserId, dto.calleeUserId, NotificationType.CALL_OFFLINE,
        'Utilisateur hors ligne', 'La personne que vous appelez est actuellement hors ligne.');
      await this.notifyCallee(dto.calleeUserId, callerUserId, NotificationType.CALL_MISSED,
        'Appel manqué', 'Vous avez manqué un appel.');
      return { outcome: 'offline' };
    }

    const call = this.callRepo.create({
      callerId:       callerUserId,
      calleeId:       dto.calleeUserId,
      conversationId: dto.conversationId ?? null,
      callType:       dto.callType,
      status:         CallStatus.RINGING,
      startedAt:      new Date(),
    });
    const saved = await this.callRepo.save(call);
    return { outcome: 'ringing', call: saved };
  }

  async acceptCall(userId: string, callId: string): Promise<Call> {
    const call = await this.callRepo.findOne({ where: { id: callId } });
    if (!call) throw new NotFoundException('Appel introuvable ou déjà terminé.');
    if (call.calleeId !== userId) {
      throw new ForbiddenException('Cet appel ne vous est pas destiné.');
    }
    call.status     = CallStatus.CONNECTED;
    call.answeredAt = new Date();
    return this.callRepo.save(call);
  }

  async rejectCall(userId: string, callId: string): Promise<void> {
    const call = await this.callRepo.findOne({ where: { id: callId } });
    if (!call) return; // déjà nettoyé — idempotent
    if (call.calleeId !== userId) {
      throw new ForbiddenException('Cet appel ne vous est pas destiné.');
    }
    await this.finalizeCall(call, CallHistoryStatus.REJECTED);
    await this.notifyCaller(call.callerId, call.calleeId, NotificationType.CALL_REJECTED,
      'Appel refusé', 'Votre appel a été refusé.');
  }

  async endCall(userId: string, callId: string): Promise<void> {
    const call = await this.callRepo.findOne({ where: { id: callId } });
    if (!call) return; // déjà nettoyé — idempotent
    if (call.callerId !== userId && call.calleeId !== userId) {
      throw new ForbiddenException('Cet appel ne vous concerne pas.');
    }

    const wasConnected = call.status === CallStatus.CONNECTED;
    await this.finalizeCall(call, wasConnected ? CallHistoryStatus.COMPLETED : CallHistoryStatus.MISSED);

    /* Un appel jamais décroché qui se termine = manqué pour le destinataire. */
    if (!wasConnected) {
      await this.notifyCallee(call.calleeId, call.callerId, NotificationType.CALL_MISSED,
        'Appel manqué', 'Vous avez manqué un appel.');
    }
  }

  /** Copie l'appel actif vers l'archive permanente puis supprime la ligne active. */
  private async finalizeCall(call: Call, status: CallHistoryStatus): Promise<void> {
    const endedAt  = new Date();
    const duration = call.answeredAt
      ? Math.max(0, Math.floor((endedAt.getTime() - call.answeredAt.getTime()) / 1000))
      : 0;

    const history = this.historyRepo.create({
      callId:         call.id,
      callerId:       call.callerId,
      calleeId:       call.calleeId,
      conversationId: call.conversationId,
      callType:       call.callType,
      status,
      startedAt:      call.startedAt,
      answeredAt:     call.answeredAt,
      endedAt,
      duration,
    });
    await this.historyRepo.save(history);
    await this.callRepo.delete({ id: call.id });
  }

  /** Cas "occupé"/"hors ligne" : aucun appel n'a jamais réellement sonné — on journalise directement dans l'historique. */
  private async recordShortCircuit(
    callerUserId: string, dto: StartCallDto, status: CallHistoryStatus,
  ): Promise<void> {
    const now = new Date();
    const history = this.historyRepo.create({
      callId:         randomUUID(),
      callerId:       callerUserId,
      calleeId:       dto.calleeUserId,
      conversationId: dto.conversationId ?? null,
      callType:       dto.callType,
      status,
      startedAt:      now,
      answeredAt:     null,
      endedAt:        now,
      duration:       0,
    });
    await this.historyRepo.save(history);
  }

  // ── Historique ────────────────────────────────────────────────

  async getHistory(userId: string, page: number, limit: number) {
    const [rows, total] = await this.historyRepo.findAndCount({
      where: [{ callerId: userId }, { calleeId: userId }],
      order: { endedAt: 'DESC' },
      skip:  (page - 1) * limit,
      take:  limit,
    });

    const data = await Promise.all(rows.map(async row => {
      const direction  = row.callerId === userId ? 'outgoing' as const : 'incoming' as const;
      const otherId    = direction === 'outgoing' ? row.calleeId : row.callerId;
      const contact    = await this.getDisplayInfo(otherId);
      return {
        id:             row.id,
        conversationId: row.conversationId,
        callType:       row.callType,
        status:         row.status,
        direction,
        contactName:    contact.name,
        contactAvatar:  contact.avatar,
        startedAt:      row.startedAt,
        answeredAt:     row.answeredAt,
        endedAt:        row.endedAt,
        duration:       row.duration,
      };
    }));

    return { data, total, page };
  }

  /** Nom + avatar affichables pour un users.id — utilisé par l'historique des appels. */
  private async getDisplayInfo(userId: string): Promise<{ name: string; avatar: string | null }> {
    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'role'] });
    if (!user) return { name: 'Utilisateur', avatar: null };

    const actor = await this.resolveActor(userId, user.role);
    if (!actor) return { name: 'Utilisateur', avatar: null };

    switch (actor.type) {
      case ConversationActorType.CLIENT: {
        const c = await this.clientRepo.findOne({ where: { id: actor.id } });
        return { name: c?.fullName ?? 'Client', avatar: null };
      }
      case ConversationActorType.COMPANY: {
        const co = await this.companyRepo.findOne({ where: { id: actor.id } });
        return { name: co?.companyName ?? 'Boutique', avatar: co?.logo ?? null };
      }
      case ConversationActorType.DELIVERY: {
        const d = await this.deliveryRepo.findOne({ where: { id: actor.id } });
        return { name: (d as any)?.fullName ?? 'Livreur', avatar: null };
      }
      case ConversationActorType.CORRESPONDENT: {
        const c = await this.corrRepo.findOne({ where: { id: actor.id } });
        return { name: (c as any)?.fullName ?? 'Correspondant', avatar: null };
      }
      case ConversationActorType.PARTNER: {
        const p = await this.partnerRepo.findOne({ where: { id: actor.id } });
        return { name: (p as any)?.fullName ?? 'Partenaire', avatar: null };
      }
      default:
        return { name: 'Utilisateur', avatar: null };
    }
  }

  // ── Notifications ─────────────────────────────────────────────

  private async notifyCaller(
    callerUserId: string, calleeUserId: string,
    type: NotificationType, title: string, body: string,
  ): Promise<void> {
    await this.notify(callerUserId, calleeUserId, type, title, body);
  }

  private async notifyCallee(
    calleeUserId: string, callerUserId: string,
    type: NotificationType, title: string, body: string,
  ): Promise<void> {
    await this.notify(calleeUserId, callerUserId, type, title, body);
  }

  private async notify(
    recipientUserId: string, actorUserId: string,
    type: NotificationType, title: string, body: string,
  ): Promise<void> {
    try {
      const recipient = await this.resolveNotificationRecipient(recipientUserId);
      if (!recipient) return;
      const actor = await this.resolveNotificationRecipient(actorUserId);

      await this.notifications.create({
        recipientType: recipient.type,
        recipientId:   recipient.id,
        actorType:     actor?.type ?? null,
        actorId:       actor?.id ?? null,
        type,
        priority:      NotificationPriority.NORMAL,
        title,
        body,
        resourceType:  'call',
      });
    } catch (e) {
      /* Une notification ratée ne doit jamais faire échouer l'appel lui-même. */
      this.logger.warn(`Échec notification d'appel (${type}) : ${(e as Error).message}`);
    }
  }
}
