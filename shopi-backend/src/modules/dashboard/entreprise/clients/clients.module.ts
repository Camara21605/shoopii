/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/clients/clients.module.ts
 *
 * MODULE : Gestion de la liste clients de l'entreprise.
 *
 * ENTITÉS UTILISÉES :
 *   - Company    → identifier l'entreprise à partir du userId JWT
 *   - Client     → profils clients (totalOrders, totalSpent, createdAt)
 *   - Commande   → source n°1 : clients ayant acheté
 *   - Follow     → source n°2 : clients abonnés à la boutique
 *   - User       → nom, email, photo de profil
 * ============================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Company }   from 'src/database/entities/profiles/entreprise-profile.entity';
import { Client }    from 'src/database/entities/profiles/client-profile.entity';
import { Commande }  from 'src/database/entities/commande/commande.entity';
import { Follow }    from 'src/database/entities/follow/follow.entity';
import { User }      from 'src/database/entities/user.entity';

/* Actions CRM (newsletter/fidélité/relance) — voir CrmCampaignService,
 * qui passe par NotificationEventService pour ne jamais envoyer d'email
 * de façon synchrone dans la requête HTTP. */
import { NotificationsModule } from 'src/modules/notifications/notifications.module';

import { ClientsController } from './clients.controller';
import { ClientsService }    from './clients.service';
import { CrmCampaignService } from './crm-campaign.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,   // résoudre userId → company.id
      Client,    // profils clients
      Commande,  // historique achats
      Follow,    // abonnements boutique
      User,      // nom + email + photo
    ]),
    NotificationsModule,
  ],
  controllers: [ClientsController],
  providers:   [ClientsService, CrmCampaignService],
  exports:     [ClientsService],
})
export class ClientsModule {}
