/* ============================================================
 * FICHIER  : src/modules/support/support.module.ts
 * ROLE     : Module NestJS du système de support tickets Shopi.
 *
 * RESPONSABILITES :
 *   - Enregistrer les entités TypeORM : SupportTicket,
 *     SupportMessage, Attachment.
 *   - Déclarer les sous-services (responsabilité unique) :
 *       · TicketService       → CRUD tickets
 *       · ConversationService → messages + email + notif in-app
 *       · AttachmentService   → upload/delete pièces jointes
 *   - Déclarer les services transverses :
 *       · SupportService      → façade exportée
 *       · SupportStatsService → analytiques
 *       · SupportExportService→ export CSV
 *       · SupportSuggestService→ suggestions FTS
 *   - Exporter SupportService (consommé par ContactModule).
 *
 * DEPENDANCES :
 *   - MailModule          → emails de confirmation et notification
 *   - NotificationsModule → notifications in-app (Phase 6)
 *   - UploadModule        → upload pièces jointes Cloudinary
 * ============================================================ */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SupportTicket }  from '../../database/entities/support/support-ticket.entity';
import { SupportMessage } from '../../database/entities/support/support-message.entity';
import { Attachment }     from '../../database/entities/support/attachment.entity';

/* Entités profil — nécessaires pour SupportPermissionService (résolution portée hiérarchique) */
import { Partner }       from '../../database/entities/profiles/partenaire-profile.entity';
import { Company }       from '../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }      from '../../database/entities/profiles/livreur-profile.entity';
import { Correspondent } from '../../database/entities/profiles/correspondant-profile.entity';

import { MailModule }          from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UploadModule }        from '../upload/upload.module';

/* ── Sous-services (responsabilité unique) ─────────────────── */
import { TicketService }       from './services/ticket.service';
import { ConversationService } from './services/conversation.service';
import { AttachmentService }   from './services/attachment.service';

/* ── Services transverses ──────────────────────────────────── */
import { SupportService }           from './services/support.service';
import { SupportPermissionService } from './services/support-permission.service';
import { SupportStatsService }      from './services/support-stats.service';
import { SupportExportService }     from './services/support-export.service';
import { SupportSuggestService }    from './services/support-suggest.service';

/* ── Contrôleurs ───────────────────────────────────────────── */
import { SupportClientController } from './controllers/support-client.controller';
import { SupportAgentController }  from './controllers/support-agent.controller';
import { SupportPublicController } from './controllers/support-public.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SupportTicket, SupportMessage, Attachment,
      /* Profils nécessaires pour SupportPermissionService */
      Partner, Company, Delivery, Correspondent,
    ]),

    /* Emails de confirmation (création ticket) et notification (réponse agent) */
    MailModule,

    /* NotificationsModule — notifications in-app lors des réponses agent.
     * Exporte NotificationEventService injecté dans ConversationService. */
    NotificationsModule,

    /* UploadModule — Cloudinary pour les pièces jointes support.
     * Exporte UploadService injecté dans AttachmentService. */
    UploadModule,
  ],

  providers: [
    /* Sous-services — responsabilité unique, non exportés */
    TicketService,
    ConversationService,
    AttachmentService,

    /* Façade exportée — seul point de contact pour les modules externes */
    SupportService,

    /* Portée hiérarchique des tickets (OWASP A01:2021) */
    SupportPermissionService,

    /* Services transverses */
    SupportStatsService,
    SupportExportService,
    SupportSuggestService,
  ],

  controllers: [
    SupportClientController,
    SupportAgentController,
    SupportPublicController,
  ],

  /* SupportService exporté pour ContactModule (escalade formulaire → ticket) */
  exports: [SupportService],
})
export class SupportModule {}
