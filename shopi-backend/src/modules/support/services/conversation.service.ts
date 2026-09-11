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
import { User } from '../../../database/entities/user.entity';
import { UserRole } from '../../../common/enums/user-role.enum';

import { ReplySupportTicketDto } from '../dto/support.dto';
import { MailService }           from '../../email/email.service';
import { NotificationEventService } from '../../notifications/events/notification-event.service';
import { TicketService }         from './ticket.service';
import { SupportBroadcastService } from './support-broadcast.service';

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

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly ticketService:  TicketService,
    private readonly mailService:    MailService,
    private readonly notifEvents:    NotificationEventService,
    private readonly broadcast:      SupportBroadcastService,
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

  /*
   * BUG CORRIGÉ — quand le client répondait, seul le compteur
   * unreadByAgent était incrémenté (badge passif dans la liste des
   * tickets, voir SupportSection.tsx / SupportPage.tsx) : aucune
   * notification active n'était envoyée. Un agent ne consultant pas
   * la page ne savait jamais qu'un client avait répondu. Notifie
   * maintenant l'agent assigné (ticket.agentId), ou à défaut le(s)
   * super-admin(s) si le ticket n'est encore assigné à personne —
   * cohérent avec la portée globale du super-admin (voir
   * SupportPermissionService : null = accès à tout).
   */
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
    this.broadcastMessage(msg);

    await this.ticketService.incrementCounters(ticketId, {
      status:       SupportTicketStatus.IN_PROGRESS,
      unreadByAgent: 'increment',
      unreadByUser: 0,
    });

    await this.notifyOnUserReply(ticket.agentId, userName, ticketId, ticket.reference, ticket.subject);

    return msg;
  }

  /* Diffuse le message en direct à quiconque a la room ticket:{id}
   * ouverte (voir SupportGateway.join_ticket) — indépendant du système
   * de notification-bell (NotificationEventService), qui reste destiné
   * à alerter quelqu'un qui N'A PAS le fil ouvert à l'écran. */
  private broadcastMessage(msg: SupportMessage): void {
    this.broadcast.emitNewMessage({
      ticketId: msg.ticketId,
      message: {
        id:         msg.id,
        ticketId:   msg.ticketId,
        content:    msg.content,
        senderType: msg.senderType,
        senderId:   msg.senderId,
        senderName: msg.senderName,
        isInternal: msg.isInternal,
        createdAt:  msg.createdAt.toISOString(),
      },
    });
  }

  /* ── Notification agent/super-admin sur réponse client ──────
   * ticket.agentId stocke le userId de l'admin assigné (voir
   * AssignTicketDto / support-agent.controller.ts assign()), jamais un
   * profileId — résolu ici via resolveProfileId() comme pour tout admin. */
  private async notifyOnUserReply(
    agentUserId:   string | null,
    userName:      string,
    ticketId:      string,
    ticketRef:     string,
    ticketSubject: string,
  ): Promise<void> {
    if (agentUserId) {
      const profile = await this.resolveProfileId(agentUserId, UserRole.ADMIN);
      if (profile) {
        await this.notifEvents.notifySupportTicketUserReply({
          recipientType: profile.actorType,
          recipientId:   profile.profileId,
          userName, ticketId, ticketRef, ticketSubject,
        });
      }
      return;
    }

    /* Ticket non assigné → le(s) super-admin(s). Leur identité de
     * notification est leur userId directement (pas de profil Admin
     * dédié pour le compte seedé — voir AuthService.findProfileId(),
     * qui ne résout aucun profileId pour SUPER_ADMIN et laisse le
     * gateway retomber sur userId). */
    const superAdmins = await this.userRepo.find({
      where: { role: UserRole.SUPER_ADMIN }, select: ['id'],
    });
    for (const sa of superAdmins) {
      await this.notifEvents.notifySupportTicketUserReply({
        recipientType: NotificationActorType.SUPER_ADMIN,
        recipientId:   sa.id,
        userName, ticketId, ticketRef, ticketSubject,
      });
    }
  }

  /* ── Réponse agent ────────────────────────────────────────── */

  /*
   * BUG CORRIGÉ — l'email de notification client dépendait d'un
   * paramètre `userEmail` fourni par l'appelant (contrôleur agent),
   * lui-même lu depuis le body de la requête frontend. Mais
   * GET /support/agent/tickets/:id ne renvoie jamais l'email de
   * l'auteur (SupportTicket ne stocke pas d'email, par design —
   * évite la dénormalisation) : le frontend n'avait donc AUCUN moyen
   * de connaître cette adresse, et userEmail était toujours vide/
   * undefined → l'email de réponse ne partait jamais, silencieusement,
   * pour AUCUN agent (admin, partenaire, super-admin). Résolu
   * maintenant côté serveur depuis ticket.userId, comme le fait déjà
   * resolveProfileId() pour la notification in-app.
   */
  async replyAsAgent(
    agentId:    string,
    agentName:  string,
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
      /* SÉCURITÉ — ne JAMAIS diffuser une note interne dans la room
       * ticket:{id} : elle est partagée par le client ET les agents
       * (voir SupportGateway.canAccessTicket), donc tout ce qui y
       * transite est visible du client. Une note interne reste
       * REST-only (l'agent la voit au prochain chargement du fil) —
       * même principe que le filtre isInternal:false ajouté à
       * findOneByUser() ci-dessus. */
      this.broadcastMessage(msg);

      await this.ticketService.incrementCounters(ticketId, {
        status:          SupportTicketStatus.WAITING_USER,
        firstResponseAt: ticket.firstResponseAt ?? new Date(),
        unreadByUser:    'increment',
        unreadByAgent:   0,
      });

      /* ── Email + notification in-app ─────────────────────── */
      if (ticket.userId) {
        const user = await this.userRepo.findOne({
          where: { id: ticket.userId }, select: ['email'],
        });

        if (user?.email) {
          try {
            await this.mailService.sendSupportTicketReply({
              toEmail:   user.email,
              agentName,
              reference: ticket.reference,
              subject:   ticket.subject,
              ticketUrl: `${this.config.get('FRONTEND_URL', 'https://shopi.gn')}/support/tickets/${ticketId}`,
            });
          } catch (e) {
            this.logger.warn(`[CONV] Email reply failed for ${user.email}: ${e}`);
          }
        }

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
