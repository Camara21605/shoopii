/* ============================================================
 * FICHIER : src/jobs/jobs.module.ts
 *
 * RÔLE : Regroupe toutes les tâches cron de la plateforme.
 *        Importer dans AppModule après SupportModule.
 *
 * TÂCHES ENREGISTRÉES :
 *   - ExpiryCronService :
 *       • Chaque heure → expire les codes d'invitation périmés
 *       • Chaque jour  → réactive les comptes livreur/entreprise (J+30)
 *
 *   - SupportSlaCronService :
 *       • Chaque heure → détecte les tickets sans réponse > 24h
 *       • Envoie un email d'alerte à l'équipe support
 *       • Marque slaBreachedAt pour éviter les doublons
 *
 * ORDRE DES MODULES DANS AppModule :
 *   SupportModule doit être déclaré AVANT JobsModule car
 *   SupportSlaCronService a besoin de SupportTicket (entité)
 *   et de MailModule → ces dépendances doivent être disponibles.
 * ============================================================ */

import { Module }          from '@nestjs/common';
import { ScheduleModule }  from '@nestjs/schedule';
import { TypeOrmModule }   from '@nestjs/typeorm';

import { CodesModule }     from '../modules/auth/code-creation/code-creation.module';
import { Delivery }        from '../database/entities/profiles/livreur-profile.entity';
import { Company }         from '../database/entities/profiles/entreprise-profile.entity';
import { SupportTicket }   from '../database/entities/support/support-ticket.entity';
import { MailModule }      from '../modules/email/email.module';

import { ExpiryCronService }        from './expiry-cron.service';
import { SupportSlaCronService }    from './support-sla.cron.service';
import { DeliveryGroupExpiryService } from './delivery-group-expiry.service';
import { DeliveryGroupModule }      from '../modules/delivery-group/delivery-group.module';

@Module({
  imports: [
    /* Active le scheduler NestJS (@Cron, @Interval, @Timeout).
     * ScheduleModule.forRoot() doit être appelé UNE SEULE FOIS
     * dans toute l'application (dans ce module centralisé). */
    ScheduleModule.forRoot(),

    /* Entités nécessaires au cron de réactivation automatique (ExpiryCronService) */
    TypeOrmModule.forFeature([Delivery, Company]),

    /* Entité SupportTicket pour le cron SLA (SupportSlaCronService) */
    TypeOrmModule.forFeature([SupportTicket]),

    /* CodeCreationService pour expirer les codes d'invitation */
    CodesModule,

    /* MailModule pour que SupportSlaCronService puisse envoyer
     * les alertes email quand un SLA est dépassé. */
    MailModule,

    /* DeliveryGroupModule pour le cron d'expiration 72h */
    DeliveryGroupModule,
  ],
  providers: [
    ExpiryCronService,           /* Cron d'expiration codes + réactivation comptes */
    SupportSlaCronService,       /* Cron d'alerte SLA tickets support */
    DeliveryGroupExpiryService,  /* Cron d'expiration groupes 72h post-livraison */
  ],
})
export class JobsModule {}

