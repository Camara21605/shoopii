/* ============================================================
 * FICHIER : src/modules/commande/commande.module.ts
 * RÔLE    : Module de la chaîne de validation des commandes.
 * ============================================================ */

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule }  from '../notifications/notifications.module';
import { DeliveryGroupModule }  from '../delivery-group/delivery-group.module';
import { PaiementModule }       from '../paiement/paiement.module';
import { CompanyTeamModule }    from '../company-team/company-team.module';

import { Commande } from '../../database/entities/commande/commande.entity';
import { CommandeItem } from '../../database/entities/commande/commande-item.entity';
import { CommandeCode } from '../../database/entities/commande/commande-code.entity';
import { PanierItem } from '../../database/entities/panier-item.entity';
import { Product } from '../../database/entities/entreprise.table/product.entity';
import { User } from '../../database/entities/user.entity';
import { Client } from '../../database/entities/profiles/client-profile.entity';
import { Company } from '../../database/entities/profiles/entreprise-profile.entity';
import { Delivery } from '../../database/entities/profiles/livreur-profile.entity';
import { Correspondent } from '../../database/entities/profiles/correspondant-profile.entity';
import { CompanyAvis }   from '../../database/entities/entreprise.table/company-avis.entity';
import { PlatformSettings } from '../../database/entities/platform-settings.entity';
import { Localisation } from '../../database/entities/localisation.entity';

import {
  ClientCommandeController, CommandeController, EntrepriseCommandeController,
  LivreurMissionsController, LivreurHistoriqueController, LivreurEnCoursController,
} from './commande.controller';
import { CommandeCreationService } from './services/commande-creation.service';
import { CommandeQueryService } from './services/commande-query.service';
import { CommandeValidationService } from './services/commande-validation.service';
import { CommandeFeedbackService } from './services/commande-feedback.service';
import { CommandeLivreurAssignmentService } from './services/commande-livreur-assignment.service';
import { CommandeScheduler } from './commande.scheduler';

@Module({
  imports: [
    NotificationsModule,
    DeliveryGroupModule,
    forwardRef(() => PaiementModule),
    /* Fournit TeamPermissionGuard — vérifie réellement les permissions
     * "Commandes" d'un collaborateur sur EntrepriseCommandeController
     * (voir @RequiresTeamPermission('orders', …)). */
    CompanyTeamModule,
    TypeOrmModule.forFeature([
      Commande,
      CommandeItem,
      CommandeCode,
      PanierItem,
      Product,
      User,
      Client,
      Company,
      Delivery,
      Correspondent,
      CompanyAvis,
      PlatformSettings,
      Localisation,
    ]),
  ],
  controllers: [
    ClientCommandeController,
    CommandeController,
    EntrepriseCommandeController,
    LivreurMissionsController,
    LivreurHistoriqueController,
    LivreurEnCoursController,
  ],
  providers: [
    CommandeCreationService,
    CommandeQueryService,
    CommandeValidationService,
    CommandeFeedbackService,
    CommandeLivreurAssignmentService,
    CommandeScheduler,
  ],
  exports: [
    CommandeCreationService,
    CommandeQueryService,
    CommandeValidationService,
    CommandeFeedbackService,
    CommandeLivreurAssignmentService,
  ],
})
export class CommandeModule {}
