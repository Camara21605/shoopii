/* ============================================================
 * FICHIER      : src/modules/event-orchestration/event-orchestration.module.ts
 * MODULE       : EventOrchestrationEngine
 * ROLE         : Module NestJS principal du moteur d'orchestration
 * RESPONSABILITES :
 *   - Déclarer tous les providers du moteur (bus, publisher, audit, retry, DLQ)
 *   - Enregistrer les subscribers (abonnements automatiques au démarrage)
 *   - Enregistrer le scheduler d'orchestration
 *   - Importer NotificationsModule pour que les subscribers puissent notifier
 *   - Exporter EventOrchestrationEngine comme point d'accès public
 * DEPENDANCES  :
 *   NotificationsModule (pour NotificationEventService),
 *   ScheduleModule (déjà importé globalement dans app.module.ts),
 *   TypeORM (PaiementSession, Retrait pour le scheduler)
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Module }          from '@nestjs/common';
import { TypeOrmModule }   from '@nestjs/typeorm';

/* ── Entités pour le scheduler ── */
import { PaiementSession } from '../../database/entities/paiement/paiement-session.entity';
import { Retrait }         from '../../database/entities/paiement/retrait.entity';

/* ── Module de notifications (requis par les subscribers) ── */
import { NotificationsModule } from '../notifications/notifications.module';

/* ── Services core ── */
import { EventBusService }       from './services/event-bus.service';
import { EventPublisherService } from './services/event-publisher.service';
import { EventAuditService }     from './services/event-audit.service';
import { RetryManagerService }   from './services/retry-manager.service';
import { DlqService }            from './services/dlq.service';

/* ── Subscribers ── */
import { CommandeSubscriber } from './subscribers/commande.subscriber';
import { PaiementSubscriber } from './subscribers/paiement.subscriber';
import { WalletSubscriber }   from './subscribers/wallet.subscriber';
import { SystemSubscriber }   from './subscribers/system.subscriber';

/* ── Scheduler ── */
import { OrchestrationScheduler } from './scheduler/orchestration.scheduler';

/* ── Façade publique ── */
import { EventOrchestrationEngine } from './event-orchestration.engine';

/* ============================================================
 * MODULE
 * ============================================================ */

@Module({
  imports: [
    /*
     * Entités nécessaires au scheduler.
     * Le scheduler expire les sessions PENDING et détecte les retraits bloqués.
     */
    TypeOrmModule.forFeature([PaiementSession, Retrait]),

    /*
     * NotificationsModule fournit NotificationEventService
     * dont dépendent tous les subscribers.
     */
    NotificationsModule,
  ],

  providers: [
    /* -- Infrastructure événementielle -- */
    EventBusService,
    EventPublisherService,
    EventAuditService,
    RetryManagerService,
    DlqService,

    /* -- Subscribers (s'enregistrent automatiquement au onModuleInit) -- */
    CommandeSubscriber,
    PaiementSubscriber,
    WalletSubscriber,
    SystemSubscriber,

    /* -- Scheduler -- */
    OrchestrationScheduler,

    /* -- Façade publique -- */
    EventOrchestrationEngine,
  ],

  /*
   * Seul EventOrchestrationEngine est exporté.
   * Les modules externes ne doivent jamais dépendre directement
   * de EventBusService ou EventPublisherService.
   */
  exports: [EventOrchestrationEngine],
})
export class EventOrchestrationModule {}
