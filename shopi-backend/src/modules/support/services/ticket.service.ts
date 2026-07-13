/* ============================================================
 * FICHIER  : src/modules/support/services/ticket.service.ts
 * ROLE     : Responsabilité unique — CRUD des tickets de support.
 *
 * RESPONSABILITES :
 *   - Créer un ticket (génération de référence incluse).
 *   - Lister les tickets d'un utilisateur avec filtres et pagination.
 *   - Récupérer le détail d'un ticket (avec contrôle d'appartenance).
 *   - Lister tous les tickets côté agent avec filtres avancés.
 *   - Modifier le statut, l'agent assigné, la priorité.
 *   - Enregistrer le score de satisfaction CSAT.
 *   - Soft delete d'un ticket (avec audit deletedBy).
 *
 * DEPENDANCES :
 *   - SupportTicket     (InjectRepository)
 *   - SupportMessage    (InjectRepository — pour findOne avec messages)
 *   - TicketNotFoundException, TicketNotOwnedException, etc.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import {
  SupportTicket,
  SupportTicketStatus,
  SupportTicketPriority,
} from '../../../database/entities/support/support-ticket.entity';
import {
  SupportMessage,
  SupportSenderType,
} from '../../../database/entities/support/support-message.entity';

import {
  CreateSupportTicketDto,
  FilterSupportTicketsDto,
  UpdateTicketStatusDto,
  AssignTicketDto,
  RateSupportTicketDto,
} from '../dto/support.dto';

import {
  TicketNotFoundException,
  TicketNotOwnedException,
  TicketAlreadyClosedException,
  CsatAlreadySubmittedException,
  CsatNotAllowedException,
} from '../../../common/exceptions/support.exceptions';

@Injectable()
export class TicketService {
  private readonly logger = new Logger(TicketService.name);

  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(SupportMessage)
    private readonly msgRepo: Repository<SupportMessage>,
  ) {}

  /* ── Génération de référence humaine ─────────────────────── */

  async generateReference(): Promise<string> {
    const year  = new Date().getFullYear();
    const count = await this.ticketRepo.count({ withDeleted: true });
    return `SUP-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  /* ── Création d'un ticket ────────────────────────────────── */

  async create(
    userId:    string,
    userRole:  string,
    userName:  string,
    dto:       CreateSupportTicketDto,
  ): Promise<SupportTicket> {
    const reference = await this.generateReference();

    const ticket = this.ticketRepo.create({
      reference,
      userId,
      userRole,
      type:           dto.type,
      subject:        dto.subject,
      firstMessage:   dto.firstMessage,
      status:         SupportTicketStatus.OPEN,
      priority:       SupportTicketPriority.NORMAL,
      relatedOrderId: dto.relatedOrderId ?? null,
      messageCount:   1,
      unreadByAgent:  1,
      unreadByUser:   0,
    });

    const saved = await this.ticketRepo.save(ticket);

    const firstMsg = this.msgRepo.create({
      ticketId:   saved.id,
      content:    dto.firstMessage,
      senderType: SupportSenderType.USER,
      senderId:   userId,
      senderName: userName,
    });
    await this.msgRepo.save(firstMsg);

    this.logger.log(`[TICKET] ${saved.reference} créé par ${userId} (${userRole})`);
    return saved;
  }

  /* ── Côté client ─────────────────────────────────────────── */

  async findByUser(
    userId:  string,
    filters: FilterSupportTicketsDto,
  ): Promise<{ data: SupportTicket[]; total: number }> {
    const page  = filters.page  ?? 1;
    const limit = filters.limit ?? 10;

    const qb = this.ticketRepo.createQueryBuilder('t')
      .where('t.userId = :userId', { userId })
      .orderBy('t.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.status) qb.andWhere('t.status = :status', { status: filters.status });
    if (filters.type)   qb.andWhere('t.type = :type',     { type: filters.type });

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findOneByUser(
    userId:   string,
    ticketId: string,
  ): Promise<{ ticket: SupportTicket; messages: SupportMessage[] }> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket)                   throw new TicketNotFoundException(ticketId);
    if (ticket.userId !== userId)  throw new TicketNotOwnedException();

    /* Chargement des pièces jointes via la relation OneToMany.
     * TypeORM filtre automatiquement les attachments soft-deleted (deletedAt IS NULL).
     * Sans 'relations', attachments serait un tableau vide (eager: false sur l'entité). */
    const messages = await this.msgRepo.find({
      where:     { ticketId },
      order:     { createdAt: 'ASC' },
      relations: ['attachments'],
    });

    await this.ticketRepo.update(ticketId, { unreadByUser: 0 });
    return { ticket, messages };
  }

  async rateTicket(
    userId:   string,
    ticketId: string,
    dto:      RateSupportTicketDto,
  ): Promise<void> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket)                  throw new TicketNotFoundException(ticketId);
    if (ticket.userId !== userId) throw new TicketNotOwnedException();

    const resolved = [SupportTicketStatus.RESOLVED, SupportTicketStatus.CLOSED];
    if (!resolved.includes(ticket.status)) throw new CsatNotAllowedException();
    if (ticket.satisfactionScore !== null) throw new CsatAlreadySubmittedException();

    await this.ticketRepo.update(ticketId, { satisfactionScore: dto.score });
    this.logger.log(`[TICKET] CSAT ${dto.score}/5 soumis pour ${ticket.reference}`);
  }

  /* ── Côté agent ──────────────────────────────────────────── */

  /**
   * Liste paginée des tickets avec filtre de portée hiérarchique.
   *
   * @param visibleUserIds  null → SUPER_ADMIN (aucun filtre)
   *                        Set  → uniquement les tickets dont userId ∈ Set
   *                        Set vide → aucun ticket (agent sans acteurs supervisés)
   */
  async findAllScoped(
    visibleUserIds: Set<string> | null,
    filters: FilterSupportTicketsDto,
  ): Promise<{ data: SupportTicket[]; total: number }> {
    if (visibleUserIds !== null && visibleUserIds.size === 0) {
      return { data: [], total: 0 };
    }

    const page  = filters.page  ?? 1;
    const limit = Math.min(filters.limit ?? 20, 50);

    const qb = this.ticketRepo.createQueryBuilder('t')
      .orderBy('t.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    /* null = SUPER_ADMIN = aucun filtre userId */
    if (visibleUserIds !== null) {
      qb.andWhere('t.userId IN (:...ids)', { ids: [...visibleUserIds] });
    }

    if (filters.status)   qb.andWhere('t.status = :status',     { status: filters.status });
    if (filters.type)     qb.andWhere('t.type = :type',         { type: filters.type });
    if (filters.priority) qb.andWhere('t.priority = :priority', { priority: filters.priority });
    if (filters.search) {
      qb.andWhere(
        '(t.reference ILIKE :s OR t.subject ILIKE :s)',
        { s: `%${filters.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  /**
   * Détail d'un ticket avec vérification de portée hiérarchique.
   * Lance TicketNotOwnedException (403) si le ticket n'est pas
   * dans la portée de l'agent.
   */
  async findOneAsAgentScoped(
    ticketId: string,
    visibleUserIds: Set<string> | null,
  ): Promise<{ ticket: SupportTicket; messages: SupportMessage[] }> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) throw new TicketNotFoundException(ticketId);

    if (visibleUserIds !== null) {
      if (!ticket.userId || !visibleUserIds.has(ticket.userId)) {
        throw new TicketNotOwnedException();
      }
    }

    const messages = await this.msgRepo.find({
      where:     { ticketId },
      order:     { createdAt: 'ASC' },
      relations: ['attachments'],
    });

    await this.ticketRepo.update(ticketId, { unreadByAgent: 0 });
    return { ticket, messages };
  }

  async updateStatus(ticketId: string, dto: UpdateTicketStatusDto): Promise<void> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) throw new TicketNotFoundException(ticketId);

    const update: Partial<SupportTicket> = { status: dto.status as SupportTicketStatus };
    if (dto.status === SupportTicketStatus.RESOLVED) update.resolvedAt = new Date();
    if (dto.status === SupportTicketStatus.CLOSED)   update.closedAt   = new Date();

    await this.ticketRepo.update(ticketId, update);
    this.logger.log(`[TICKET] ${ticket.reference} → ${dto.status}`);
  }

  async assignTicket(ticketId: string, dto: AssignTicketDto): Promise<void> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) throw new TicketNotFoundException(ticketId);
    await this.ticketRepo.update(ticketId, { agentId: dto.agentId });
  }

  async setPriority(ticketId: string, priority: SupportTicketPriority): Promise<void> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) throw new TicketNotFoundException(ticketId);
    await this.ticketRepo.update(ticketId, { priority });
  }

  /* ── Accès direct au ticket brut (pour ConversationService) ─ */

  async findRaw(ticketId: string): Promise<SupportTicket> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) throw new TicketNotFoundException(ticketId);
    return ticket;
  }

  /* ── Mise à jour des compteurs de messages ───────────────── */

  async incrementCounters(
    ticketId:     string,
    options: {
      status?:       SupportTicketStatus;
      firstResponseAt?: Date | null;
      unreadByUser?:    number | 'increment';
      unreadByAgent?:   number | 'increment';
    },
  ): Promise<void> {
    const update: Record<string, unknown> = {
      messageCount: () => '"messageCount" + 1',
    };

    if (options.status)           update.status           = options.status;
    if (options.firstResponseAt)  update.firstResponseAt  = options.firstResponseAt;
    if (options.unreadByUser === 'increment') {
      update.unreadByUser = () => '"unreadByUser" + 1';
    } else if (options.unreadByUser !== undefined) {
      update.unreadByUser = options.unreadByUser;
    }
    if (options.unreadByAgent === 'increment') {
      update.unreadByAgent = () => '"unreadByAgent" + 1';
    } else if (options.unreadByAgent !== undefined) {
      update.unreadByAgent = options.unreadByAgent;
    }

    await this.ticketRepo.update(ticketId, update as any);
  }

  /* ── Soft delete d'un ticket ──────────────────────────────── */

  async softDelete(ticketId: string, deletedBy: string): Promise<void> {
    const ticket = await this.findRaw(ticketId);
    if (ticket.status !== SupportTicketStatus.CLOSED)
      throw new TicketAlreadyClosedException();

    await this.ticketRepo.update(ticketId, { deletedBy });
    await this.ticketRepo.softDelete(ticketId);
    this.logger.log(`[TICKET] ${ticket.reference} supprimé (soft) par ${deletedBy}`);
  }
}
