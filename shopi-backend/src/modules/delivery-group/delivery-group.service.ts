/* ============================================================
 * FICHIER : src/modules/delivery-group/delivery-group.service.ts
 *
 * Groupe de livraison automatique : créé à la validation d'une
 * commande, regroupe client + entreprise + livreur/correspondant.
 * Expire 72h après livraison confirmée.
 * ============================================================ */

import {
  BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Not, Repository } from 'typeorm';

import {
  DeliveryGroup, DeliveryGroupKind, DeliveryGroupStatus,
} from '../../database/entities/delivery-group/delivery-group.entity';
import {
  DeliveryGroupMember, GroupMemberType,
} from '../../database/entities/delivery-group/delivery-group-member.entity';
import {
  GroupMessage, GroupMessageContentType,
} from '../../database/entities/delivery-group/group-message.entity';
import { CommandeStatus } from '../../database/entities/commande/commande.entity';
import { UserRole } from '../../common/enums/user-role.enum';

import {
  SendGroupMessageDto, EditGroupMessageDto,
  DeleteGroupMessageDto, ToggleGroupReactionDto, UpdateGroupDto,
  CreateCustomGroupDto,
} from './dto/delivery-group.dto';
import { BroadcastService } from '../messagerie/services/broadcast.service';
import { MessagerieService } from '../messagerie/messagerie.service';

// ── Constantes ────────────────────────────────────────────────

const EXPIRY_HOURS = 72;

// ── Types internes ────────────────────────────────────────────

export interface CreateGroupActors {
  client:         { id: string; userId: string; name: string };
  company:        { id: string; userId: string; name: string };
  livreur?:       { id: string; userId: string; name: string };
  correspondant?: { id: string; userId: string; name: string };
}

@Injectable()
export class DeliveryGroupService {
  private readonly logger = new Logger(DeliveryGroupService.name);

  constructor(
    @InjectRepository(DeliveryGroup)
    private readonly groupRepo: Repository<DeliveryGroup>,
    @InjectRepository(DeliveryGroupMember)
    private readonly memberRepo: Repository<DeliveryGroupMember>,
    @InjectRepository(GroupMessage)
    private readonly msgRepo: Repository<GroupMessage>,
    private readonly broadcast: BroadcastService,
    private readonly messagerie: MessagerieService,
  ) {}

  // ── Création — groupe libre (⋮ > Paramètres > Ajouter un groupe) ─

