/* ============================================================
 * FICHIER  : src/modules/support/services/support.service.ts
 * MODULE   : Support
 * ROLE     : Façade du module Support — orchestre les sous-services.
 *
 * RESPONSABILITES :
 *   - Exposer une API unique aux contrôleurs et modules externes
 *     (ContactModule, etc.) sans qu'ils connaissent la décomposition interne.
 *   - Déléguer createTicket → TicketService (+ envoi email de confirmation).
 *   - Déléguer les opérations de conversation → ConversationService.
 *   - Déléguer les opérations CRUD ticket → TicketService.
 *   - Déléguer les opérations de pièces jointes → AttachmentService,
 *     avec vérification d'appartenance du ticket (IDOR) pour les clients.
 *   - Appliquer la portée hiérarchique des tickets côté agent via
 *     SupportPermissionService (OWASP A01:2021 — Broken Access Control).
 *
 * DESIGN :
 *   Ce service est exporté par SupportModule et consommé par :
 *     - SupportClientController
 *     - SupportAgentController
 *     - ContactService (escalade formulaire → ticket)
 *   Les sous-services (TicketService, ConversationService, AttachmentService)
 *   restent internes au SupportModule et ne sont pas exportés.
 *
 * SECURITE :
 *   - Les méthodes "ByUser" vérifient ticket.userId === userId (IDOR A01:2021).
 *   - Les méthodes agent utilisent assertAgentAccess() qui résout la portée
 *     hiérarchique via SupportPermissionService avant toute opération.
 *   - SUPER_ADMIN : portée globale (aucun filtre).
 *   - ADMIN       : portée limitée aux acteurs qu'il supervise directement.
 *   - PARTNER     : portée limitée aux acteurs supervisés dans son réseau.
 *
 * DEPENDANCES :
 *   - TicketService             (CRUD tickets)
 *   - ConversationService       (messages + email + notif)
 *   - AttachmentService         (upload/list/delete pièces jointes)
 *   - SupportPermissionService  (résolution portée hiérarchique)
 *   - MailService               (email de confirmation de création)
 *   - ConfigService             (FRONTEND_URL)
 *
 * AUTEUR : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-04
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import {
  SupportTicket,
  SupportTicketPriority,
} from '../../../database/entities/support/support-ticket.entity';
import { Admin, AdminStatus } from '../../../database/entities/profiles/admin-profile.entity';
import { SupportMessage } from '../../../database/entities/support/support-message.entity';
import { Attachment }     from '../../../database/entities/support/attachment.entity';

import {
  CreateSupportTicketDto,
  ReplySupportTicketDto,
  FilterSupportTicketsDto,
  UpdateTicketStatusDto,
  AssignTicketDto,
  RateSupportTicketDto,
} from '../dto/support.dto';

import { TicketService }            from './ticket.service';
import { ConversationService }      from './conversation.service';
import { AttachmentService }        from './attachment.service';
import { SupportPermissionService } from './support-permission.service';
import { SupportStatsService, SupportOverview } from './support-stats.service';
import { SupportExportService, CsvResult }      from './support-export.service';
import { MailService }              from '../../email/email.service';
import { UserRole }                 from '../../../common/enums/user-role.enum';

import {
  TicketNotOwnedException,
  AttachmentNotOwnedException,
  InternalMessageForbiddenException,
} from '../../../common/exceptions/support.exceptions';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly ticketSvc:      TicketService,
    private readonly convSvc:        ConversationService,
    private readonly attachmentSvc:  AttachmentService,
    private readonly permissionSvc:  SupportPermissionService,
    private readonly statsSvc:       SupportStatsService,
    private readonly exportSvc:      SupportExportService,
    private readonly mailService:    MailService,
    private readonly config:         ConfigService,

    /* Nécessaire pour listAgents() — voir plus bas */
    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,
  ) {}

  /* ════════════════════════════════════════════════════════════
   * CÔTÉ CLIENT (client, company, delivery, correspondent)
   * ════════════════════════════════════════════════════════════ */

  async createTicket(
    userId:    string,
    userRole:  string,
    userName:  string,
    userEmail: string,
    dto:       CreateSupportTicketDto,
  ): Promise<{ ticket: SupportTicket; firstMessageId: string }> {
    const { ticket, firstMessageId } = await this.ticketSvc.create(userId, userRole, userName, dto);

    try {
      await this.mailService.sendSupportTicketConfirmation({
        toEmail:   userEmail,
        firstName: userName,
        reference: ticket.reference,
        subject:   dto.subject,
        ticketUrl: `${this.config.get('FRONTEND_URL', 'https://shopi.gn')}/support/tickets/${ticket.id}`,
      });
    } catch (e) {
      this.logger.warn(`[SUPPORT] Email confirmation échoué pour ${userEmail}: ${e}`);
    }

    return { ticket, firstMessageId };
  }

  findByUser(
    userId:  string,
    filters: FilterSupportTicketsDto,
  ): Promise<{ data: SupportTicket[]; total: number }> {
    return this.ticketSvc.findByUser(userId, filters);
  }

  findOneByUser(
    userId:   string,
    ticketId: string,
  ): Promise<{ ticket: SupportTicket; messages: SupportMessage[] }> {
    return this.ticketSvc.findOneByUser(userId, ticketId);
  }

  replyByUser(
    userId:   string,
    userName: string,
    ticketId: string,
    dto:      ReplySupportTicketDto,
  ): Promise<SupportMessage> {
    return this.convSvc.replyByUser(userId, userName, ticketId, dto);
  }

  rateTicket(
    userId:   string,
    ticketId: string,
    dto:      RateSupportTicketDto,
  ): Promise<void> {
    return this.ticketSvc.rateTicket(userId, ticketId, dto);
  }

  /* ════════════════════════════════════════════════════════════
   * CÔTÉ AGENT (super_admin, admin, partner)
   *
   * Toutes les méthodes agent passent par assertAgentAccess() pour
   * vérifier que l'agent a la portée nécessaire sur ce ticket.
   * ════════════════════════════════════════════════════════════ */

  /**
   * Liste les admins éligibles à l'assignation de tickets (permission
   * "support" accordée par le super-admin — voir PermissionsSection.tsx
   * et SupportPermissionGuard). Réservé au super-admin : c'est lui seul
   * qui réassigne des tickets entre agents à travers les zones (vue
   * globale multi-admin du dashboard super-admin).
   */
  async listAgents(): Promise<{ id: string; name: string; email: string; paysAssigne: string | null }[]> {
    const admins = await this.adminRepo.find({
      relations: ['user'],
      where: { status: AdminStatus.ACTIVE },
      order: { fullName: 'ASC' },
    });

    return admins
      .filter(a => (a.permissions as Record<string, boolean> | null)?.support)
      .map(a => ({
        id:          a.userId,
        name:        a.fullName,
        email:       a.user?.email ?? '',
        paysAssigne: a.paysAssigne ?? null,
      }));
  }

  /**
   * Liste paginée des tickets dans la portée de l'agent.
   * SUPER_ADMIN : tous les tickets.
   * ADMIN       : tickets des acteurs qu'il supervise.
   * PARTNER     : tickets des acteurs supervisés dans son réseau.
   */
  async findAllAsAgent(
    actorId: string | undefined,
    role:    string,
    filters: FilterSupportTicketsDto,
  ): Promise<{ data: SupportTicket[]; total: number }> {
    const visibleUserIds = await this.permissionSvc.resolveVisibleUserIds(actorId, role);
    return this.ticketSvc.findAllScoped(visibleUserIds, filters);
  }

  /**
   * Détail d'un ticket avec vérification de portée.
   * Lance 403 si le ticket n'est pas dans la portée de l'agent.
   */
  async findOneAsAgent(
    actorId:  string | undefined,
    role:     string,
    ticketId: string,
  ): Promise<{ ticket: SupportTicket; messages: SupportMessage[] }> {
    const visibleUserIds = await this.permissionSvc.resolveVisibleUserIds(actorId, role);
    return this.ticketSvc.findOneAsAgentScoped(ticketId, visibleUserIds);
  }

  async replyAsAgent(
    actorId:    string | undefined,
    role:       string,
    agentId:    string,
    agentName:  string,
    ticketId:   string,
    dto:        ReplySupportTicketDto,
    isInternal: boolean,
  ): Promise<SupportMessage> {
    await this.assertAgentAccess(actorId, role, ticketId);

    /* Les partenaires ne peuvent pas envoyer de notes internes — celles-ci
     * sont réservées à la communication interne admin/super_admin. */
    if (isInternal && role === UserRole.PARTNER) {
      throw new InternalMessageForbiddenException();
    }

    return this.convSvc.replyAsAgent(agentId, agentName, ticketId, dto, isInternal);
  }

  async updateStatus(
    actorId:  string | undefined,
    role:     string,
    ticketId: string,
    dto:      UpdateTicketStatusDto,
  ): Promise<void> {
    await this.assertAgentAccess(actorId, role, ticketId);
    return this.ticketSvc.updateStatus(ticketId, dto);
  }

  async assignTicket(
    actorId:  string | undefined,
    role:     string,
    ticketId: string,
    dto:      AssignTicketDto,
  ): Promise<void> {
    await this.assertAgentAccess(actorId, role, ticketId);
    return this.ticketSvc.assignTicket(ticketId, dto);
  }

  async setPriority(
    actorId:  string | undefined,
    role:     string,
    ticketId: string,
    priority: SupportTicketPriority,
  ): Promise<void> {
    await this.assertAgentAccess(actorId, role, ticketId);
    return this.ticketSvc.setPriority(ticketId, priority);
  }

  /**
   * Statistiques agrégées dans la portée de l'agent.
   * SUPER_ADMIN : plateforme entière. ADMIN/PARTNER : leurs acteurs
   * supervisés uniquement (avant ce correctif, ces deux rôles
   * voyaient les statistiques de TOUTE la plateforme).
   */
  async getStatsAsAgent(
    actorId: string | undefined,
    role:    string,
  ): Promise<SupportOverview> {
    const visibleUserIds = await this.permissionSvc.resolveVisibleUserIds(actorId, role);
    return this.statsSvc.getOverview(visibleUserIds);
  }

  /** Export CSV dans la portée de l'agent — même correctif que getStatsAsAgent(). */
  async exportCsvAsAgent(
    actorId:   string | undefined,
    role:      string,
    status?:   string,
    type?:     string,
    fromDate?: string,
    toDate?:   string,
  ): Promise<CsvResult> {
    const visibleUserIds = await this.permissionSvc.resolveVisibleUserIds(actorId, role);
    return this.exportSvc.generateCsv(visibleUserIds, status, type, fromDate, toDate);
  }

  /* ════════════════════════════════════════════════════════════
   * PIÈCES JOINTES — CÔTÉ CLIENT
   * ════════════════════════════════════════════════════════════ */

  /** Vérifie que le ticket appartient à userId (IDOR A01:2021). */
  private async assertTicketOwnership(
    userId:   string,
    ticketId: string,
  ): Promise<void> {
    const ticket = await this.ticketSvc.findRaw(ticketId);
    if (ticket.userId !== userId) throw new TicketNotOwnedException();
  }

  async uploadAttachmentByUser(
    userId:    string,
    userRole:  string,
    ticketId:  string,
    messageId: string,
    file:      Express.Multer.File,
  ): Promise<Attachment> {
    await this.assertTicketOwnership(userId, ticketId);
    return this.attachmentSvc.upload(ticketId, messageId, file, userId, userRole);
  }

  async listAttachmentsByUser(
    userId:    string,
    ticketId:  string,
    messageId: string,
  ): Promise<Attachment[]> {
    await this.assertTicketOwnership(userId, ticketId);
    return this.attachmentSvc.findByMessage(ticketId, messageId);
  }

  async removeAttachmentByUser(
    userId:       string,
    ticketId:     string,
    attachmentId: string,
  ): Promise<void> {
    await this.assertTicketOwnership(userId, ticketId);

    const att = await this.attachmentSvc.findOne(attachmentId);
    if (att.uploadedById !== userId) throw new AttachmentNotOwnedException();

    return this.attachmentSvc.remove(attachmentId, userId);
  }

  /* ════════════════════════════════════════════════════════════
   * PIÈCES JOINTES — CÔTÉ AGENT
   *
   * Les agents peuvent agir sur les tickets dans leur portée.
   * assertAgentAccess() vérifie la portée avant toute opération.
   * ════════════════════════════════════════════════════════════ */

  async uploadAttachmentByAgent(
    actorId:   string | undefined,
    agentId:   string,
    agentRole: string,
    ticketId:  string,
    messageId: string,
    file:      Express.Multer.File,
  ): Promise<Attachment> {
    await this.assertAgentAccess(actorId, agentRole, ticketId);
    return this.attachmentSvc.upload(ticketId, messageId, file, agentId, agentRole);
  }

  async listAttachmentsByAgent(
    actorId:   string | undefined,
    agentRole: string,
    ticketId:  string,
    messageId: string,
  ): Promise<Attachment[]> {
    await this.assertAgentAccess(actorId, agentRole, ticketId);
    return this.attachmentSvc.findByMessage(ticketId, messageId);
  }

  async removeAttachmentByAgent(
    actorId:      string | undefined,
    agentId:      string,
    agentRole:    string,
    ticketId:     string,
    attachmentId: string,
  ): Promise<void> {
    await this.assertAgentAccess(actorId, agentRole, ticketId);
    return this.attachmentSvc.remove(attachmentId, agentId);
  }

  /* ════════════════════════════════════════════════════════════
   * UTILITAIRE PRIVÉ
   * ════════════════════════════════════════════════════════════ */

  /**
   * Version booléenne (ne lance jamais) de la vérification d'accès —
   * utilisée par SupportGateway pour autoriser join_ticket (rejoindre
   * la room temps réel d'un ticket) sans dupliquer la logique de
   * portée hiérachique déjà centralisée ici.
   *
   * Couvre les DEUX côtés d'une conversation de ticket :
   *   - l'auteur (client/entreprise/livreur/partenaire/correspondant)
   *     via ticket.userId === userId (même contrôle IDOR que les
   *     méthodes "ByUser" ci-dessus) ;
   *   - un agent (super_admin/admin/partner) via la même portée
   *     hiérarchique que resolveVisibleUserIds(), ET, pour un ADMIN,
   *     la même permission "support" que SupportPermissionGuard côté
   *     REST — sinon un admin sans cette permission pourrait quand
   *     même écouter les messages en direct via ce gateway, en
   *     contournant le garde REST.
   *
   * @param userId  User.id de l'appelant (identité de connexion)
   * @param actorId Profil de l'appelant si agent (Admin.id/Partner.id) —
   *                voir SupportPermissionService.resolveVisibleUserIds()
   */
  async canAccessTicket(
    userId:   string,
    actorId:  string | undefined,
    role:     string,
    ticketId: string,
  ): Promise<boolean> {
    const ticket = await this.ticketSvc.findRaw(ticketId).catch(() => null);
    if (!ticket) return false;

    if (ticket.userId === userId) return true;

    if (role === UserRole.SUPER_ADMIN) return true;

    if (role === UserRole.ADMIN) {
      const admin = await this.adminRepo.findOne({ where: { userId }, select: ['permissions'] });
      const perms = admin?.permissions as Record<string, boolean> | null;
      if (!perms?.support) return false;
    }

    if (role === UserRole.ADMIN || role === UserRole.PARTNER) {
      const visibleIds = await this.permissionSvc.resolveVisibleUserIds(actorId, role);
      if (visibleIds === null) return true;
      return !!ticket.userId && visibleIds.has(ticket.userId);
    }

    return false;
  }

  /**
   * Vérifie que l'agent (actorId + role) a la portée nécessaire pour
   * accéder au ticket donné. Lance 403 si le ticket est hors portée.
   *
   * SUPER_ADMIN : aucune vérification (portée globale).
   * ADMIN / PARTNER : ticket.userId doit être dans la portée résolue.
   */
  private async assertAgentAccess(
    actorId:  string | undefined,
    role:     string,
    ticketId: string,
  ): Promise<void> {
    const visibleIds = await this.permissionSvc.resolveVisibleUserIds(actorId, role);
    if (visibleIds === null) return; // SUPER_ADMIN — accès global

    const ticket = await this.ticketSvc.findRaw(ticketId);
    if (!ticket.userId || !visibleIds.has(ticket.userId)) {
      throw new TicketNotOwnedException();
    }
  }
}
