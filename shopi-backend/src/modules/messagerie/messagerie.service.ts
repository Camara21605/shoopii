/* ============================================================
 * FICHIER : src/modules/messagerie/messagerie.service.ts
 *
 * Gestion complète des conversations et messages.
 * Acteurs autorisés : client, company, delivery, correspondent.
 * Partners et admins passent par "Aide & Contact", pas la messagerie.
 * ============================================================ */

import {
  ForbiddenException, Injectable, Logger, NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Inject, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Not, Repository } from 'typeorm';
import { BroadcastService } from './services/broadcast.service';
import { PresenceService }  from './services/presence.service';
import { MessagingPermissionEngine } from './permissions/messaging-permission.engine';
import type { PermissionContext }    from './permissions/interfaces/permission-context.interface';

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
import { Follow, FollowerActorType, TargetActorType } from 'src/database/entities/follow/follow.entity';
import { UserContact }   from 'src/database/entities/contacts/user-contact.entity';
import { Commande }      from 'src/database/entities/commande/commande.entity';
import { CompanyTeamMember, TeamMemberStatus } from 'src/database/entities/company-team/company-team-member.entity';

import {
  SendMessageDto, StartConversationDto,
  EditMessageDto, DeleteMessageDto, ToggleReactionDto,
  ArchiveConversationDto,
} from './dto/messagerie.dto';
import { NotificationEventService } from 'src/modules/notifications/events/notification-event.service';

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
  mediaDuration: number | null;
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
    @InjectRepository(Follow)       private readonly followRepo: Repository<Follow>,
    @InjectRepository(UserContact)  private readonly contactRepo: Repository<UserContact>,
    @InjectRepository(Commande)     private readonly commandeRepo: Repository<Commande>,
    @InjectRepository(CompanyTeamMember) private readonly teamMemberRepo: Repository<CompanyTeamMember>,
    /*
     * BroadcastService injecté optionnellement (@Optional) :
     * évite la dépendance circulaire MessagerieService ↔ Gateway.
     * Le server Socket.IO est enregistré dans BroadcastService
     * par MessagerieGateway.afterInit(), APRÈS le démarrage.
     */
    private readonly presence:    PresenceService,
    @Optional() @Inject(BroadcastService)
    private readonly broadcastSvc?: BroadcastService,
    @Optional()
    private readonly notifEventSvc?: NotificationEventService,
    @Optional()
    private readonly permissionEngine?: MessagingPermissionEngine,
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

  /**
   * Résout TOUS les userId habilités à agir comme un acteur donné —
   * pas seulement le userId dénormalisé sur la conversation.
   *
   * Cas COMPANY : le propriétaire (entreprises.userId) PEUT ne pas être
   * la personne réellement connectée — un membre d'équipe (§CompanyTeamMember,
   * cf. AuthService.findProfileId) opère la même entreprise sous son PROPRE
   * userId. Diffuser uniquement au propriétaire faisait que les messages
   * envoyés à une entreprise gérée par un collaborateur n'arrivaient JAMAIS
   * en temps réel côté collaborateur (room Socket.IO `user:{ownerUserId}`
   * jamais rejointe par son socket à lui) — seul un rechargement de page
   * (refetch REST) faisait apparaître le message, d'où l'impression de
   * messagerie "non instantanée".
   *
   * Pour les autres types d'acteur, un seul userId existe (pas de notion
   * d'équipe) — comportement inchangé.
   */
  private async resolveActorUserIds(
    type: ConversationActorType,
    profileId: string,
  ): Promise<string[]> {
    if (type !== ConversationActorType.COMPANY) {
      const uid = await this.resolveUserIdFromProfile(type, profileId);
      return uid ? [uid] : [];
    }

    const ownerUserId = await this.resolveUserIdFromProfile(type, profileId);
    const members = await this.teamMemberRepo.find({
      where:  { companyId: profileId, status: TeamMemberStatus.ACTIVE },
      select: ['userId'],
    });

    const ids = new Set<string>();
    if (ownerUserId) ids.add(ownerUserId);
    members.forEach(m => ids.add(m.userId));
    return Array.from(ids);
  }

  /** Résout le profile ID à partir du userId et du rôle JWT.
   *  Pour le rôle COMPANY, actorId (= companyId) est utilisé en fallback
   *  pour les membres d'équipe qui n'ont pas de Company avec userId=user.id. */
  private async resolveProfileId(userId: string, role: UserRole, actorId?: string): Promise<string> {
    let profile: { id: string } | null = null;
    switch (role) {
      case UserRole.CLIENT:        profile = await this.clientRepo.findOne({ where: { userId }, select: ['id'] }); break;
      case UserRole.COMPANY:
        profile = await this.companyRepo.findOne({ where: { userId }, select: ['id'] });
        if (!profile && actorId) profile = await this.companyRepo.findOne({ where: { id: actorId }, select: ['id'] });
        break;
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

  /**
   * Version BATCH de getContactInfo() — résout N contacts (issus de N
   * conversations) en O(types distincts) requêtes BDD + 1 pipeline Redis,
   * au lieu de 2×N requêtes BDD + N appels Redis séquentiels (un
   * findOne "userId" + un findOne "profil complet" PAR conversation dans
   * getContactInfo, plus un presence.isOnline() individuel).
   *
   * Utilisée par getConversations()/getArchivedConversations() qui
   * résolvent jusqu'à 50 contacts par appel — la liste des conversations
   * est l'écran le plus consulté de la messagerie, donc celui où le
   * nombre de requêtes réseau vers Supabase/Redis pèse le plus sur le
   * temps de chargement perçu.
   */
  private async getContactInfoBulk(
    items: { type: ConversationActorType; id: string }[],
  ): Promise<Map<string, { name: string; logo: string | null; online: boolean; subtitle: string; userId: string | null }>> {
    const result = new Map<string, { name: string; logo: string | null; online: boolean; subtitle: string; userId: string | null }>();
    if (items.length === 0) return result;

    const idsByType = new Map<ConversationActorType, Set<string>>();
    items.forEach(({ type, id }) => {
      if (!idsByType.has(type)) idsByType.set(type, new Set());
      idsByType.get(type)!.add(id);
    });

    const ids = (t: ConversationActorType) => Array.from(idsByType.get(t) ?? []);

    /* Une seule requête par type d'acteur présent (au maximum 5),
     * quel que soit le nombre de conversations à résoudre. */
    const [companies, deliveries, corrs, partners, clients] = await Promise.all([
      idsByType.has(ConversationActorType.COMPANY)
        ? this.companyRepo.find({ where: { id: In(ids(ConversationActorType.COMPANY)) } })
        : Promise.resolve([] as Company[]),
      idsByType.has(ConversationActorType.DELIVERY)
        ? this.deliveryRepo.find({ where: { id: In(ids(ConversationActorType.DELIVERY)) } })
        : Promise.resolve([] as Delivery[]),
      idsByType.has(ConversationActorType.CORRESPONDENT)
        ? this.corrRepo.find({ where: { id: In(ids(ConversationActorType.CORRESPONDENT)) } })
        : Promise.resolve([] as Correspondent[]),
      idsByType.has(ConversationActorType.PARTNER)
        ? this.partnerRepo.find({ where: { id: In(ids(ConversationActorType.PARTNER)) }, relations: ['user'] })
        : Promise.resolve([] as Partner[]),
      idsByType.has(ConversationActorType.CLIENT)
        ? this.clientRepo.find({ where: { id: In(ids(ConversationActorType.CLIENT)) }, relations: ['user'] })
        : Promise.resolve([] as Client[]),
    ]);

    const rowByKey = new Map<string, any>();
    companies.forEach(c  => rowByKey.set(`${ConversationActorType.COMPANY}:${c.id}`, c));
    deliveries.forEach(d => rowByKey.set(`${ConversationActorType.DELIVERY}:${d.id}`, d));
    corrs.forEach(c      => rowByKey.set(`${ConversationActorType.CORRESPONDENT}:${c.id}`, c));
    partners.forEach(p   => rowByKey.set(`${ConversationActorType.PARTNER}:${p.id}`, p));
    clients.forEach(c    => rowByKey.set(`${ConversationActorType.CLIENT}:${c.id}`, c));

    /* Présence : 1 seul pipeline Redis pour TOUS les contacts (au lieu
     * d'un GET séquentiel par contact — voir PresenceService.getBulkPresence). */
    const userIdByKey = new Map<string, string | null>();
    items.forEach(({ type, id }) => {
      const row = rowByKey.get(`${type}:${id}`);
      userIdByKey.set(`${type}:${id}`, (row as any)?.userId ?? null);
    });
    const allUserIds  = Array.from(new Set(Array.from(userIdByKey.values()).filter((v): v is string => !!v)));
    const presenceMap = await this.presence.getBulkPresence(allUserIds);

    items.forEach(({ type, id }) => {
      const key   = `${type}:${id}`;
      const row   = rowByKey.get(key);
      const uid   = userIdByKey.get(key) ?? null;
      const online = uid ? presenceMap.get(uid)?.online === true : false;

      switch (type) {
        case ConversationActorType.COMPANY:
          result.set(key, { name: row?.companyName ?? 'Boutique', logo: row?.logo ?? null, online, subtitle: 'Boutique Shopi', userId: uid });
          break;
        case ConversationActorType.DELIVERY:
          result.set(key, { name: row?.fullName ?? 'Livreur', logo: null, online, subtitle: `Livreur · ${row?.zone ?? 'Conakry'}`, userId: uid });
          break;
        case ConversationActorType.CORRESPONDENT: {
          const loc = [row?.depotCommune, row?.depotVille].filter(Boolean).join(', ');
          result.set(key, { name: row?.fullName ?? 'Correspondant', logo: null, online, subtitle: `Correspondant · ${loc || 'Conakry'}`, userId: uid });
          break;
        }
        case ConversationActorType.PARTNER: {
          const u = row?.user;
          result.set(key, { name: u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : 'Partenaire', logo: null, online, subtitle: 'Partenaire', userId: uid });
          break;
        }
        case ConversationActorType.CLIENT:
        default: {
          const u = row?.user;
          result.set(key, { name: u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : 'Client', logo: u?.profilePicture ?? null, online, subtitle: 'Client', userId: uid });
          break;
        }
      }
    });

    return result;
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

  async getConversations(userId: string, role: UserRole, actorId?: string): Promise<ConvListItem[]> {
    const myType = this.roleToActorType(role);
    const myId   = await this.resolveProfileId(userId, role, actorId);

    const conversations = await this.convRepo.find({
      where: [
        { initiatorType: myType, initiatorId: myId, status: ConversationStatus.ACTIVE, deletedByInitiator: false, archivedByInitiator: false },
        { recipientType: myType, recipientId: myId, status: ConversationStatus.ACTIVE, deletedByRecipient: false, archivedByRecipient: false },
      ],
      order: { lastMessageAt: 'DESC', updatedAt: 'DESC' },
      take:  50,
    });

    /* Résolution EN LOT (1 requête par type d'acteur + 1 pipeline Redis
     * pour toute la liste) plutôt qu'un aller-retour BDD/Redis par
     * conversation — voir getContactInfoBulk(). Pour un utilisateur avec
     * 50 conversations, ça remplace jusqu'à ~150 requêtes réseau (100
     * SELECT + 50 GET Redis) par 6 requêtes au total. */
    const contacts = conversations.map(conv => {
      const amInitiator = conv.initiatorType === myType && conv.initiatorId === myId;
      return {
        type: amInitiator ? conv.recipientType : conv.initiatorType,
        id:   amInitiator ? conv.recipientId   : conv.initiatorId,
      };
    });
    const contactMap = await this.getContactInfoBulk(contacts);

    return conversations.map((conv, i) => {
      const amInitiator  = conv.initiatorType === myType && conv.initiatorId === myId;
      const { type: contactType, id: contactId } = contacts[i];
      const unreadCount  = amInitiator ? conv.unreadCountInitiator : conv.unreadCountRecipient;
      const contact = contactMap.get(`${contactType}:${contactId}`)
        ?? { name: 'Utilisateur', logo: null, online: false, subtitle: '', userId: null };

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
    });
  }

  // ══════════════════════════════════════════════════════════════
  // 2. CRÉER OU RÉCUPÉRER UNE CONVERSATION
  // ══════════════════════════════════════════════════════════════

  async getOrCreateConversation(
    userId: string, role: UserRole,
    dto: StartConversationDto,
    ipAddress?: string,
    actorId?: string,
  ): Promise<ConvListItem> {
    const myType = this.roleToActorType(role);
    const myId   = await this.resolveProfileId(userId, role, actorId);

    if (myType === dto.targetType && myId === dto.targetId) {
      throw new ForbiddenException('Vous ne pouvez pas vous écrire à vous-même.');
    }

    /* ── VÉRIFICATION DE PERMISSION (moteur centralisé) ────────────
     * Chaque demande de nouvelle conversation passe obligatoirement
     * par le MessagingPermissionEngine avant tout accès BDD.
     * Lance ForbiddenException si refusé.
     * ──────────────────────────────────────────────────────────── */
    if (this.permissionEngine) {
      const targetUserId = await this.resolveUserIdFromProfile(dto.targetType, dto.targetId);
      const ctx: PermissionContext = {
        requestorType:   myType,
        requestorId:     myId,
        requestorUserId: userId,
        targetType:      dto.targetType,
        targetId:        dto.targetId,
        targetUserId:    targetUserId ?? undefined,
        ipAddress,
        requestedAt:     new Date(),
      };
      await this.permissionEngine.assertCanCreateConversation(ctx);
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

    // Exclure les messages que cet utilisateur a supprimés pour lui-même
    const visible = messages.filter(
      m => !(m.deletedForUserIds ?? []).includes(userId),
    );

    return visible.map(m => ({
      id:            m.id,
      fromMe:        m.senderType === (myType as unknown as MessageActorType) && m.senderId === myId,
      senderId:      m.senderId,
      senderType:    m.senderType,
      contentType:   m.contentType,
      content:       m.content,
      mediaUrl:      m.mediaUrl,
      mediaName:     m.mediaName,
      mediaMimeType: m.mediaMimeType,
      mediaDuration: m.mediaDuration ?? null,
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
    actorId?: string,
  ): Promise<MessageItem> {
    const myType = this.roleToActorType(role);
    const myId   = await this.resolveProfileId(userId, role, actorId);

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
      mediaDuration:  dto.mediaDuration ?? null,
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
      /* Réapparition : si le destinataire avait supprimé ou masqué, on remet à zéro */
      ...(amInitiator
        ? { deletedByRecipient: false, archivedByRecipient: false }
        : { deletedByInitiator: false, archivedByInitiator: false }),
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
      mediaDuration: saved.mediaDuration ?? null,
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
      const updatedConv = await this.convRepo.findOne({
        where:  { id: convId },
        select: ['unreadCountInitiator', 'unreadCountRecipient'],
      });

      const unreadForRecipient = amInitiator
        ? (updatedConv?.unreadCountRecipient ?? 1)
        : (updatedConv?.unreadCountInitiator ?? 1);

      /* Résolu à chaque envoi (pas depuis la colonne dénormalisée figée à
       * la création de la conversation) : pour une entreprise gérée par
       * plusieurs membres d'équipe, la liste des destinataires temps réel
       * peut changer au fil du temps (ajout/retrait de collaborateurs). */
      const recipientActorType = amInitiator ? conv.recipientType : conv.initiatorType;
      const recipientActorId   = amInitiator ? conv.recipientId   : conv.initiatorId;
      const recipientUserIds   = await this.resolveActorUserIds(recipientActorType, recipientActorId);

      if (recipientUserIds.length > 0) {
        this.broadcastSvc.newMessage(recipientUserIds, userId, {
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

    /*
     * Notification persistante pour le destinataire.
     * Ignorée pour les messages de type CALL (gérés côté appel).
     * Fire-and-forget : les erreurs sont absorbées dans le service.
     */
    if (this.notifEventSvc && dto.contentType !== MessageContentType.CALL) {
      const recipientProfileType = amInitiator ? conv.recipientType : conv.initiatorType;
      const recipientProfileId   = amInitiator ? conv.recipientId   : conv.initiatorId;
      void this.getContactInfo(myType, myId).then(info =>
        this.notifEventSvc!.notifyMessageReceived({
          recipientType:  recipientProfileType,
          recipientId:    recipientProfileId,
          actorType:      myType,
          actorId:        myId,
          senderName:     info.name,
          preview,
          conversationId: convId,
        }),
      );
    }

    return result;
  }

  // ══════════════════════════════════════════════════════════════
  // 5. MARQUER UNE CONVERSATION COMME LUE (REST — avec rôle)
  // ══════════════════════════════════════════════════════════════

  async markAsRead(userId: string, role: UserRole, convId: string, actorId?: string): Promise<void> {
    const myType = this.roleToActorType(role);
    const myId   = await this.resolveProfileId(userId, role, actorId);
    const conv   = await this.assertConvAccess(convId, myType, myId);

    const amInitiator = conv.initiatorType === myType && conv.initiatorId === myId;
    await this.convRepo.update(convId, amInitiator
      ? { unreadCountInitiator: 0, lastReadAtInitiator: new Date() }
      : { unreadCountRecipient: 0, lastReadAtRecipient: new Date() },
    );
  }

  // ══════════════════════════════════════════════════════════════
  // 5b. MARQUER NON LUE (forcer 1 non-lu pour l'appelant)
  // ══════════════════════════════════════════════════════════════

  async markAsUnread(userId: string, role: UserRole, convId: string, actorId?: string): Promise<void> {
    const myType = this.roleToActorType(role);
    const myId   = await this.resolveProfileId(userId, role, actorId);
    const conv   = await this.assertConvAccess(convId, myType, myId);

    const amInitiator = conv.initiatorType === myType && conv.initiatorId === myId;
    await this.convRepo.update(convId, amInitiator
      ? { unreadCountInitiator: 1 }
      : { unreadCountRecipient: 1 },
    );
  }

  // ══════════════════════════════════════════════════════════════
  // 5c. MARQUER LUE VIA USERID (Gateway — sans rôle disponible)
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
    userId: string, role: UserRole,
    q: string,
    type?: string,
  ): Promise<UserSearchItem[]> {
    const results: UserSearchItem[] = [];
    const now      = Date.now();
    const onlineMs = 15 * 60 * 1000;
    const isOnline = (d: Date | null | undefined) =>
      d ? (now - new Date(d).getTime()) < onlineMs : false;
    const term     = q.trim();

    const myType = this.roleToActorType(role);
    const myId   = await this.resolveProfileId(userId, role);

    // ── Relations réelles de l'appelant ─────────────────────────
    // Quel que soit son rôle, un acteur n'apparaît dans les résultats
    // que s'il existe un lien avec l'appelant : commande partagée,
    // abonnement (Follow) actif dans un sens ou l'autre, hiérarchie
    // de supervision (correspondant ↔ entreprise/livreur), ou —
    // pour client↔client uniquement — un contact téléphonique.
    const relatedCompanyIds  = new Set<string>();
    const relatedDeliveryIds = new Set<string>();
    const relatedCorrIds     = new Set<string>();
    const relatedClientIds   = new Set<string>();

    // 1. Commandes partagées avec l'appelant
    const cmdColByType: Partial<Record<ConversationActorType, string>> = {
      [ConversationActorType.CLIENT]:        'clientId',
      [ConversationActorType.COMPANY]:       'companyId',
      [ConversationActorType.DELIVERY]:      'livreurId',
      [ConversationActorType.CORRESPONDENT]: 'correspondantId',
    };
    const myCmdCol = cmdColByType[myType];
    if (myCmdCol) {
      const cmdRows = await this.commandeRepo
        .createQueryBuilder('cmd')
        .select('cmd.clientId',        'clientId')
        .addSelect('cmd.companyId',              'companyId')
        .addSelect('cmd.livreurId',               'livreurId')
        .addSelect('cmd.correspondantId',         'correspondantId')
        .where(`cmd.${myCmdCol} = :id`, { id: myId })
        .getRawMany<{ clientId: string; companyId: string; livreurId: string | null; correspondantId: string | null }>();
      for (const row of cmdRows) {
        if (row.clientId && row.clientId !== myId)               relatedClientIds.add(row.clientId);
        if (row.companyId && row.companyId !== myId)             relatedCompanyIds.add(row.companyId);
        if (row.livreurId && row.livreurId !== myId)             relatedDeliveryIds.add(row.livreurId);
        if (row.correspondantId && row.correspondantId !== myId) relatedCorrIds.add(row.correspondantId);
      }
    }

    // 2. Abonnements (Follow) actifs, dans les deux sens
    const myFollowerType = myType as unknown as FollowerActorType;
    const myTargetType   = myType as unknown as TargetActorType;
    const follows = await this.followRepo.find({
      where: [
        { followerType: myFollowerType, followerId: myId, isSubscribed: true },
        { targetType: myTargetType, targetId: myId, isSubscribed: true },
      ],
      select: ['followerType', 'followerId', 'targetType', 'targetId'],
    });
    for (const f of follows) {
      const iAmFollower = f.followerType === myFollowerType && f.followerId === myId;
      const otherType   = String(iAmFollower ? f.targetType : f.followerType);
      const otherId     = iAmFollower ? f.targetId : f.followerId;
      if (otherId === myId) continue;
      if      (otherType === TargetActorType.COMPANY)       relatedCompanyIds.add(otherId);
      else if (otherType === TargetActorType.DELIVERY)      relatedDeliveryIds.add(otherId);
      else if (otherType === TargetActorType.CORRESPONDENT) relatedCorrIds.add(otherId);
      else if (otherType === TargetActorType.CLIENT)        relatedClientIds.add(otherId);
    }

    // 3. Hiérarchie de supervision (correspondant ↔ entreprise/livreur)
    if (myType === ConversationActorType.CORRESPONDENT) {
      const me = await this.corrRepo.findOne({ where: { id: myId }, select: ['companyId', 'deliveryId'] });
      if (me?.companyId)  relatedCompanyIds.add(me.companyId);
      if (me?.deliveryId) relatedDeliveryIds.add(me.deliveryId);
    }
    if (myType === ConversationActorType.COMPANY) {
      const myCorrs = await this.corrRepo.find({ where: { companyId: myId }, select: ['id'] });
      myCorrs.forEach(c => relatedCorrIds.add(c.id));
      const myDeliveries = await this.deliveryRepo.find({ where: { companyId: myId }, select: ['id'] });
      myDeliveries.forEach(d => relatedDeliveryIds.add(d.id));
    }
    if (myType === ConversationActorType.DELIVERY) {
      const me = await this.deliveryRepo.findOne({ where: { id: myId }, select: ['companyId'] });
      if (me?.companyId) relatedCompanyIds.add(me.companyId);
      const myCorrs = await this.corrRepo.find({ where: { deliveryId: myId }, select: ['id'] });
      myCorrs.forEach(c => relatedCorrIds.add(c.id));
    }

    // 4. Client ↔ client : uniquement via contacts téléphoniques synchronisés
    let contactUserIds = new Set<string>();
    if (myType === ConversationActorType.CLIENT) {
      const contacts = await this.contactRepo.find({
        where:  { ownerUserId: userId, isBlocked: false },
        select: ['matchedUserId'],
      });
      contactUserIds = new Set(
        contacts.filter(c => c.matchedUserId).map(c => c.matchedUserId as string),
      );
    }

    /* ── Entreprises ── */
    if (!type || type === ConversationActorType.COMPANY) {
      const cos = await this.companyRepo.find({
        where:     { ...(term ? { companyName: ILike(`%${term}%`) } : {}), userId: Not(userId) },
        relations: ['user'],
        take:      15,
      });
      const filtered = cos.filter(co => relatedCompanyIds.has(co.id));
      filtered.forEach(co => results.push({
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
      const filtered = livs.filter(d => relatedDeliveryIds.has(d.id));
      filtered.forEach(d => results.push({
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
      const filtered = corrs.filter(c => relatedCorrIds.has(c.id));
      filtered.forEach(c => {
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

    /* ── Clients (recherche par prénom/nom via User join) ──
       Client → client : uniquement contacts téléphoniques.
       Autres rôles → clientId::relatedClientIds (commande/follow). */
    if (!type || type === ConversationActorType.CLIENT) {
      const allowedByProfile = relatedClientIds;
      const allowedByUserId  = contactUserIds;
      if (allowedByProfile.size > 0 || allowedByUserId.size > 0) {
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
        const filtered = clients.filter(cl => allowedByProfile.has(cl.id) || allowedByUserId.has(cl.userId));
        filtered.forEach(cl => {
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
  // 7. MODIFIER UN MESSAGE
  // ══════════════════════════════════════════════════════════════

  async editMessage(
    userId: string, role: UserRole,
    messageId: string,
    dto: EditMessageDto,
    actorId?: string,
  ): Promise<MessageItem> {
    const myType = this.roleToActorType(role);
    const myId   = await this.resolveProfileId(userId, role, actorId);

    const msg = await this.msgRepo.findOne({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message introuvable.');

    /* Vérification : seul l'expéditeur peut modifier son message */
    const senderType = myType as unknown as MessageActorType;
    if (msg.senderType !== senderType || msg.senderId !== myId) {
      throw new ForbiddenException('Vous ne pouvez modifier que vos propres messages.');
    }

    /* Seuls les messages TEXT peuvent être modifiés */
    if (msg.contentType !== MessageContentType.TEXT) {
      throw new BadRequestException('Seuls les messages texte peuvent être modifiés.');
    }

    /* Délai maximum de modification : 24h (comme Telegram) */
    const maxEditMs = 24 * 60 * 60 * 1000;
    if (Date.now() - msg.createdAt.getTime() > maxEditMs) {
      throw new BadRequestException('Ce message ne peut plus être modifié (délai de 24h dépassé).');
    }

    /* Sauvegarde du contenu original si c'est la première modification */
    if (!msg.isEdited) {
      await this.msgRepo.update(messageId, {
        originalContent: msg.content,
      });
    }

    await this.msgRepo.update(messageId, {
      content:   dto.content,
      isEdited:  true,
      editedAt:  new Date(),
    });

    /* Broadcast temps réel */
    if (this.broadcastSvc) {
      const conv = await this.convRepo.findOne({
        where:  { id: msg.conversationId },
        select: ['initiatorUserId', 'recipientUserId'],
      });
      const otherUserId = conv?.initiatorUserId === userId
        ? conv?.recipientUserId
        : conv?.initiatorUserId;

      if (otherUserId) {
        this.broadcastSvc.messageEdited([otherUserId], {
          conversationId: msg.conversationId,
          messageId,
          newContent:     dto.content,
          editedAt:       new Date().toISOString(),
        });
      }
    }

    this.logger.log(`[EDIT] messageId=${messageId} by ${senderType}:${myId}`);

    return {
      id:            messageId,
      fromMe:        true,
      senderId:      myId,
      senderType:    senderType,
      contentType:   msg.contentType,
      content:       dto.content,
      mediaUrl:      msg.mediaUrl,
      mediaName:     msg.mediaName,
      mediaMimeType: msg.mediaMimeType,
      mediaDuration: msg.mediaDuration ?? null,
      createdAt:     msg.createdAt.toISOString(),
      readAt:        msg.readAt?.toISOString() ?? null,
      replyToId:     msg.replyToId,
      productId:     msg.productId,
      orderId:       msg.orderId,
      isEdited:      true,
      deletedAt:     null,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // 8. SUPPRIMER UN MESSAGE
  // ══════════════════════════════════════════════════════════════

  async deleteMessage(
    userId: string, role: UserRole,
    messageId: string,
    dto: DeleteMessageDto,
    actorId?: string,
  ): Promise<{ success: boolean; mode: string }> {
    const myType = this.roleToActorType(role);
    const myId   = await this.resolveProfileId(userId, role, actorId);

    const msg = await this.msgRepo.findOne({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message introuvable.');

    const senderType = myType as unknown as MessageActorType;
    const isOwner    = msg.senderType === senderType && msg.senderId === myId;
    const mode       = dto.mode ?? 'me';

    if (mode === 'everyone' && isOwner) {
      /* ── Supprimer pour tout le monde ── */
      await this.msgRepo.update(messageId, {
        content:     null,
        mediaUrl:    null,
        mediaName:   null,
        deletedById: myId,
      });
      await this.msgRepo.softDelete(messageId);

      if (this.broadcastSvc) {
        const conv = await this.convRepo.findOne({
          where:  { id: msg.conversationId },
          select: ['initiatorUserId', 'recipientUserId'],
        });
        const otherUserId = conv?.initiatorUserId === userId
          ? conv?.recipientUserId
          : conv?.initiatorUserId;
        if (otherUserId) {
          this.broadcastSvc.messageDeleted([otherUserId], {
            conversationId: msg.conversationId,
            messageId,
            deletedForAll:  true,
          });
        }
      }

    } else if (mode === 'me') {
      /* ── Supprimer pour moi seulement ── */
      const current = msg.deletedForUserIds ?? [];
      if (!current.includes(userId)) {
        await this.msgRepo.update(messageId, {
          deletedForUserIds: [...current, userId],
        });
      }

    } else if (mode === 'other' && isOwner) {
      /* ── Supprimer pour lui (l'autre participant) ── */
      const conv = await this.convRepo.findOne({
        where:  { id: msg.conversationId },
        select: ['initiatorUserId', 'recipientUserId'],
      });
      const otherUserId = conv?.initiatorUserId === userId
        ? conv?.recipientUserId
        : conv?.initiatorUserId;

      if (otherUserId) {
        const current = msg.deletedForUserIds ?? [];
        if (!current.includes(otherUserId)) {
          await this.msgRepo.update(messageId, {
            deletedForUserIds: [...current, otherUserId],
          });
        }
        this.broadcastSvc?.messageDeleted([otherUserId], {
          conversationId: msg.conversationId,
          messageId,
          deletedForAll:  false,
        });
      }
    }

    this.logger.log(`[DELETE] messageId=${messageId} mode=${mode} by ${senderType}:${myId}`);
    return { success: true, mode };
  }

  // ══════════════════════════════════════════════════════════════
  // 9. RÉACTIONS EMOJI
  // ══════════════════════════════════════════════════════════════

  async toggleReaction(
    userId: string, role: UserRole,
    messageId: string,
    dto: ToggleReactionDto,
    actorId?: string,
  ): Promise<{ reactions: Record<string, string[]> }> {
    const myType = this.roleToActorType(role);
    const myId   = await this.resolveProfileId(userId, role, actorId);

    const msg = await this.msgRepo.findOne({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message introuvable.');

    /* Vérifie que l'utilisateur est participant de la conversation */
    await this.assertConvAccess(msg.conversationId, myType, myId);

    /* Normalise le JSON de réactions */
    const reactions: Record<string, string[]> = msg.reactions ?? {};

    if (!reactions[dto.emoji]) reactions[dto.emoji] = [];

    const existing = reactions[dto.emoji];
    const idx      = existing.indexOf(myId);

    if (idx === -1) {
      /* Ajouter la réaction */
      existing.push(myId);
    } else {
      /* Retirer la réaction (toggle) */
      existing.splice(idx, 1);
      if (existing.length === 0) delete reactions[dto.emoji];
    }

    await this.msgRepo.update(messageId, { reactions });

    /* Broadcast aux deux participants */
    if (this.broadcastSvc) {
      const conv = await this.convRepo.findOne({
        where:  { id: msg.conversationId },
        select: ['initiatorUserId', 'recipientUserId'],
      });
      const others = [conv?.initiatorUserId, conv?.recipientUserId]
        .filter((id): id is string => !!id && id !== userId);

      if (others.length > 0) {
        this.broadcastSvc.reactionUpdated(others, {
          conversationId: msg.conversationId,
          messageId,
          emoji:   dto.emoji,
          actorId: myId,
          added:   idx === -1,
        });
      }
    }

    return { reactions };
  }

  // ══════════════════════════════════════════════════════════════
  // 10. ARCHIVER UNE CONVERSATION
  // ══════════════════════════════════════════════════════════════

  async archiveConversation(
    userId: string, role: UserRole,
    convId: string,
    dto: ArchiveConversationDto,
    actorId?: string,
  ): Promise<void> {
    const myType = this.roleToActorType(role);
    const myId   = await this.resolveProfileId(userId, role, actorId);
    const conv   = await this.assertConvAccess(convId, myType, myId);

    const amInitiator = conv.initiatorType === myType && conv.initiatorId === myId;

    await this.convRepo.update(convId, amInitiator
      ? { archivedByInitiator: dto.archived }
      : { archivedByRecipient: dto.archived },
    );
  }

  // ══════════════════════════════════════════════════════════════
  // 11. CONVERSATIONS MASQUÉES (archivées par l'acteur)
  // ══════════════════════════════════════════════════════════════

  async getArchivedConversations(userId: string, role: UserRole, actorId?: string): Promise<ConvListItem[]> {
    const myType = this.roleToActorType(role);
    const myId   = await this.resolveProfileId(userId, role, actorId);

    const conversations = await this.convRepo.find({
      where: [
        { initiatorType: myType, initiatorId: myId, status: ConversationStatus.ACTIVE, deletedByInitiator: false, archivedByInitiator: true },
        { recipientType: myType, recipientId: myId, status: ConversationStatus.ACTIVE, deletedByRecipient: false, archivedByRecipient: true },
      ],
      order: { lastMessageAt: 'DESC', updatedAt: 'DESC' },
      take:  50,
    });

    /* Résolution en lot — voir le commentaire équivalent dans getConversations(). */
    const contacts = conversations.map(conv => {
      const amInitiator = conv.initiatorType === myType && conv.initiatorId === myId;
      return {
        type: amInitiator ? conv.recipientType : conv.initiatorType,
        id:   amInitiator ? conv.recipientId   : conv.initiatorId,
      };
    });
    const contactMap = await this.getContactInfoBulk(contacts);

    return conversations.map((conv, i) => {
      const amInitiator = conv.initiatorType === myType && conv.initiatorId === myId;
      const { type: contactType, id: contactId } = contacts[i];
      const unreadCount = amInitiator ? conv.unreadCountInitiator : conv.unreadCountRecipient;
      const contact = contactMap.get(`${contactType}:${contactId}`)
        ?? { name: 'Utilisateur', logo: null, online: false, subtitle: '', userId: null };

      return {
        id:              conv.id,
        contactId,
        contactType,
        contactName:     contact.name,
        contactLogo:     contact.logo,
        contactOnline:   contact.online,
        contactUserId:   contact.userId,
        contactSubtitle: contact.subtitle,
        unreadCount,
        lastMessage:     conv.lastMessagePreview,
        lastMessageAt:   conv.lastMessageAt?.toISOString() ?? null,
      };
    });
  }

  // ══════════════════════════════════════════════════════════════
  // 12. SUPPRIMER UNE CONVERSATION (soft delete par acteur)
  // ══════════════════════════════════════════════════════════════

  async deleteConversation(userId: string, role: UserRole, convId: string, actorId?: string): Promise<void> {
    const myType = this.roleToActorType(role);
    const myId   = await this.resolveProfileId(userId, role, actorId);
    const conv   = await this.assertConvAccess(convId, myType, myId);

    const amInitiator = conv.initiatorType === myType && conv.initiatorId === myId;

    await this.convRepo.update(convId, amInitiator
      ? { deletedByInitiator: true }
      : { deletedByRecipient: true },
    );

    /* Suppression physique quand les deux côtés ont supprimé */
    const updated = await this.convRepo.findOneBy({ id: convId });
    if (updated?.deletedByInitiator && updated?.deletedByRecipient) {
      await this.convRepo.delete(convId);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // 12. MESSAGES D'UNE CONVERSATION (avec replies résolues)
  // ══════════════════════════════════════════════════════════════

  /**
   * Version enrichie de getMessages qui inclut les messages
   * cités (replyTo) pour affichage dans la bulle.
   */
  async getMessagesWithReplies(
    userId: string, role: UserRole,
    convId: string,
    page = 1, limit = 30,
    actorId?: string,
  ): Promise<(MessageItem & { replyToMessage?: MessageItem | null })[]> {
    const myType = this.roleToActorType(role);
    const myId   = await this.resolveProfileId(userId, role, actorId);

    await this.assertConvAccess(convId, myType, myId);

    const messages = await this.msgRepo.find({
      where:       { conversationId: convId },
      order:       { createdAt: 'ASC' },
      skip:        (page - 1) * limit,
      take:        limit,
      withDeleted: false,
    });

    /* Collecter les replyToIds uniques */
    const replyIds = [...new Set(messages.map(m => m.replyToId).filter(Boolean))] as string[];
    let repliesMap = new Map<string, Message>();

    if (replyIds.length > 0) {
      const replies = await this.msgRepo.findByIds(replyIds);
      replies.forEach(r => repliesMap.set(r.id, r));
    }

    const senderMsgType = myType as unknown as MessageActorType;

    return messages.map(m => {
      const base: MessageItem = {
        id:            m.id,
        fromMe:        m.senderType === senderMsgType && m.senderId === myId,
        senderId:      m.senderId,
        senderType:    m.senderType,
        contentType:   m.contentType,
        content:       m.content,
        mediaUrl:      m.mediaUrl,
        mediaName:     m.mediaName,
        mediaMimeType: m.mediaMimeType,
        mediaDuration: m.mediaDuration ?? null,
        createdAt:     m.createdAt.toISOString(),
        readAt:        m.readAt?.toISOString() ?? null,
        replyToId:     m.replyToId,
        productId:     m.productId,
        orderId:       m.orderId,
        isEdited:      m.isEdited,
        deletedAt:     m.deletedAt?.toISOString() ?? null,
      };

      const parent = m.replyToId ? repliesMap.get(m.replyToId) : null;
      return {
        ...base,
        replyToMessage: parent ? {
          id:          parent.id,
          fromMe:      parent.senderType === senderMsgType && parent.senderId === myId,
          senderId:    parent.senderId,
          senderType:  parent.senderType,
          contentType: parent.contentType,
          content:     parent.content,
          mediaUrl:      parent.mediaUrl,
          mediaName:     parent.mediaName,
          mediaMimeType: parent.mediaMimeType,
          mediaDuration: parent.mediaDuration ?? null,
          createdAt:     parent.createdAt.toISOString(),
          readAt:        null,
          replyToId:     null,
          productId:     null,
          orderId:       null,
          isEdited:      parent.isEdited,
          deletedAt:     parent.deletedAt?.toISOString() ?? null,
        } : null,
      };
    });
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