  /**
   * BUG CORRIGÉ — "Ajouter un groupe" (menu ⋮ > Paramètres) n'existait
   * pas : les seuls groupes possibles étaient auto-créés par une commande
   * (voir createGroupForCommande ci-dessous). Ce groupe CUSTOM n'a ni
   * commande ni expiration automatique — il vit tant que ses membres ne
   * le suppriment pas (pas encore de suppression manuelle, à construire
   * séparément si besoin).
   */
  async createCustomGroup(
    creatorUserId: string, creatorRole: UserRole, creatorActorId: string | undefined,
    dto: CreateCustomGroupDto,
  ): Promise<object> {
    const creatorType = this.messagerie.roleToActorType(creatorRole);
    const creatorId   = await this.messagerie.resolveProfileId(creatorUserId, creatorRole, creatorActorId);
    const creatorInfo = await this.messagerie.getContactInfo(creatorType, creatorId);

    /* Résout chaque membre choisi (nom + vrai userId) — mêmes profils que
     * la recherche d'utilisateurs (GET /messagerie/users/search). */
    const resolved = await Promise.all(
      dto.members.map(async ref => ({ ref, info: await this.messagerie.getContactInfo(ref.type, ref.id) })),
    );

    const seenUserIds = new Set<string>([creatorUserId]);
    const members: Partial<DeliveryGroupMember>[] = [{
      actorType:   creatorType as unknown as GroupMemberType,
      actorId:     creatorId,
      userId:      creatorUserId,
      displayName: creatorInfo.name,
      /* Le créateur est administrateur par défaut — voir setMemberAdmin/assertGroupAdmin. */
      isAdmin:     true,
    }];

    for (const { ref, info } of resolved) {
      if (!info.userId || seenUserIds.has(info.userId)) continue; // profil introuvable ou doublon (déjà ajouté / créateur lui-même)
      seenUserIds.add(info.userId);
      members.push({
        actorType:   ref.type as unknown as GroupMemberType,
        actorId:     ref.id,
        userId:      info.userId,
        displayName: info.name,
      });
    }

    if (members.length < 2) {
      throw new BadRequestException('Sélectionnez au moins un autre membre valide pour créer le groupe.');
    }

    const group = this.groupRepo.create({
      kind:            DeliveryGroupKind.CUSTOM,
      commandeId:      null,
      commandeNumero:  null,
      companyName:     null,
      name:            dto.name.trim(),
      createdByUserId: creatorUserId,
      status:          DeliveryGroupStatus.ACTIVE,
    });
    const saved = await this.groupRepo.save(group);

    await this.memberRepo.save(
      members.map(m => this.memberRepo.create({ ...m, groupId: saved.id })),
    );

    await this.sendSystemMessage(
      saved.id,
      `🎉 ${creatorInfo.name} a créé le groupe "${saved.name}" avec ${members.length - 1} autre(s) membre(s).`,
    );

    /* Les autres membres n'ont, eux, pas encore ce groupe en mémoire —
     * useDeliveryGroups.ts recharge la liste complète sur cet événement
     * (voir onStatus > 'group_created'), commandeNumero/companyName ne
     * sont donc utiles ici que pour les AUTRES types d'événement. */
    const userIds = members.map(m => m.userId!);
    this.broadcast.groupStatusChanged(userIds, {
      event:       'group_created',
      groupId:     saved.id,
      memberCount: members.length,
    });

    this.logger.log(`[DeliveryGroup] Groupe libre "${saved.name}" créé par ${creatorUserId} (${saved.id})`);

    return {
      id:             saved.id,
      kind:           saved.kind,
      commandeId:     null,
      commandeNumero: null,
      companyName:    null,
      name:           saved.name,
      description:    null,
      status:         saved.status,
      expiresAt:      null,
      completedAt:    null,
      unreadCount:    0,
      memberCount:    members.length,
      lastMessage:    null,
      lastMessageAt:  saved.createdAt.toISOString(),
      createdAt:      saved.createdAt.toISOString(),
    };
  }

  // ── Création — groupe de commande (automatique) ─────────────────

  /**
   * Appelé depuis CommandeCreationService après la sauvegarde
   * de chaque commande. Fire-and-forget (void caller).
   */
  async createGroupForCommande(
    commandeId:    string,
    commandeNumero: string,
    actors:        CreateGroupActors,
  ): Promise<void> {
    try {
      const exists = await this.groupRepo.findOne({ where: { commandeId } });
      if (exists) return;

      const group = this.groupRepo.create({
        commandeId,
        commandeNumero,
        companyName: actors.company.name,
        status: DeliveryGroupStatus.ACTIVE,
      });
      const saved = await this.groupRepo.save(group);

      const members: Partial<DeliveryGroupMember>[] = [
        {
          groupId:     saved.id,
          actorType:   GroupMemberType.CLIENT,
          actorId:     actors.client.id,
          userId:      actors.client.userId,
          displayName: actors.client.name,
        },
        {
          groupId:     saved.id,
          actorType:   GroupMemberType.COMPANY,
          actorId:     actors.company.id,
          userId:      actors.company.userId,
          displayName: actors.company.name,
        },
      ];

      if (actors.livreur) {
        members.push({
          groupId:     saved.id,
          actorType:   GroupMemberType.DELIVERY,
          actorId:     actors.livreur.id,
          userId:      actors.livreur.userId,
          displayName: actors.livreur.name,
        });
      }

      if (actors.correspondant) {
        members.push({
          groupId:     saved.id,
          actorType:   GroupMemberType.CORRESPONDENT,
          actorId:     actors.correspondant.id,
          userId:      actors.correspondant.userId,
          displayName: actors.correspondant.name,
        });
      }

      await this.memberRepo.save(members as DeliveryGroupMember[]);

      /* Message système d'ouverture du groupe */
      await this.sendSystemMessage(
        saved.id,
        `🚀 Groupe de livraison créé pour la commande ${commandeNumero}. ` +
        `${members.length} membres : ${members.map(m => m.displayName).join(', ')}.`,
      );

      /* Notifier tous les membres */
      const userIds = members.map(m => m.userId!);
      this.broadcast.groupStatusChanged(userIds, {
        event:          'group_created',
        groupId:        saved.id,
        commandeNumero: saved.commandeNumero ?? undefined,
        companyName:    saved.companyName ?? undefined,
        memberCount:    members.length,
      });

      this.logger.log(`[DeliveryGroup] Créé pour commande ${commandeNumero} (${saved.id})`);
    } catch (err) {
      this.logger.error(`[DeliveryGroup] Erreur création pour commande ${commandeId}`, err);
    }
  }

