/* ============================================================
 * FICHIER : src/modules/notifications/notifications.module.ts
 *
 * RÔLE : Module NestJS centralisant tout le système de notifications.
 *
 * ORDRE D'IMPORT CRITIQUE :
 *   Ce module doit être importé dans app.module.ts APRÈS :
 *     - RedisModule   (requis par @InjectRedis())
 *     - BullModule    (requis par @InjectQueue())
 *
 * EXPORTS :
 *   NotificationService → exporté pour être utilisé par les
 *   autres modules qui veulent créer des notifications (Phase 2).
 *   Ex: CommandeModule, MessagerieModule, SuivisModule.
 *
 * PATTERN STRATEGY :
 *   Les 4 strategies sont fournies via un tableau injecté
 *   sous le token NOTIFICATION_CHANNEL_STRATEGIES.
 *   NotificationDispatchService ne connaît que ce token.
 * ============================================================ */

import { Module }              from '@nestjs/common';
import { TypeOrmModule }       from '@nestjs/typeorm';
import { BullModule }          from '@nestjs/bullmq';
import { JwtModule }           from '@nestjs/jwt';
import { ConfigService }       from '@nestjs/config';

// ── Entités ────────────────────────────────────────────────
import { Notification }
  from 'src/database/entities/notification/notification.entitiy';
import { NotificationPreference }
  from 'src/database/entities/notification/notification-preference.entity';
import { NotificationDeliveryLog }
  from 'src/database/entities/notification/notification-delivery-log.entity';

// ── Queue ──────────────────────────────────────────────────
import { NOTIFICATION_QUEUE }           from './queue/notification.queue';
import { NotificationProcessor }        from './queue/notification.processor';

// ── Repository ─────────────────────────────────────────────
import { NotificationRepository }       from './repositories/notification.repository';

// ── Strategies ─────────────────────────────────────────────
import { InAppChannelStrategy }         from './strategies/inapp-channel.strategy';
import { EmailChannelStrategy }         from './strategies/email-channel.strategy';
import { SmsChannelStrategy }           from './strategies/sms-channel.strategy';
import { PushChannelStrategy }          from './strategies/push-channel.strategy';
import { NOTIFICATION_CHANNEL_STRATEGIES }
  from './interfaces/channel-strategy.interface';

// ── Services ───────────────────────────────────────────────
import { NotificationBroadcastService } from './services/notification-broadcast.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { NotificationDispatchService }  from './services/notification-dispatch.service';
import { NotificationService }          from './services/notification.service';
import { NotificationReminderService }  from './services/notification-reminder.service';

// ── Gateway ────────────────────────────────────────────────
import { NotificationGateway }          from './gateway/notification.gateway';

// ── Scheduler ──────────────────────────────────────────────
import { NotificationScheduler }        from './scheduler/notification.scheduler';

// ── Event façade ───────────────────────────────────────────
import { NotificationEventService }     from './events/notification-event.service';

// ── Controllers ────────────────────────────────────────────
import { NotificationsController }      from './notifications.controller';
import { NotificationsAdminController } from './notifications-admin.controller';
import { NotificationStatsService }     from './services/notification-stats.service';

@Module({
  imports: [
    // ── TypeORM : les 3 entités du système de notifications ──
    TypeOrmModule.forFeature([
      Notification,
      NotificationPreference,
      NotificationDeliveryLog,
    ]),

    // ── BullMQ : queue notifications ─────────────────────────
    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE,
      /*
       * defaultJobOptions appliqués à tous les jobs de cette queue.
       * Chaque job peut les surcharger individuellement.
       */
      defaultJobOptions: {
        attempts:          3,
        backoff:           { type: 'exponential', delay: 5_000 },
        removeOnComplete:  { count: 200, age: 3600 },  // garde 200 jobs récents ou 1h
        removeOnFail:      false,                        // conserve les échecs pour audit
      },
    }),

    // ── JWT : pour la vérification dans le gateway ───────────
    JwtModule.registerAsync({
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],

  controllers: [NotificationsController, NotificationsAdminController],

  providers: [
    // ── Strategies individuelles ──────────────────────────────
    InAppChannelStrategy,
    EmailChannelStrategy,
    SmsChannelStrategy,
    PushChannelStrategy,

    /*
     * Tableau de toutes les strategies injecté sous un seul token.
     *
     * NotificationDispatchService déclare :
     *   @Inject(NOTIFICATION_CHANNEL_STRATEGIES)
     *   private readonly strategies: IChannelStrategy[]
     *
     * Avantage Open/Closed :
     *   Pour ajouter un canal → ajouter la strategy ici.
     *   NotificationDispatchService ne change pas.
     */
    {
      provide:    NOTIFICATION_CHANNEL_STRATEGIES,
      useFactory: (
        inApp:  InAppChannelStrategy,
        email:  EmailChannelStrategy,
        sms:    SmsChannelStrategy,
        push:   PushChannelStrategy,
      ) => [inApp, email, sms, push],
      inject: [
        InAppChannelStrategy,
        EmailChannelStrategy,
        SmsChannelStrategy,
        PushChannelStrategy,
      ],
    },

    // ── Services ──────────────────────────────────────────────
    NotificationRepository,
    NotificationBroadcastService,
    NotificationPreferenceService,
    NotificationDispatchService,
    NotificationService,
    NotificationReminderService,
    NotificationStatsService,

    // ── Gateway + Processor + Scheduler ──────────────────────
    NotificationGateway,
    NotificationProcessor,
    NotificationScheduler,

    // ── Event façade (Phase 2) ────────────────────────────────
    NotificationEventService,
  ],

  exports: [
    /*
     * NotificationService → injecter pour créer des notifications.
     * NotificationEventService → façade métier (follow, message, commande…).
     * NotificationBroadcastService → pour les gateways Socket.IO.
     *
     * Importez NotificationsModule dans votre module pour y accéder.
     */
    NotificationService,
    NotificationEventService,
    NotificationBroadcastService,
  ],
})
export class NotificationsModule {}
