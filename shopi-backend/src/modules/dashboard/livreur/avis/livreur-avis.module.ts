/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/avis/livreur-avis.module.ts
 * ============================================================ */

import { Module }       from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Delivery }    from 'src/database/entities/profiles/livreur-profile.entity';
import { LivreurAvis } from 'src/database/entities/livreur.table/livreur-avis.entity';
import { Commande }    from 'src/database/entities/commande/commande.entity';

/* Fournit NotificationEventService — notifie le client quand le livreur
 * répond à son avis (voir LivreurAvisService.repondre). */
import { NotificationsModule } from 'src/modules/notifications/notifications.module';

import { LivreurAvisController } from './livreur-avis.controller';
import { LivreurAvisService }    from './livreur-avis.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Delivery, LivreurAvis, Commande]),
    NotificationsModule,
  ],
  controllers: [LivreurAvisController],
  providers:   [LivreurAvisService],
})
export class LivreurAvisModule {}
