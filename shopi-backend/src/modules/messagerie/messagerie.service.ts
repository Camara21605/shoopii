/* ============================================================
 * FICHIER : src/modules/messagerie/messagerie.service.ts
 *
 * Gestion complète des conversations et messages.
 * Tous les acteurs (client, company, delivery, correspondent,
 * partner) sont pris en charge, y compris le correspondant.
 * ============================================================ */

import {
  ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { Inject, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Not, Repository } from 'typeorm';
import { BroadcastService } from './services/broadcast.service';
import { PresenceService }  from './services/presence.service';

import {
  Conversation,
  ConversationActorType,
  ConversationStatus,
} from 'src/database/entities/messaging/conversation.entity';
import {
  Message,
  MessageActorType,
  MessageContentType,
  MessageStatus,
} from 'src/database/entities/messaging/message.entity';

import { Client }        from 'src/database/entities/profiles/client-profile.entity';
import { Company }       from 'src/database/entities/profiles/entreprise-profile.entity';
import { Delivery }      from 'src/database/entities/profiles/livreur-profile.entity';
import { Correspondent } from 'src/database/entities/profiles/correspondant-profile.entity';
import { Partner }       from 'src/database/entities/profiles/partenaire-profile.entity';
import { UserRole }      from 'src/common/enums/user-role.enum';

import { SendMessageDto, StartConversationDto } from './dto/messagerie.dto';

// ── Interfaces de réponse ─────────────────────────────────────

export interface ConvListItem {
  id:               string;
  contactId:        string;
  contactType:      string;
  contactName:      string;
  contactLogo:      string | null;
  contactOnline:    boolean;
  contactUserId:    string | null;
  contactSubtitle:  string;
  unreadCount:      number;
  lastMessage:      string | null;
  lastMessageAt:    string | null;
}

export interface MessageItem {
  id:            string;
  fromMe:        boolean;
  senderId:      string;
  senderType:    string;
  contentType:   string;
  content:       string | null;
  mediaUrl:      string | null;
  mediaName:     string | null;
  mediaMimeType: string | null;
  createdAt:     string;
  readAt:        string | null;
  replyToId:     string | null;
  productId:     string | null;
  orderId:       string | null;
  isEdited:      boolean;
  deletedAt:     string | null;
}

export interface UserSearchItem {
  id:       string;
  type:     string;
  name:     string;
  logo:     string | null;
  subtitle: string;
  online:   boolean;
}

// ── Constantes ────────────────────────────────────────────────

@Injectable()
export class MessagerieService {

  private readonly logger = new Logger(MessagerieService.name);

  constructor(
    @InjectRepository(Conversation) private readonly convRepo:   Repository<Conversation>,
    @InjectRepository(Message)      private readonly msgRepo:    Repository<Message>,
    @InjectRepository(Client)       private readonly clientRepo: Repository<Client>,
    @InjectRepository(Company)      private readonly companyRepo: Repository<Company>,
    @InjectRepository(Delivery)     private readonly deliveryRepo: Repository<Delivery>,
    @InjectRepository(Correspondent) private readonly corrRepo: Repository<Correspondent>,
    @InjectRepository(Partner)      private readonly partnerRepo: Repository<Partner>,
    /*
     * BroadcastService injecté optionnellement (@Optional) :
     * évite la dépendance circulaire MessagerieService ↔ Gateway.
     * Le server Socket.IO est enregistré dans BroadcastService
     * par MessagerieGateway.afterInit(), APRÈS le démarrage.
     */
    private readonly presence:    PresenceService,
    @Optional() @Inject(BroadcastService)
    private readonly broadcastSvc?: BroadcastService,
  ) {}

  // ══════════════════════════════════════════════════════════════
  // HELPERS INTERNES
  // ══════════════════════════════════════════════════════════════

  private roleToActorType(role: UserRole): ConversationActorType {
    const map: Partial<Record<UserRole, ConversationActorType>> = {
      [UserRole.CLIENT]:        ConversationActorType.CLIENT,
      [UserRole.COMPANY]:       ConversationActorType.COMPANY,
      [UserRole.DELIVERY]:      ConversationActorType.DELIVERY,
      [UserRole.CORRESPONDENT]: ConversationActorType.CORRESPONDENT,
      [UserRole.PARTNER]:       ConversationActorType.PARTNER,
    };
    const type = map[role];
    if (!type) throw new ForbiddenException(`Le rôle "${role}" ne peut pas utiliser la messagerie.`);
    return type;
  }

  /**
   * Résolution inverse : profileId → userId (users.id).
   * Utilisé à la création d'une conversation pour peupler
   * les colonnes dénormalisées initiatorUserId / recipientUserId.
   */
  private async resolveUserIdFromProfile(
    type: ConversationActorType,
    profileId: string,
  ): Promise<string | null> {
    let profile: { userId: string } | null = null;
    switch (type) {
      case ConversationActorType.CLIENT:
        profile = await this.clientRepo.findOne({ where: { id: profileId }, select: ['userId'] }); break;
      case ConversationActorType.COMPANY:
        profile = await this.companyRepo.findOne({ where: { id: profileId }, select: ['userId'] }); break;
      case ConversationActorType.DELIVERY:
        profile = await this.deliveryRepo.findOne({ where: { id: profileId }, select: ['userId'] }); break;
      case ConversationActorType.CORRESPONDENT:
        profile = await this.corrRepo.findOne({ where: { id: profileId }, select: ['userId'] }); break;
      case ConversationActorType.PARTNER:
        profile = await this.partnerRepo.findOne({ where: { id: profileId }, select: ['userId'] }); break;
    }
    return profile?.userId ?? null;
  }

  /** Résout le profile ID à partir du userId et du rôle JWT */
  private async resolveProfileId(userId: string, role: UserRole): Promise<string> {
    let profile: { id: string } | null = null;
    switch (role) {
      case UserRole.CLIENT:        profile = await this.clientRepo.findOne({ where: { userId }, select: ['id'] }); break;
      case UserRole.COMPANY:       profile = await this.companyRepo.findOne({ where: { userId }, select: ['id'] }); break;
      case UserRole.DELIVERY:      profile = await this.deliveryRepo.findOne({ where: { userId }, select: ['id'] }); break;
      case UserRole.CORRESPONDENT: profile = await this.corrRepo.findOne({ where: { userId }, select: ['id'] }); break;
      case UserRole.PARTNER:       profile = await this.partnerRepo.findOne({ where: { userId }, select: ['id'] }); break;
      default: throw new ForbiddenException(`Rôle "${role}" non supporté.`);
    }
    if (!profile) throw new NotFoundException('Profil introuvable pour cet utilisateur.');
    return profile.id;
  }

  /** Infos de contact d'un acteur (nom, logo, online, userId JWT) */
  private async getContactInfo(type: ConversationActorType, id: string): Promise<{
    name: string; logo: string | null; online: boolean; subtitle: string; userId: string | null;
  }> {
    const userId = await this.resolveUserIdFromProfile(type, id);
    const online = userId ? await this.presence.isOnline(userId) : false;

    switch (type) {
      case ConversationActorType.COMPANY: {
        const co = await this.companyRepo.findOne({ where: { id } });
        return {
          name:     co?.companyName ?? 'Boutique',
          logo:     co?.logo        ?? null,
          online,
          subtitle: 'Boutique Shopi',
          userId,
        };
      }
      case ConversationActorType.DELIVERY: {
        const d = await this.deliveryRepo.findOne({ where: { id } });
        return {
          name:     (d as any)?.fullName ?? 'Livreur',
          logo:     null,
          online,
          subtitle: `Livreur · ${(d as any)?.zone ?? 'Conakry'}`,
          userId,
        };
      }
      case ConversationActorType.CORRESPONDENT: {
        const c = await this.corrRepo.findOne({ where: { id } });
        const loc = [(c as any)?.depotCommune, (c as any)?.depotVille].filter(Boolean).join(', ');
        return {
          name:     (c as any)?.fullName ?? 'Correspondant',
          logo:     null,
          online,
          subtitle: `Correspondant · ${loc || 'Conakry'}`,
          userId,
        };
      }
      case ConversationActorType.PARTNER: {
        const p = await this.partnerRepo.findOne({ where: { id }, relations: ['user'] });
        const u = (p as any)?.user;
        return {
          name:     u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : 'Partenaire',
          logo:     null,
          online,
          subtitle: 'Partenaire',
          userId,
        };
      }
      case ConversationActorType.CLIENT:
      default: {
        const cl = await this.clientRepo.findOne({ where: { id }, relations: ['user'] });
        const u = (cl as any)?.user;
        return {
          name:     u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : 'Client',
          logo:     u?.profilePicture ?? null,
          online,
          subtitle: 'Client',
          userId,
        };
      }
    }
  }

  /** Normalise la paire pour garantir l'unicité A↔B */
  private normalizePair(
    typeA: ConversationActorType, idA: string,
    typeB: ConversationActorType, idB: string,
  ) {
    const keyA = `${typeA}:${idA}`;
    const keyB = `${typeB}:${idB}`;
    const [first, second] = [keyA, keyB].sort();
    const [initType, initId]  = first.split(':')  as [ConversationActorType, string];
    const [recType,  recId]   = second.split(':') as [ConversationActorType, string];
    return { initiatorType: initType, initiatorId: initId, recipientType: recType, recipientId: recId };
  }

  // ══════════════════════════════════════════════════════════════
  // 1. LISTE DES CONVERSATIONS
  // ══════════════════════════════════════════════════════════════

  async getConversations(userId: string, role: UserRole): Promise<ConvListItem[]> {
    const myType = this.roleToActorType(role);
    const myId   = await this.resolveProfileId(userId, role);

    const conversations = await this.convRepo.find({
      where: [
        { initiatorType: myType, initiatorId: myId, status: ConversationStatus.ACTIVE },
        { recipientType: myType, recipientId: myId, status: ConversationStatus.ACTIVE },
      ],
      order: { lastMessageAt: 'DESC', updatedAt: 'DESC' },
      take:  50,
    });

    const results: ConvListItem[] = [];

    for (const conv of conversations) {
      const amInitiator  = conv.initiatorType === myType && conv.initiatorId === myId;
      const contactType  = amInitiator ? conv.recipientType : conv.initiatorType;
      const contactId    = amInitiator ? conv.recipientId   : conv.initiatorId;
      const unreadCount  = amInitiator ? conv.unreadCountInitiator : conv.unreadCountRecipient;

      const contact = await this.getContactInfo(contactType, contactId);

      results.push({
        id:               conv.id,
        contactId,
        contactType,
        contactName:      contact.name,
        contactLogo:      contact.logo,
        contactOnline:    contact.online,
        contactUserId:    contact.userId,
        contactSubtitle:  contact.subtitle,
        unreadCount,
        lastMessage:      conv.lastMessagePreview,
        lastMessageAt:    conv.lastMessageAt?.toISOString() ?? null,
      });
    }

    return results;
  }

  // ══════════════════════════════════════════════════════════════
  // 2. CRÉER OU RÉCUPÉRER UNE CONVERSATION
  // ══════════════════════════════════════════════════════════════

  async getOrCreateConversation(
    userId: string, role: UserRole,
    dto: StartConversationDto,
  ): Promise<ConvListItem> {
    const myType = this.roleToActorType(role);
    const myId   = await this.resolveProfileId(userId, role);

    if (myType === dto.targetType && myId === dto.targetId) {
      throw new ForbiddenException('Vous ne pouvez pas vous écrire à vous-même.');
    }

    const { initiatorType, initiatorId, recipientType, recipientId } =
      this.normalizePair(myType, myId, dto.targetType, dto.targetId);

    let conv = await this.convRepo.findOne({
      where: { initiatorType, initiatorId, recipientType, recipientId },
    });

    if (!conv) {
      /*
       * Résolution des userId pour les colonnes dénormalisées.
       * userId = moi (connu via JWT).
       * targetUserId = lookup inversé dans la table de profil du destinataire.
       */
      const targetUserId = await this.resolveUserIdFromProfile(dto.targetType, dto.targetId);

      const initiatorUserId = (initiatorType === myType && initiatorId === myId)
        ? userId : targetUserId;
      const recipientUserId = (recipientType === myType && recipientId === myId)
        ? userId : targetUserId;

      conv = this.convRepo.create({
        initiatorType, initiatorId, initiatorUserId,
        recipientType, recipientId, recipientUserId,
        status: ConversationStatus.ACTIVE,
      });
      conv = await this.convRepo.save(conv);
      this.logger.log(`[NEW CONV] ${myType}:${myId} ↔ ${dto.targetType}:${dto.targetId}`);
    }

    const amInitiator = conv.initiatorType === myType && conv.initiatorId === myId;
    const contactType = amInitiator ? conv.recipientType : conv.initiatorType;
    const contactId   = amInitiator ? conv.recipientId   : conv.initiatorId;
    const unreadCount = amInitiator ? conv.unreadCountInitiator : conv.unreadCountRecipient;
    const contact     = await this.getContactInfo(contactType, contactId);

    return {
      id:               conv.id,
      contactId,
      contactType,
      contactName:      contact.name,
      contactLogo:      contact.logo,
      contactOnline:    contact.online,
      contactUserId:    contact.userId,
      contactSubtitle:  contact.subtitle,
      unreadCount,
      lastMessage:      conv.lastMessagePreview,
      lastMessageAt:    conv.lastMessageAt?.toISOString() ?? null,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // 3. MESSAGES D'UNE CONVERSATION
  // ══════════════════════════════════════════════════════════════

  async getMessages(
    userId: string, role: UserRole,
    convId: string,
    page = 1, limit = 30,
  ): Promise<MessageItem[]> {
    const myType = this.roleToActorType(role);
    const myId   = await this.resolveProfileId(userId, role);

    await this.assertConvAccess(convId, myType, myId);

    const messages = await this.msgRepo.find({
      where:  { conversationId: convId },
      order:  { createdAt: 'ASC' },
      skip:   (page - 1) * limit,
      take:   limit,
      withDeleted: false,
    });

    return messages.map(m => ({
      id:            m.id,
      fromMe:        m.senderType === (myType as unknown as MessageActorType) && m.senderId === myId,
      senderId:      m.senderId,
      senderType:    m.senderType,
      contentType:   m.contentType,
      content:       m.content,
      mediaUrl:      m.mediaUrl,
      mediaName:     m.mediaName,
      mediaMimeType: m.mediaMimeType,
      createdAt:     m.createdAt.toISOString(),
      readAt:        m.readAt?.toISOString() ?? null,
      replyToId:     m.replyToId,
      productId:     m.productId,
      orderId:       m.orderId,
      isEdited:    m.isEdited,
      deletedAt:   m.deletedAt?.toISOString() ?? null,
    }));
  }

  // ══════════════════════════════════════════════════════════════
  // 4. ENVOYER UN MESSAGE
  // ══════════════════════════════════════════════════════════════

  async sendMessage(
    userId: string, role: UserRole,
    convId: string,
    dto: SendMessageDto,
  ): Promise<MessageItem> {
    const myType = this.roleToActorType(role);
    const myId   = await this.resolveProfileId(userId, role);

    const conv = await this.assertConvAccess(convId, myType, myId);

    const senderType  = myType as unknown as MessageActorType;
    const contentText = dto.content?.trim() ?? null;

    /* Aperçu pour la liste des conversations */
    let callPreview = '';
    if (dto.contentType === MessageContentType.CALL && contentText) {
      try {
        const meta = JSON.parse(contentText) as { status: string; duration?: number };
        const dur  = meta.duration ? ` · ${Math.floor(meta.duration / 60)}:${String(meta.duration % 60).padStart(2,'0')}` : '';
        callPreview = meta.status === 'completed' ? `📞 Appel audio${dur}`
          : meta.status === 'missed'    ? '📞 Appel manqué'
          : meta.status === 'rejected'  ? '📞 Appel refusé'
          : meta.status === 'cancelled' ? '📞 Appel annulé'
          : meta.status === 'busy'      ? '📞 Correspondant occupé'
          : '📞 Appel';
      } catch { callPreview = '📞 Appel'; }
    }

    const preview = callPreview
      || contentText
      || (dto.contentType === MessageContentType.IMAGE ? '📷 Photo'
        : dto.contentType === MessageContentType.VIDEO ? '🎥 Vidéo'
        : dto.contentType === MessageContentType.FILE  ? `📄 ${dto.mediaName ?? 'Document'}`
        : dto.contentType === MessageContentType.AUDIO ? '🎙️ Message vocal'
        : '');

    const message = this.msgRepo.create({
      conversationId: convId,
      senderType,
      senderId:       myId,
      contentType:    dto.contentType ?? MessageContentType.TEXT,
      content:        contentText,
      mediaUrl:       dto.mediaUrl      ?? null,
      mediaName:      dto.mediaName     ?? null,
      mediaSize:      dto.mediaSize     ?? null,
      mediaMimeType:  dto.mediaMimeType ?? null,
      replyToId:      dto.replyToId     ?? null,
      productId:      dto.productId     ?? null,
      orderId:        dto.orderId       ?? null,
      status:         MessageStatus.SENT,
    });

    const saved = await this.msgRepo.save(message);

    /* Mise à jour dénormalisée de la conversation */
    const amInitiator = conv.initiatorType === myType && conv.initiatorId === myId;
    await this.convRepo.update(convId, {
      lastMessagePreview: preview.slice(0, 100),
      lastMessageAt:      new Date(),
      lastMessageId:      saved.id,
      unreadCountInitiator: amInitiator ? conv.unreadCountInitiator : conv.unreadCountInitiator + 1,
      unreadCountRecipient: amInitiator ? conv.unreadCountRecipient + 1 : conv.unreadCountRecipient,
    });

    this.logger.log(`[MSG] ${senderType}:${myId} → conv:${convId}`);

    const result: MessageItem = {
      id:            saved.id,
      fromMe:        true,
      senderId:      myId,
      senderType:    senderType,
      contentType:   saved.contentType,
      content:       saved.content,
      mediaUrl:      saved.mediaUrl,
      mediaName:     saved.mediaName,
      mediaMimeType: saved.mediaMimeType,
      createdAt:     saved.createdAt.toISOString(),
      readAt:        null,
      replyToId:     saved.replyToId,
      productId:     saved.productId,
      orderId:       saved.orderId,
      isEdited:      false,
      deletedAt:     null,
    };

    /*
     * Broadcast temps réel au destinataire via Socket.IO.
     * Fonctionne uniquement si le gateway est initialisé
     * (BroadcastService.setServer() appelé par afterInit).
     */
    if (this.broadcastSvc) {
      // Récupère le userId du destinataire depuis la conversation
      const updatedConv = await this.convRepo.findOne({
        where:  { id: convId },
        select: ['initiatorUserId', 'recipientUserId', 'lastMessagePreview', 'lastMessageAt', 'unreadCountInitiator', 'unreadCountRecipient'],
      });

      const recipientUserId = amInitiator
        ? updatedConv?.recipientUserId
        : updatedConv?.initiatorUserId;

      const unreadForRecipient = amInitiator
        ? (updatedConv?.unreadCountRecipient ?? 1)
        : (updatedConv?.unreadCountInitiator ?? 1);

      if (recipientUserId) {
        this.broadcastSvc.newMessage([recipientUserId], userId, {
          conversationId: convId,
          message: {
            id:            saved.id,
            fromMe:        false,
            senderId:      myId,
            senderType:    senderType,
            senderName:    (await this.getContactInfo(myType, myId)).name,
            contentType:   saved.contentType,
            content:       saved.content,
            mediaUrl:      saved.mediaUrl,
            mediaName:     saved.mediaName,
            mediaMimeType: saved.mediaMimeType,
            mediaSize:     saved.mediaSize,
            createdAt:     saved.createdAt.toISOString(),
            replyToId:     saved.replyToId,
          },
          convPreview: {
            lastMessage:   preview.slice(0, 100),
            lastMessageAt: new Date().toISOString(),
            unreadCount:   unreadForRecipient,
          },
        });
      }
    }

    return result;
  }

  // ══════════════════════════════════════════════════════════════
  // 5. MARQUER UNE CONVERSATION COMME LUE (REST — avec rôle)
  // ══════════════════════════════════════════════════════════════

  async markAsRead(userId: string, role: UserRole, convId: string): Promise<void> {
    const myType = this.roleToActorType(role);
    const myId   = await this.resolveProfileId(userId, role);
    const conv   = await this.assertConvAccess(convId, myType, myId);

    const amInitiator = conv.initiatorType === myType && conv.initiatorId === myId;
    await this.convRepo.update(convId, amInitiator
      ? { unreadCountInitiator: 0, lastReadAtInitiator: new Date() }
      : { unreadCountRecipient: 0, lastReadAtRecipient: new Date() },
    );
  }

  // ══════════════════════════════════════════════════════════════
  // 5b. MARQUER LUE VIA USERID (Gateway — sans rôle disponible)
  //     Retourne le userId de l'autre participant pour que le
  //     gateway puisse lui envoyer l'accusé de lecture.
  // ══════════════════════════════════════════════════════════════

  async markAsReadByUserId(
    convId: string,
    userId: string,
  ): Promise<{ otherParticipantUserId: string | null }> {
    const conv = await this.convRepo.findOne({
      where:  { id: convId },
      select: ['id', 'initiatorUserId', 'recipientUserId',
               'unreadCountInitiator', 'unreadCountRecipient'],
    });
    if (!conv) return { otherParticipantUserId: null };

    const amInitiator = conv.initiatorUserId === userId;
    const amRecipient = conv.recipientUserId === userId;

    if (!amInitiator && !amRecipient) return { otherParticipantUserId: null };

    await this.convRepo.update(convId, amInitiator
      ? { unreadCountInitiator: 0, lastReadAtInitiator: new Date() }
      : { unreadCountRecipient: 0, lastReadAtRecipient: new Date() },
    );

    return {
      otherParticipantUserId: amInitiator
        ? conv.recipientUserId
        : conv.initiatorUserId,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // 6. RECHERCHE D'UTILISATEURS (nouvelle conversation)
  //    Le CORRESPONDANT est inclus dans les résultats.
  // ══════════════════════════════════════════════════════════════

  async searchUsers(
    userId: string, _role: UserRole,
    q: string,
    type?: string,
  ): Promise<UserSearchItem[]> {
    const results: UserSearchItem[] = [];
    const now          = Date.now();
    const onlineMs     = 15 * 60 * 1000;
    const isOnline     = (d: Date | null | undefined) =>
      d ? (now - new Date(d).getTime()) < onlineMs : false;
    const term         = q.trim();

    /* ── Entreprises ── */
    if (!type || type === ConversationActorType.COMPANY) {
      const cos = await this.companyRepo.find({
        where:     { ...(term ? { companyName: ILike(`%${term}%`) } : {}), userId: Not(userId) },
        relations: ['user'],
        take:      15,
      });
      cos.forEach(co => results.push({
        id:       co.id,
        type:     ConversationActorType.COMPANY,
        name:     co.companyName,
        logo:     co.logo ?? null,
        subtitle: `Boutique · ${co.ville ?? 'Conakry'}`,
        online:   isOnline((co as any).user?.lastLoginAt),
      }));
    }

    /* ── Livreurs ── */
    if (!type || type === ConversationActorType.DELIVERY) {
      const qb = this.deliveryRepo.createQueryBuilder('d')
        .leftJoinAndSelect('d.user', 'user')
        .where('d.userId != :userId', { userId })
        .take(15);
      if (term) qb.andWhere('d.fullName LIKE :t', { t: `%${term}%` });
      const livs = await qb.getMany();
      livs.forEach(d => results.push({
        id:       d.id,
        type:     ConversationActorType.DELIVERY,
        name:     (d as any).fullName ?? 'Livreur',
        logo:     null,
        subtitle: `Livreur · ${(d as any).zone ?? 'Conakry'}`,
        online:   isOnline((d as any).user?.lastLoginAt),
      }));
    }

    /* ── Correspondants ── */
    if (!type || type === ConversationActorType.CORRESPONDENT) {
      const qb = this.corrRepo.createQueryBuilder('c')
        .leftJoinAndSelect('c.user', 'user')
        .where('c.userId != :userId', { userId })
        .take(15);
      if (term) qb.andWhere('c.fullName LIKE :t', { t: `%${term}%` });
      const corrs = await qb.getMany();
      corrs.forEach(c => {
        const loc = [(c as any).depotCommune, (c as any).depotVille].filter(Boolean).join(', ');
        results.push({
          id:       c.id,
          type:     ConversationActorType.CORRESPONDENT,
          name:     (c as any).fullName ?? 'Correspondant',
          logo:     null,
          subtitle: `Correspondant · ${loc || 'Conakry'}`,
          online:   isOnline((c as any).user?.lastLoginAt),
        });
      });
    }

    /* ── Clients (recherche par prénom/nom via User join) ── */
    if (!type || type === ConversationActorType.CLIENT) {
      const clientQb = this.clientRepo.createQueryBuilder('cl')
        .leftJoinAndSelect('cl.user', 'user')
        .where('cl.userId != :userId', { userId })
        .take(10);
      if (term) {
        clientQb.andWhere(
          `CONCAT(user.firstName, ' ', user.lastName) LIKE :t`,
          { t: `%${term}%` },
        );
      }
      const clients = await clientQb.getMany();
      clients.forEach(cl => {
        const u = (cl as any).user;
        results.push({
          id:       cl.id,
          type:     ConversationActorType.CLIENT,
          name:     u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : 'Client',
          logo:     u?.profilePicture ?? null,
          subtitle: 'Client Shopi',
          online:   isOnline(u?.lastLoginAt),
        });
      });
    }

    /* ── Partenaires ── */
    if (!type || type === ConversationActorType.PARTNER) {
      const partQb = this.partnerRepo.createQueryBuilder('p')
        .leftJoinAndSelect('p.user', 'user')
        .where('p.userId != :userId', { userId })
        .take(10);
      if (term) {
        partQb.andWhere(
          `CONCAT(user.firstName, ' ', user.lastName) LIKE :t`,
          { t: `%${term}%` },
        );
      }
      const partners = await partQb.getMany();
      partners.forEach(p => {
        const u = (p as any).user;
        results.push({
          id:       p.id,
          type:     ConversationActorType.PARTNER,
          name:     u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : 'Partenaire',
          logo:     null,
          subtitle: 'Partenaire Shopi',
          online:   isOnline(u?.lastLoginAt),
        });
      });
    }

    return results;
  }

  // ══════════════════════════════════════════════════════════════
  // MÉTHODES PUBLIQUES POUR LE GATEWAY
  // ══════════════════════════════════════════════════════════════

  /**
   * Retourne le nom d'affichage d'un acteur à partir de son userId.
   * Utilisé par le gateway pour l'indicateur "X est en train d'écrire".
   * Résout le profil actif de l'utilisateur (company, delivery, etc.).
   */
  async getActorDisplayInfo(userId: string): Promise<{ name: string } | null> {
    // Cherche dans chaque type de profil (ordre de probabilité décroissante)
    const company = await this.companyRepo.findOne({ where: { userId }, select: ['id', 'companyName'] });
    if (company) return { name: company.companyName };

    const client = await this.clientRepo.findOne({ where: { userId }, relations: ['user'], select: ['id'] });
    if (client) {
      const u = (client as any).user;
      return { name: u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : 'Client' };
    }

    const delivery = await this.deliveryRepo.findOne({ where: { userId }, select: ['id'] });
    if (delivery) return { name: (delivery as any).fullName ?? 'Livreur' };

    const corr = await this.corrRepo.findOne({ where: { userId }, select: ['id'] });
    if (corr) return { name: (corr as any).fullName ?? 'Correspondant' };

    const partner = await this.partnerRepo.findOne({ where: { userId }, relations: ['user'], select: ['id'] });
    if (partner) {
      const u = (partner as any).user;
      return { name: u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : 'Partenaire' };
    }

    return null;
  }

  /**
   * Vérifie si un userId est participant d'une conversation.
   * Utilisé par le gateway pour autoriser les événements Socket.
   */
  async hasConvAccessByUserId(convId: string, userId: string): Promise<boolean> {
    const conv = await this.convRepo.findOne({
      where:  { id: convId },
      select: ['initiatorUserId', 'recipientUserId'],
    });
    if (!conv) return false;
    return conv.initiatorUserId === userId || conv.recipientUserId === userId;
  }

  // ══════════════════════════════════════════════════════════════
  // HELPER ACCÈS CONVERSATION
  // ══════════════════════════════════════════════════════════════

  private async assertConvAccess(
    convId: string,
    myType: ConversationActorType,
    myId:   string,
  ): Promise<Conversation> {
    const conv = await this.convRepo.findOne({ where: { id: convId } });
    if (!conv) throw new NotFoundException('Conversation introuvable.');

    const isParticipant =
      (conv.initiatorType === myType && conv.initiatorId === myId) ||
      (conv.recipientType === myType && conv.recipientId === myId);

    if (!isParticipant) {
      throw new ForbiddenException('Accès refusé à cette conversation.');
    }
    return conv;
  }
}
