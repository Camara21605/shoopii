/* ============================================================
 * FICHIER : returns/services/sav.service.ts
 *
 * RÔLE : Logique métier du Service Après-Vente (SAV).
 *        Tickets + messagerie interne entre client et entreprise.
 * ============================================================ */

import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { SavTicket, SavStatus }
  from 'src/database/entities/returns/sav-ticket.entity';
import { SavMessage }
  from 'src/database/entities/returns/sav-message.entity';
import { Company }
  from 'src/database/entities/profiles/entreprise-profile.entity';
import { Client }
  from 'src/database/entities/profiles/client-profile.entity';
import { Commande }
  from 'src/database/entities/commande/commande.entity';
import { User }
  from 'src/database/entities/user.entity';
import { ReturnPriority }
  from 'src/database/entities/returns/return-request.entity';

import {
  CreateSavTicketDto, ReplySavDto,
  AssignSavDto, FilterSavDto, UpdateSavPriorityDto,
} from '../dto/sav.dto';

@Injectable()
export class SavService {

  private readonly logger = new Logger(SavService.name);

  constructor(
    @InjectRepository(SavTicket)   private readonly ticketRepo:  Repository<SavTicket>,
    @InjectRepository(SavMessage)  private readonly messageRepo: Repository<SavMessage>,
    @InjectRepository(Company)     private readonly companyRepo: Repository<Company>,
    @InjectRepository(Client)      private readonly clientRepo:  Repository<Client>,
    @InjectRepository(Commande)    private readonly commandeRepo: Repository<Commande>,
    @InjectRepository(User)        private readonly userRepo:    Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /* ══════════════════════════════════════════════════════════
   * LISTE PAGINÉE — côté entreprise
   ══════════════════════════════════════════════════════════ */
  async findAll(userId: string, filters: FilterSavDto) {
    const company = await this.resolveCompany(userId);
    const { page = 1, limit = 20, status, priority, search } = filters;

    const qb = this.ticketRepo
      .createQueryBuilder('t')
      .where('t.companyId = :companyId', { companyId: company.id })
      .orderBy('t.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status)   qb.andWhere('t.status = :status',     { status });
    if (priority) qb.andWhere('t.priority = :priority', { priority });

    if (search?.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(t.reference) LIKE :q OR LOWER(t.subject) LIKE :q)', { q });
    }

    const [tickets, total] = await qb.getManyAndCount();

    /* Enrichir avec noms clients en batch */
    const enriched = await this.enrichTickets(tickets);

    return { data: enriched, total, page, pages: Math.ceil(total / limit) };
  }

  /* ══════════════════════════════════════════════════════════
   * DÉTAIL TICKET + MESSAGES
   ══════════════════════════════════════════════════════════ */
  async findOne(userId: string, ticketId: string) {
    const company = await this.resolveCompany(userId);
    const ticket  = await this.ticketRepo.findOne({
      where: { id: ticketId, companyId: company.id },
      relations: ['messages'],
    });
    if (!ticket) throw new NotFoundException('Ticket SAV introuvable.');

    /* Marquer les messages non lus comme lus (côté entreprise) */
    const unreadIds = (ticket.messages ?? [])
      .filter(m => !m.isRead && m.senderRole === 'client')
      .map(m => m.id);

    if (unreadIds.length > 0) {
      await this.messageRepo
        .createQueryBuilder()
        .update(SavMessage)
        .set({ isRead: true })
        .whereInIds(unreadIds)
        .execute();

      await this.ticketRepo.update(ticketId, { unreadCount: 0 });
    }

    const messages = [...(ticket.messages ?? [])].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    const [client, commande] = await Promise.all([
      ticket.clientId
        ? this.clientRepo.findOne({ where: { id: ticket.clientId }, select: ['userId'] })
        : null,
      ticket.commandeId
        ? this.commandeRepo.findOne({ where: { id: ticket.commandeId }, select: ['id', 'numero'] })
        : null,
    ]);

    let clientName = 'Client'; let clientAvatar: string | null = null;
    if (client?.userId) {
      const user = await this.userRepo.findOne({
        where: { id: client.userId },
        select: ['id', 'firstName', 'lastName', 'email', 'profilePicture'],
      });
      if (user) {
        clientName   = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
        clientAvatar = user.profilePicture ?? null;
      }
    }

    return {
      ...ticket,
      messages,
      clientName,
      clientAvatar,
      commandeNumero: commande?.numero ?? null,
    };
  }

  /* ══════════════════════════════════════════════════════════
   * CRÉER TICKET — côté client
   ══════════════════════════════════════════════════════════ */
  async createByClient(clientUserId: string, companyId: string, dto: CreateSavTicketDto) {
    const client = await this.clientRepo.findOne({ where: { userId: clientUserId } });
    if (!client) throw new NotFoundException('Profil client introuvable.');

    const company = await this.companyRepo.findOne({
      where: { id: companyId }, select: ['id'],
    });
    if (!company) throw new NotFoundException('Entreprise introuvable.');

    /* Valider la commande si fournie */
    if (dto.commandeId) {
      const commande = await this.commandeRepo.findOne({
        where: { id: dto.commandeId, clientId: client.id },
        select: ['id'],
      });
      if (!commande) throw new NotFoundException('Commande introuvable.');
    }

    const user = await this.userRepo.findOne({
      where: { id: clientUserId }, select: ['id', 'firstName', 'lastName', 'profilePicture'],
    });

    const reference = await this.generateReference();

    const ticket = await this.dataSource.transaction(async em => {
      const t = em.create(SavTicket, {
        reference,
        companyId:    company.id,
        clientId:     client.id,
        commandeId:   dto.commandeId ?? null,
        productId:    dto.productId  ?? null,
        productName:  dto.productName ?? null,
        subject:      dto.subject,
        firstMessage: dto.firstMessage,
        status:       SavStatus.OPEN,
        priority:     dto.priority ?? ReturnPriority.NORMAL,
        messageCount: 1,
        unreadCount:  1,
      });
      const saved = await em.save(t);

      await em.save(em.create(SavMessage, {
        ticketId:    saved.id,
        content:     dto.firstMessage,
        senderRole:  'client',
        senderId:    clientUserId,
        senderName:  user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : 'Client',
        senderAvatar: user?.profilePicture ?? null,
        isRead:      false,
      }));

      return saved;
    });

    this.logger.log(`[SAV] Ticket créé ${reference} — clientId=${client.id}`);
    return ticket;
  }

  /* ══════════════════════════════════════════════════════════
   * RÉPONDRE À UN TICKET
   ══════════════════════════════════════════════════════════ */
  async reply(userId: string, ticketId: string, dto: ReplySavDto) {
    const company = await this.resolveCompany(userId);
    const ticket  = await this.findTicketOrFail(ticketId, company.id);

    if (ticket.status === SavStatus.CLOSED) {
      throw new BadRequestException('Le ticket est fermé. Impossible de répondre.');
    }

    const user = await this.userRepo.findOne({
      where: { id: userId }, select: ['id', 'firstName', 'lastName', 'profilePicture'],
    });

    const message = await this.dataSource.transaction(async em => {
      const m = em.create(SavMessage, {
        ticketId,
        content:     dto.content,
        senderRole:  'enterprise',
        senderId:    userId,
        senderName:  user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : 'Entreprise',
        senderAvatar: user?.profilePicture ?? null,
        isRead:      false,
      });
      const saved = await em.save(m);

      /* Mise à jour ticket : statut, compteurs, firstResponseAt */
      const updates: Partial<SavTicket> = {
        status:       SavStatus.IN_PROGRESS,
        messageCount: (ticket.messageCount ?? 0) + 1,
      };
      if (!ticket.firstResponseAt) {
        updates.firstResponseAt   = new Date();
        updates.responseTimeMinutes = Math.floor(
          (new Date().getTime() - new Date(ticket.createdAt).getTime()) / 60000,
        );
      }
      await em.update(SavTicket, { id: ticketId }, updates);

      return saved;
    });

    this.logger.log(`[SAV] Réponse sur ticket ${ticket.reference} — userId=${userId}`);
    return message;
  }

  /* ══════════════════════════════════════════════════════════
   * FERMER UN TICKET
   ══════════════════════════════════════════════════════════ */
  async close(userId: string, ticketId: string) {
    const company = await this.resolveCompany(userId);
    const ticket  = await this.findTicketOrFail(ticketId, company.id);

    if (ticket.status === SavStatus.CLOSED) {
      throw new BadRequestException('Le ticket est déjà fermé.');
    }

    ticket.status   = SavStatus.CLOSED;
    ticket.closedAt = new Date();
    await this.ticketRepo.save(ticket);

    this.logger.log(`[SAV] Ticket fermé ${ticket.reference} — userId=${userId}`);
    return ticket;
  }

  /* ══════════════════════════════════════════════════════════
   * RÉSOUDRE UN TICKET
   ══════════════════════════════════════════════════════════ */
  async resolve(userId: string, ticketId: string) {
    const company = await this.resolveCompany(userId);
    const ticket  = await this.findTicketOrFail(ticketId, company.id);

    ticket.status     = SavStatus.RESOLVED;
    ticket.resolvedAt = new Date();
    await this.ticketRepo.save(ticket);

    return ticket;
  }

  /* ══════════════════════════════════════════════════════════
   * ASSIGNER UN TICKET
   ══════════════════════════════════════════════════════════ */
  async assign(userId: string, ticketId: string, dto: AssignSavDto) {
    const company = await this.resolveCompany(userId);
    const ticket  = await this.findTicketOrFail(ticketId, company.id);

    ticket.assigneeId = dto.assigneeId;
    await this.ticketRepo.save(ticket);
    return ticket;
  }

  /* ══════════════════════════════════════════════════════════
   * CHANGER PRIORITÉ
   ══════════════════════════════════════════════════════════ */
  async updatePriority(userId: string, ticketId: string, dto: UpdateSavPriorityDto) {
    const company = await this.resolveCompany(userId);
    const ticket  = await this.findTicketOrFail(ticketId, company.id);

    ticket.priority = dto.priority;
    await this.ticketRepo.save(ticket);
    return { priority: ticket.priority };
  }

  /* ══════════════════════════════════════════════════════════
   * STATISTIQUES SAV
   ══════════════════════════════════════════════════════════ */
  async getStats(userId: string) {
    const company = await this.resolveCompany(userId);
    const companyId = company.id;

    const [open, inProgress, waitingClient, resolved, closed, avgResponse] = await Promise.all([
      this.ticketRepo.count({ where: { companyId, status: SavStatus.OPEN } }),
      this.ticketRepo.count({ where: { companyId, status: SavStatus.IN_PROGRESS } }),
      this.ticketRepo.count({ where: { companyId, status: SavStatus.WAITING_CLIENT } }),
      this.ticketRepo.count({ where: { companyId, status: SavStatus.RESOLVED } }),
      this.ticketRepo.count({ where: { companyId, status: SavStatus.CLOSED } }),
      this.ticketRepo
        .createQueryBuilder('t')
        .select('AVG(t.responseTimeMinutes)', 'avg')
        .where('t.companyId = :companyId', { companyId })
        .andWhere('t.responseTimeMinutes IS NOT NULL')
        .getRawOne(),
    ]);

    return {
      open, inProgress, waitingClient, resolved, closed,
      total: open + inProgress + waitingClient + resolved + closed,
      avgResponseMinutes: Math.round(Number(avgResponse?.avg ?? 0)),
    };
  }

  /* ══════════════════════════════════════════════════════════
   * LISTE TICKETS — côté client
   ══════════════════════════════════════════════════════════ */
  async findAllByClient(clientUserId: string, filters: FilterSavDto) {
    const client = await this.clientRepo.findOne({ where: { userId: clientUserId } });
    if (!client) throw new NotFoundException('Profil client introuvable.');

    const { page = 1, limit = 20, status, priority, search } = filters;

    const qb = this.ticketRepo
      .createQueryBuilder('t')
      .where('t.clientId = :clientId', { clientId: client.id })
      .orderBy('t.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status)   qb.andWhere('t.status = :status',     { status });
    if (priority) qb.andWhere('t.priority = :priority', { priority });
    if (search?.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(t.reference) LIKE :q OR LOWER(t.subject) LIKE :q)', { q });
    }

    const [tickets, total] = await qb.getManyAndCount();
    return { data: tickets, total, page, pages: Math.ceil(total / limit) };
  }

  /* ══════════════════════════════════════════════════════════
   * DÉTAIL TICKET — côté client
   ══════════════════════════════════════════════════════════ */
  async findOneByClient(clientUserId: string, ticketId: string) {
    const client = await this.clientRepo.findOne({ where: { userId: clientUserId } });
    if (!client) throw new NotFoundException('Profil client introuvable.');

    const ticket = await this.ticketRepo.findOne({
      where: { id: ticketId, clientId: client.id },
      relations: ['messages'],
    });
    if (!ticket) throw new NotFoundException('Ticket SAV introuvable.');

    const unreadIds = (ticket.messages ?? [])
      .filter(m => !m.isRead && m.senderRole !== 'client')
      .map(m => m.id);

    if (unreadIds.length > 0) {
      await this.messageRepo.createQueryBuilder()
        .update(SavMessage)
        .set({ isRead: true })
        .whereInIds(unreadIds)
        .execute();
    }

    const messages = [...(ticket.messages ?? [])].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    return { ...ticket, messages };
  }

  /* ══════════════════════════════════════════════════════════
   * RÉPONDRE À UN TICKET — côté client
   ══════════════════════════════════════════════════════════ */
  async replyByClient(clientUserId: string, ticketId: string, dto: ReplySavDto) {
    const client = await this.clientRepo.findOne({ where: { userId: clientUserId } });
    if (!client) throw new NotFoundException('Profil client introuvable.');

    const ticket = await this.ticketRepo.findOne({
      where: { id: ticketId, clientId: client.id },
    });
    if (!ticket) throw new NotFoundException('Ticket SAV introuvable.');
    if (ticket.status === SavStatus.CLOSED) {
      throw new BadRequestException('Le ticket est fermé. Impossible de répondre.');
    }

    const user = await this.userRepo.findOne({
      where: { id: clientUserId }, select: ['id', 'firstName', 'lastName', 'profilePicture'],
    });

    return this.dataSource.transaction(async em => {
      const m = em.create(SavMessage, {
        ticketId,
        content:     dto.content,
        senderRole:  'client',
        senderId:    clientUserId,
        senderName:  user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : 'Client',
        senderAvatar: user?.profilePicture ?? null,
        isRead:      false,
      });
      const saved = await em.save(m);

      await em.update(SavTicket, { id: ticketId }, {
        status:       SavStatus.WAITING_CLIENT,
        messageCount: (ticket.messageCount ?? 0) + 1,
        unreadCount:  (ticket.unreadCount ?? 0) + 1,
      });

      return saved;
    });
  }

  /* ── Helpers ── */

  private async resolveCompany(userId: string): Promise<Company> {
    const c = await this.companyRepo.findOne({ where: { userId }, select: ['id', 'companyName'] });
    if (!c) throw new NotFoundException('Profil entreprise introuvable.');
    return c;
  }

  private async findTicketOrFail(ticketId: string, companyId: string): Promise<SavTicket> {
    const t = await this.ticketRepo.findOne({ where: { id: ticketId, companyId } });
    if (!t) throw new NotFoundException('Ticket SAV introuvable.');
    return t;
  }

  private async generateReference(): Promise<string> {
    const year  = new Date().getFullYear();
    const count = await this.ticketRepo.count();
    return `SAV-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private async enrichTickets(tickets: SavTicket[]) {
    if (tickets.length === 0) return [];

    const clientIds = [...new Set(tickets.map(t => t.clientId).filter(Boolean))];
    const clients   = await this.clientRepo.find({
      where: { id: clientIds.length > 0 ? clientIds as any : [] },
      select: ['id', 'userId'],
    });
    const clientMap = new Map(clients.map(c => [c.id, c.userId]));

    const userIds = [...new Set(clients.map(c => c.userId).filter(Boolean))];
    const users   = userIds.length > 0
      ? await this.userRepo.find({ where: { id: userIds as any }, select: ['id', 'firstName', 'lastName'] })
      : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    return tickets.map(t => {
      const cid    = t.clientId as string | undefined;
      const userId = cid ? (clientMap.get(cid) ?? null) : null;
      const user   = userId ? userMap.get(userId) : null;
      return {
        id:            t.id,
        reference:     t.reference,
        subject:       t.subject,
        status:        t.status,
        priority:      t.priority,
        messageCount:  t.messageCount,
        unreadCount:   t.unreadCount,
        productName:   t.productName,
        assigneeId:    t.assigneeId,
        firstResponseAt: t.firstResponseAt,
        createdAt:     t.createdAt,
        updatedAt:     t.updatedAt,
        clientName: user
          ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
          : 'Client',
      };
    });
  }
}