  // ── Gestion du statut de la commande ─────────────────────────

  /**
   * Appelé depuis CommandeValidationService sur chaque transition.
   * Gère : DELIVERED, AUTO_DELIVERED, CANCELLED, IN_PROGRESS + livreurId.
   */
  async handleOrderStatusChange(
    commandeId: string,
    newStatus:  CommandeStatus,
    extra?: { newLivreurId?: string; newLivreurUserId?: string; newLivreurName?: string },
  ): Promise<void> {
    try {
      const group = await this.groupRepo.findOne({ where: { commandeId } });
      if (!group) return;

      const activeMembers = await this.memberRepo.find({
        where: { groupId: group.id, isActive: true },
      });
      const userIds = activeMembers.map(m => m.userId);

      if (
        newStatus === CommandeStatus.DELIVERED ||
        newStatus === CommandeStatus.AUTO_DELIVERED
      ) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + EXPIRY_HOURS * 60 * 60 * 1000);
        group.status       = DeliveryGroupStatus.COMPLETED;
        group.completedAt  = now;
        group.expiresAt    = expiresAt;
        await this.groupRepo.save(group);

        await this.sendSystemMessage(
          group.id,
          `✅ Livraison confirmée ! Ce groupe sera archivé dans ${EXPIRY_HOURS}h (le ${expiresAt.toLocaleDateString('fr-FR')}).`,
        );

        this.broadcast.groupStatusChanged(userIds, {
          event:     'group_completed',
          groupId:   group.id,
          expiresAt: expiresAt.toISOString(),
        });

        this.logger.log(`[DeliveryGroup] Complété — expire le ${expiresAt.toISOString()} (${group.id})`);
        return;
      }

      if (newStatus === CommandeStatus.CANCELLED) {
        group.status = DeliveryGroupStatus.CANCELLED;
        await this.groupRepo.save(group);

        await this.sendSystemMessage(group.id, '❌ La commande a été annulée. Ce groupe est fermé.');

        this.broadcast.groupStatusChanged(userIds, {
          event:   'group_cancelled',
          groupId: group.id,
        });
        return;
      }

