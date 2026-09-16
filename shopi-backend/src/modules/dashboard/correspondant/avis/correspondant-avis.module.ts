/* ============================================================
 * FICHIER : src/modules/dashboard/correspondant/avis/correspondant-avis.module.ts
 * ============================================================ */

import { Module }       from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Correspondent }     from 'src/database/entities/profiles/correspondant-profile.entity';
import { CorrespondantAvis } from 'src/database/entities/correspondant.table/correspondant-avis.entity';
import { Commande }          from 'src/database/entities/commande/commande.entity';

/* Fournit NotificationEventService — notifie le client quand le
 * correspondant répond à son avis (voir CorrespondantAvisService.repondre). */
import { NotificationsModule } from 'src/modules/notifications/notifications.module';

import { CorrespondantAvisController } from './correspondant-avis.controller';
import { CorrespondantAvisService }    from './correspondant-avis.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Correspondent, CorrespondantAvis, Commande]),
    NotificationsModule,
  ],
  controllers: [CorrespondantAvisController],
  providers:   [CorrespondantAvisService],
})
export class CorrespondantAvisModule {}
