/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/avis/avis.module.ts
 * ============================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule }  from '@nestjs/typeorm';

import { Company }       from 'src/database/entities/profiles/entreprise-profile.entity';
import { CompanyAvis }   from 'src/database/entities/entreprise.table/company-avis.entity';
import { CommandeItem }  from 'src/database/entities/commande/commande-item.entity';
import { Commande }      from 'src/database/entities/commande/commande.entity';

/* Fournit NotificationEventService — notifie le client quand la
 * boutique répond à son avis (voir AvisService.repondre). */
import { NotificationsModule } from 'src/modules/notifications/notifications.module';

import { AvisController } from './avis.controller';
import { AvisService }    from './avis.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Company, CompanyAvis, CommandeItem, Commande]),
    NotificationsModule,
  ],
  controllers: [AvisController],
  providers:   [AvisService],
})
export class AvisModule {}
