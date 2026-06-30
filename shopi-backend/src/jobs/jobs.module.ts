/* ============================================================
 * FICHIER : src/jobs/jobs.module.ts
 *
 * RÔLE : Regroupe toutes les tâches cron de la plateforme.
 *        Importer dans AppModule.
 *
 * TÂCHES ENREGISTRÉES :
 *   - ExpiryCronService :
 *       • Chaque heure → expire les codes d'invitation périmés
 *       • Chaque jour  → réactive les comptes livreur/entreprise (J+30)
 * ============================================================ */

import { Module }          from '@nestjs/common';
import { ScheduleModule }  from '@nestjs/schedule';
import { TypeOrmModule }   from '@nestjs/typeorm';

import { CodesModule }     from '../modules/auth/code-creation/code-creation.module';
import { Delivery }        from '../database/entities/profiles/livreur-profile.entity';
import { Company }         from '../database/entities/profiles/entreprise-profile.entity';
import { ExpiryCronService } from './expiry-cron.service';

@Module({
  imports: [
    /* Active le scheduler NestJS (@Cron, @Interval, @Timeout) */
    ScheduleModule.forRoot(),

    /* Entités nécessaires au cron de réactivation automatique */
    TypeOrmModule.forFeature([Delivery, Company]),

    /* CodeCreationService pour expirer les codes d'invitation */
    CodesModule,
  ],
  providers: [ExpiryCronService],
})
export class JobsModule {}
