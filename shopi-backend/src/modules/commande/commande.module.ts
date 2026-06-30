/* ============================================================
 * FICHIER : src/modules/commande/commande.module.ts
 * RÔLE    : Module de la chaîne de validation des commandes.
 * ============================================================ */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

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

import {
  ClientCommandeController, CommandeController, EntrepriseCommandeController,
  LivreurMissionsController, LivreurHistoriqueController, LivreurEnCoursController,
} from './commande.controller';
import { CommandeCreationService } from './services/commande-creation.service';
import { CommandeQueryService } from './services/commande-query.service';
import { CommandeValidationService } from './services/commande-validation.service';
import { CommandeFeedbackService } from './services/commande-feedback.service';

@Module({
  imports: [
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
  ],
  exports: [
    CommandeCreationService,
    CommandeQueryService,
    CommandeValidationService,
    CommandeFeedbackService,
  ],
})
export class CommandeModule {}
