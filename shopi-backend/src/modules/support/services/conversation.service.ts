/* ============================================================
 * FICHIER  : src/modules/support/services/conversation.service.ts
 * ROLE     : Gestion des messages d'un ticket (conversation).
 *
 * RESPONSABILITES :
 *   - Ajouter un message utilisateur à un ticket.
 *   - Ajouter un message agent (public ou note interne).
 *   - Déclencher l'email de notification client après réponse agent.
 *   - Déclencher la notification in-app après réponse agent.
 *   - Résoudre le profileId à partir de userId + userRole
 *     (pour NotificationEventService qui exige profileId, pas userId).
 *
 * DEPENDANCES :
 *   - SupportMessage    (InjectRepository)
 *   - TicketService     (pour findRaw + incrementCounters)
 *   - MailService       (envoi emails)
 *   - NotificationEventService (notifications in-app)
 *   - DataSource        (requête raw pour résolution profileId)
 *   - ConfigService     (FRONTEND_URL)
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService }      from '@nestjs/config';

import {
  SupportMessage,
  SupportSenderType,
} from '../../../database/entities/support/support-message.entity';
import { SupportTicketStatus } from '../../../database/entities/support/support-ticket.entity';
import { NotificationActorType } from '../../../database/entities/notification/notification.entitiy';

import { ReplySupportTicketDto } from '../dto/support.dto';
import { MailService }           from '../../email/email.service';
import { NotificationEventService } from '../../notifications/events/notification-event.service';
import { TicketService }         from './ticket.service';

import {
  TicketAlreadyClosedException,
  TicketNotOwnedException,
} from '../../../common/exceptions/support.exceptions';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectRepository(SupportMessage)
    private readonly msgRepo: Repository<SupportMessage>,

    private readonly ticketService:  TicketService,
    private readonly mailService:    MailService,
    private readonly notifEvents:    NotificationEventService,
    private readonly dataSource:     DataSource,
    private readonly config:         ConfigService,
  ) {}

  /* ─────────────────────────────────────────────────────────────
   * Résolution profileId
   *
   * SupportTicket stocke userId (string) et userRole (string).
   * NotificationEventService exige un profileId (Client.id,
   * Company.id, etc.) — jamais un userId.
   *
   * On fait une requête raw pour éviter les imports circulaires
   * entre les modules profils et le module support.
   * ─────────────────────────────────────────────────────────── */
  private async resolveProfileId(
    userId:   string,
    userRole: string,
  ): Promise<{ profileId: string; actorType: NotificationActorType } | null> {

    const ROLE_MAP: Record<string, { table: string; actorType: NotificationActorType }> = {
      client:        { table: 'clients',        actorType: NotificationActorType.CLIENT        },
      company:       { table: 'entreprises',    actorType: NotificationActorType.COMPANY       },
      delivery:      { table: 'livreurs',       actorType: NotificationActorType.DELIVERY      },
      partner:       { table: 'partenaires',    actorType: NotificationActorType.PARTNER       },
      correspondent: { table: 'correspondants', actorType: NotificationActorType.CORRESPONDENT },
      admin:         { table: 'admins',         actorType: NotificationActorType.ADMIN         },
      super_admin:   { table: 'admins',         actorType: NotificationActorType.SUPER_ADMIN   },
    };

    const cfg = ROLE_MAP[userRole];
    if (!cfg) return null;

    try {
      const rows = await this.dataSource.query(
        `SELECT id FROM "${cfg.table}" WHERE "userId" = $1 LIMIT 1`,
        [userId],
      );
      if (!rows?.length) return null;
      return { profileId: rows[0].id, actorType: cfg.actorType };
    } catch {
      return null;
    }
  }

  /* ── Réponse utilisateur ──────────────────────────────────── */

  async replyByUser(
    userId:   string,
    userName: string,
    ticketId: string,
    dto:      ReplySupportTicketDto,
  ): Promise<SupportMessage> {
    const ticket = await this.ticketService.findRaw(ticketId);
    if (ticket.userId !== userId) throw new TicketNotOwnedException();
    if (ticket.status === SupportTicketStatus.CLOSED) throw new TicketAlreadyClosedException();

    const msg = this.msgRepo.create({
      ticketId,
      content:    dto.content,
      senderType: SupportSenderType.USER,
      senderId:   userId,
      senderName: userName,
    });
    await this.msgRepo.save(msg);

    await this.ticketService.incrementCounters(ticketId, {
      status:       SupportTicketStatus.IN_PROGRESS,
      unreadByAgent: 'increment',
      unreadByUser: 0,
    });

    return msg;
  }

  /* ── Réponse agent ────────────────────────────────────────── */

  async replyAsAgent(
    agentId:    string,
    agentName:  string,
    userEmail:  string,
    ticketId:   string,
    dto:        ReplySupportTicketDto,
    isInternal = false,
  ): Promise<SupportMessage> {
    const ticket = await this.ticketService.findRaw(ticketId);

    const msg = this.msgRepo.create({
      ticketId,
      content:    dto.content,
      senderType: SupportSenderType.AGENT,
      senderId:   agentId,
      senderName: agentName,
      isInternal,
    });
    await this.msgRepo.save(msg);

    if (!isInternal) {
      await this.ticketService.incrementCounters(ticketId, {
        status:          SupportTicketStatus.WAITING_USER,
        firstResponseAt: ticket.firstResponseAt ?? new Date(),
        unreadByUser:    'increment',
        unreadByAgent:   0,
      });

      /* ── Email de notification client ───────────────────── */
      if (userEmail) {
        try {
          await this.mailService.sendSupportTicketReply({
            toEmail:   userEmail,
            agentName,
            reference: ticket.reference,
            subject:   ticket.subject,
            ticketUrl: `${this.config.get('FRONTEND_URL', 'https://shopi.gn')}/support/tickets/${ticketId}`,
          });
        } catch (e) {
          this.logger.warn(`[CONV] Email reply failed for ${userEmail}: ${e}`);
        }
      }

      /* ── Notification in-app ────────────────────────────── */
      if (ticket.userId) {
        const profile = await this.resolveProfileId(ticket.userId, ticket.userRole);
        if (profile) {
          await this.notifEvents.notifySupportTicketReply({
            recipientType: profile.actorType,
            recipientId:   profile.profileId,
            agentName,
            ticketId,
            ticketRef:     ticket.reference,
            ticketSubject: ticket.subject,
          });
        } else {
          this.logger.warn(
            `[CONV] profileId introuvable userId=${ticket.userId} role=${ticket.userRole} — notif in-app ignorée`,
          );
        }
      }
    }

    return msg;
  }
}