      /* Changement de livreur en cours de route */
      if (extra?.newLivreurId && extra.newLivreurUserId && extra.newLivreurName) {
        await this.replaceLivreur(group.id, extra.newLivreurId, extra.newLivreurUserId, extra.newLivreurName);
      }
    } catch (err) {
      this.logger.error(`[DeliveryGroup] Erreur handleOrderStatusChange commande ${commandeId}`, err);
    }
  }

  /** Remplace le livreur actif du groupe (sortant → entrant). */
  private async replaceLivreur(
    groupId: string,
    newLivreurActorId: string,
    newLivreurUserId:  string,
    newLivreurName:    string,
  ): Promise<void> {
    const now = new Date();
    /* Désactiver l'ancien livreur */
    const old = await this.memberRepo.findOne({
      where: { groupId, actorType: GroupMemberType.DELIVERY, isActive: true },
    });
    if (old && old.actorId === newLivreurActorId) return; // déjà le même livreur

    if (old) {
      old.isActive = false;
      old.leftAt   = now;
      await this.memberRepo.save(old);
    }

    /* Ajouter le nouveau */
    const newMember = this.memberRepo.create({
      groupId,
      actorType:   GroupMemberType.DELIVERY,
      actorId:     newLivreurActorId,
      userId:      newLivreurUserId,
      displayName: newLivreurName,
      isActive:    true,
    });
    await this.memberRepo.save(newMember);

    const allMembers = await this.memberRepo.find({ where: { groupId, isActive: true } });
    const userIds    = allMembers.map(m => m.userId);

    await this.sendSystemMessage(groupId, `🔄 Le livreur a été remplacé par ${newLivreurName}.`);

    this.broadcast.groupStatusChanged(userIds, {
      event:   'group_member_changed',
      groupId,
      newMember: { type: 'delivery', name: newLivreurName },
    });
  }

  // ── Listing ───────────────────────────────────────────────────

  async getGroupsForUser(userId: string): Promise<object[]> {
    const memberships = await this.memberRepo.find({
      where: { userId, isActive: true },
    });
    if (memberships.length === 0) return [];

    const groupIds = memberships.map(m => m.groupId);

    const groups = await this.groupRepo.find({
      where: {
        id:     In(groupIds),
        status: Not(DeliveryGroupStatus.EXPIRED),
      },
      order: { updatedAt: 'DESC' },
    });

    return Promise.all(groups.map(async g => {
      const membership   = memberships.find(m => m.groupId === g.id)!;
      const memberCount  = await this.memberRepo.count({ where: { groupId: g.id, isActive: true } });
      const lastMsg      = await this.msgRepo.findOne({
        where:  { groupId: g.id },
        order:  { createdAt: 'DESC' },
        withDeleted: false,
      });

      return {
        id:             g.id,
        kind:           g.kind,
        commandeId:     g.commandeId,
        commandeNumero: g.commandeNumero,
        companyName:    g.companyName,
        name:           g.name,
        description:    g.description ?? null,
        photoUrl:       g.photoUrl ?? null,
        status:         g.status,
        expiresAt:      g.expiresAt?.toISOString() ?? null,
        completedAt:    g.completedAt?.toISOString() ?? null,
        unreadCount:    membership.unreadCount,
        memberCount,
        lastMessage:    this.formatLastMessage(lastMsg ?? null),
        lastMessageAt:  lastMsg?.createdAt.toISOString() ?? g.createdAt.toISOString(),
        createdAt:      g.createdAt.toISOString(),
      };
    }));
  }

  // ── Messages ──────────────────────────────────────────────────

  async getGroupMessages(
    groupId: string,
    userId:  string,
    page     = 1,
    limit    = 30,
  ): Promise<object> {
    await this.assertMember(groupId, userId);

    const [messages, total] = await this.msgRepo.findAndCount({
      where:       { groupId },
      order:       { createdAt: 'DESC' },
      skip:        (page - 1) * limit,
      take:        limit,
      withDeleted: true,
    });

    /* Résoudre les messages cités */
    const replyIds = [...new Set(
      messages.filter(m => m.replyToId).map(m => m.replyToId!),
    )];
    const replies = replyIds.length
      ? await this.msgRepo.findBy({ id: In(replyIds) })
      : [];

    const replyMap = new Map(replies.map(r => [r.id, r]));

    const serialized = messages.reverse().map(m => this.serializeMessage(m, userId, replyMap));

    return { messages: serialized, total, page, pages: Math.ceil(total / limit) };
  }

  async sendGroupMessage(
    groupId: string,
    userId:  string,
    dto:     SendGroupMessageDto,
  ): Promise<object> {
    const member = await this.assertMember(groupId, userId);
    const group  = await this.groupRepo.findOneOrFail({ where: { id: groupId } });

    if (group.status === DeliveryGroupStatus.EXPIRED) {
      throw new ForbiddenException('Ce groupe a expiré.');
    }
    if (group.status === DeliveryGroupStatus.CANCELLED) {
      throw new ForbiddenException('Cette commande a été annulée.');
    }

    const msg = this.msgRepo.create({
      groupId,
      senderType:    member.actorType,
      senderId:      member.actorId,
      senderUserId:  userId,
      senderName:    member.displayName,
      contentType:   dto.contentType,
      content:       dto.content ?? null,
      mediaUrl:      dto.mediaUrl ?? null,
      mediaName:     dto.mediaName ?? null,
      mediaSize:     dto.mediaSize ?? null,
      mediaMimeType: dto.mediaMimeType ?? null,
      mediaDuration: dto.mediaDuration ?? null,
      replyToId:     dto.replyToId ?? null,
    });
    const saved = await this.msgRepo.save(msg);

    /* Incrémenter les non-lus pour les autres membres */
    await this.memberRepo.increment(
      { groupId, isActive: true, userId: Not(userId) },
      'unreadCount',
      1,
    );

    /* Mettre à jour la date du groupe pour le tri */
    group.updatedAt = new Date();
    await this.groupRepo.save(group);

    /* Broadcast Socket.IO */
    const allMembers = await this.memberRepo.find({ where: { groupId, isActive: true } });
    const payload    = this.serializeMessage(saved, userId, new Map());

    this.broadcast.groupNewMessage(
      allMembers.map(m => m.userId),
      userId,
      {
        groupId,
        commandeNumero: group.commandeNumero ?? undefined,
        message:        payload,
      },
    );

    return payload;
  }

  async editGroupMessage(
    groupId:   string,
    messageId: string,
    userId:    string,
    dto:       EditGroupMessageDto,
  ): Promise<object> {
    await this.assertMember(groupId, userId);

    const msg = await this.msgRepo.findOne({ where: { id: messageId, groupId } });
    if (!msg) throw new NotFoundException('Message introuvable.');
    if (msg.senderUserId !== userId) throw new ForbiddenException('Non autorisé.');
    if (msg.contentType !== GroupMessageContentType.TEXT) {
      throw new ForbiddenException('Seuls les messages texte peuvent être modifiés.');
    }

    msg.originalContent = msg.originalContent ?? msg.content;
    msg.content         = dto.content;
    msg.isEdited        = true;
    msg.editedAt        = new Date();
    await this.msgRepo.save(msg);

    const members = await this.memberRepo.find({ where: { groupId, isActive: true } });

    this.broadcast.groupMessageEdited(members.map(m => m.userId), {
      groupId,
      messageId: msg.id,
      newContent: msg.content,
      editedAt:  msg.editedAt.toISOString(),
    });

    return this.serializeMessage(msg, userId, new Map());
  }

  async deleteGroupMessage(
    groupId:   string,
    messageId: string,
    userId:    string,
    dto:       DeleteGroupMessageDto,
  ): Promise<void> {
    await this.assertMember(groupId, userId);

    const msg = await this.msgRepo.findOne({ where: { id: messageId, groupId } });
    if (!msg) throw new NotFoundException('Message introuvable.');
    if (msg.senderUserId !== userId) throw new ForbiddenException('Non autorisé.');

    const members  = await this.memberRepo.find({ where: { groupId, isActive: true } });
    const userIds  = members.map(m => m.userId);

    if (dto.mode === 'everyone') {
      msg.content  = null;
      msg.mediaUrl = null;
      await this.msgRepo.softRemove(msg);
    } else {
      msg.deletedForUserIds = [...(msg.deletedForUserIds ?? []), userId];
      await this.msgRepo.save(msg);
    }

    this.broadcast.groupMessageDeleted(userIds, {
      groupId,
      messageId: msg.id,
      deletedForAll: dto.mode === 'everyone',
    });
  }

  async toggleGroupReaction(
    groupId:   string,
    messageId: string,
    userId:    string,
    dto:       ToggleGroupReactionDto,
  ): Promise<object> {
    await this.assertMember(groupId, userId);

    const msg = await this.msgRepo.findOne({ where: { id: messageId, groupId } });
    if (!msg) throw new NotFoundException('Message introuvable.');

    const reactions = msg.reactions ?? {};
    const current   = reactions[dto.emoji] ?? [];
    if (current.includes(userId)) {
      reactions[dto.emoji] = current.filter(id => id !== userId);
      if (reactions[dto.emoji].length === 0) delete reactions[dto.emoji];
    } else {
      reactions[dto.emoji] = [...current, userId];
    }
    msg.reactions = reactions;
    await this.msgRepo.save(msg);

    const members = await this.memberRepo.find({ where: { groupId, isActive: true } });
    this.broadcast.groupReactionUpdated(members.map(m => m.userId), {
      groupId,
      messageId: msg.id,
      reactions: msg.reactions ?? {},
    });

    return { reactions: msg.reactions };
  }

  async markGroupAsRead(groupId: string, userId: string): Promise<void> {
    const member = await this.memberRepo.findOne({ where: { groupId, userId, isActive: true } });
    if (!member) return;
    member.unreadCount = 0;
    member.lastReadAt  = new Date();
    await this.memberRepo.save(member);
  }

  // ── Cron — expiration 72h ────────────────────────────────────

  async expireCompletedGroups(): Promise<void> {
    const now     = new Date();
    const expired = await this.groupRepo.find({
      where: {
        status:    DeliveryGroupStatus.COMPLETED,
        expiresAt: LessThanOrEqual(now),
      },
    });

    for (const group of expired) {
      group.status = DeliveryGroupStatus.EXPIRED;
      await this.groupRepo.save(group);

      const members = await this.memberRepo.find({ where: { groupId: group.id, isActive: true } });
      this.broadcast.groupStatusChanged(members.map(m => m.userId), {
        event:   'group_expired',
        groupId: group.id,
      });

      this.logger.log(`[DeliveryGroup] Expiré : ${group.id} (${group.commandeNumero})`);
    }
  }

  // ── Mise à jour du profil du groupe ─────────────────────────

  /** Modifie les informations éditables du groupe (description, …). */
  async updateGroupInfo(groupId: string, userId: string, dto: UpdateGroupDto): Promise<object> {
    const member = await this.assertMember(groupId, userId);
    const group  = await this.groupRepo.findOneOrFail({ where: { id: groupId } });

    if (dto.description !== undefined) {
      group.description = dto.description.trim() || null;
    }
    if (dto.photoUrl !== undefined) {
      /* La photo ne peut être changée que par un administrateur — pour un
       * groupe CUSTOM uniquement (voir assertGroupAdmin ; un groupe ORDER
       * n'a pas de notion d'admin, comportement inchangé pour lui). */
      this.assertGroupAdmin(group, member);
      group.photoUrl = dto.photoUrl.trim() || null;
    }
    await this.groupRepo.save(group);

    /* Notifier les autres membres du changement */
    const members = await this.memberRepo.find({ where: { groupId, isActive: true } });
    this.broadcast.groupStatusChanged(members.map(m => m.userId), {
      event:       'group_info_updated',
      groupId:     group.id,
      description: group.description ?? undefined,
      photoUrl:    group.photoUrl ?? undefined,
    });

    return { id: group.id, description: group.description, photoUrl: group.photoUrl };
  }

  // ── Membres ───────────────────────────────────────────────────

  /** Retourne la liste des membres actifs d'un groupe. */
  async getGroupMembers(groupId: string, userId: string): Promise<object[]> {
    await this.assertMember(groupId, userId);
    const members = await this.memberRepo.find({
      where: { groupId, isActive: true },
      order: { joinedAt: 'ASC' },
    });
    return members.map(m => ({
      id:          m.id,
      actorType:   m.actorType,
      actorId:     m.actorId,
      userId:      m.userId,
      displayName: m.displayName,
      isAdmin:     m.isAdmin,
      joinedAt:    m.joinedAt?.toISOString() ?? null,
    }));
  }

  // ── Utilitaires ───────────────────────────────────────────────

  private formatLastMessage(msg: GroupMessage | null): string | null {
    if (!msg) return null;
    if (msg.contentType === GroupMessageContentType.CALL && msg.content) {
      try {
        const meta = JSON.parse(msg.content);
        const type = meta.callType === 'video' ? 'vidéo' : 'audio';
        return meta.status === 'missed' ? '📞 Appel manqué' : `📞 Appel ${type}`;
      } catch { return '📞 Appel'; }
    }
    return msg.content ?? null;
  }

  private async assertMember(groupId: string, userId: string): Promise<DeliveryGroupMember> {
    const member = await this.memberRepo.findOne({ where: { groupId, userId, isActive: true } });
    if (!member) throw new ForbiddenException('Vous n\'êtes pas membre de ce groupe.');
    return member;
  }

  /**
   * Un groupe ORDER (auto-créé par une commande) n'a pas de notion
   * d'administrateur — tout membre garde le comportement historique
   * (permissif). Pour un groupe CUSTOM, seul un administrateur passe ;
   * le créateur original reste toujours autorisé même si `isAdmin` n'a
   * jamais été posé correctement (filet de sécurité contre un groupe qui
   * se retrouverait sans aucun administrateur).
   */
  private assertGroupAdmin(group: DeliveryGroup, member: DeliveryGroupMember): void {
    if (group.kind !== DeliveryGroupKind.CUSTOM) return;
    if (member.isAdmin) return;
    if (group.createdByUserId && group.createdByUserId === member.userId) return;
    throw new ForbiddenException('Seul un administrateur du groupe peut effectuer cette action.');
  }

  /**
   * Nomme/retire un administrateur du groupe (⋮ groupe libre uniquement,
   * comme WhatsApp/Telegram) — voir assertGroupAdmin ci-dessus.
   */
  async setMemberAdmin(
    groupId: string, callerUserId: string, targetMemberId: string, isAdmin: boolean,
  ): Promise<object> {
    const caller = await this.assertMember(groupId, callerUserId);
    const group  = await this.groupRepo.findOneOrFail({ where: { id: groupId } });

    if (group.kind !== DeliveryGroupKind.CUSTOM) {
      throw new BadRequestException('La gestion des administrateurs n\'est disponible que pour les groupes libres.');
    }
    this.assertGroupAdmin(group, caller);

    const target = await this.memberRepo.findOne({ where: { id: targetMemberId, groupId, isActive: true } });
    if (!target) throw new NotFoundException('Membre introuvable.');

    target.isAdmin = isAdmin;
    await this.memberRepo.save(target);

    await this.sendSystemMessage(
      groupId,
      isAdmin
        ? `👑 ${target.displayName} est maintenant administrateur du groupe.`
        : `${target.displayName} n'est plus administrateur du groupe.`,
    );

    const members = await this.memberRepo.find({ where: { groupId, isActive: true } });
    this.broadcast.groupStatusChanged(members.map(m => m.userId), {
      event:         'group_member_admin_changed',
      groupId,
      memberId:      target.id,
      memberIsAdmin: target.isAdmin,
    });

    return { id: target.id, isAdmin: target.isAdmin };
  }

  private async sendSystemMessage(groupId: string, text: string): Promise<void> {
    await this.msgRepo.save(this.msgRepo.create({
      groupId,
      senderType:  null,
      senderId:    null,
      senderUserId: null,
      senderName:  null,
      contentType: GroupMessageContentType.SYSTEM,
      content:     text,
    }));
  }

  private serializeMessage(
    msg:      GroupMessage,
    myUserId: string,
    replyMap: Map<string, GroupMessage>,
  ): object {
    const isDeleted    = !!msg.deletedAt;
    const hiddenForMe  = msg.deletedForUserIds?.includes(myUserId) ?? false;

    let replyTo: object | null = null;
    if (msg.replyToId && replyMap.has(msg.replyToId)) {
      const r = replyMap.get(msg.replyToId)!;
      replyTo = {
        id:          r.id,
        content:     r.deletedAt ? null : r.content,
        contentType: r.contentType,
        senderName:  r.senderName,
        deleted:     !!r.deletedAt,
      };
    }

    return {
      id:            msg.id,
      groupId:       msg.groupId,
      fromMe:        msg.senderUserId === myUserId,
      senderId:      msg.senderId,
      senderUserId:  msg.senderUserId,
      senderName:    msg.senderName,
      senderType:    msg.senderType,
      contentType:   msg.contentType,
      content:       isDeleted || hiddenForMe ? null : msg.content,
      mediaUrl:      isDeleted || hiddenForMe ? null : msg.mediaUrl,
      mediaName:     msg.mediaName,
      mediaMimeType: msg.mediaMimeType,
      mediaDuration: msg.mediaDuration,
      isEdited:      msg.isEdited,
      deleted:       isDeleted || hiddenForMe,
      reactions:     msg.reactions ?? {},
      replyToId:     msg.replyToId,
      replyTo,
      createdAt:     msg.createdAt.toISOString(),
    };
  }
}
