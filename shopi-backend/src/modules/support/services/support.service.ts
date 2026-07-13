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

import {
  SupportTicket,
  SupportTicketPriority,
} from '../../../database/entities/support/support-ticket.entity';
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
    private readonly mailService:    MailService,
    private readonly config:         ConfigService,
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
  ): Promise<SupportTicket> {
    const ticket = await this.ticketSvc.create(userId, userRole, userName, dto);

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

    return ticket;
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
    userEmail:  string,
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

    return this.convSvc.replyAsAgent(agentId, agentName, userEmail, ticketId, dto, isInternal);
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
