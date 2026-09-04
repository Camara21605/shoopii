/* ============================================================
 * FICHIER : partenaire-dashboard.module.ts
 * MODULE  : Dashboard partenaire (données réelles)
 * ============================================================ */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PartenaireParametresModule } from './partenaire-parametres.module';

import { Partner }              from '../../../database/entities/profiles/partenaire-profile.entity';
import { Company }              from '../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }             from '../../../database/entities/profiles/livreur-profile.entity';
import { Correspondent }        from '../../../database/entities/profiles/correspondant-profile.entity';
import { CreationCode }         from '../../../database/entities/code-creation.entity';
import { PaiementDistribution } from '../../../database/entities/paiement/paiement-distribution.entity';
import { Wallet }               from '../../../database/entities/wallet.entity';
import { Report }               from '../../../database/entities/report.entity';
import { PlatformSettings }     from '../../../database/entities/platform-settings.entity';
import { Commande }             from '../../../database/entities/commande/commande.entity';
import { User }                 from '../../../database/entities/user.entity';
import { PartnerSetting }       from '../../partner-settings/partner-settings.entity';
import { CommissionModule }     from '../../commission/commission.module';

import { PartenaireDashboardService }    from './partenaire-dashboard.service';
import { PartenaireDashboardController } from './partenaire-dashboard.controller';

@Module({
  imports: [
    PartenaireParametresModule,
    /* CommissionCalculatorService.resoudreTauxPartenaireProduit() — voir
     * getCommissions() : le taux "Sur ventes entreprises" affiché doit être
     * calculé exactement comme le fait le CommissionEngine, pas une
     * approximation séparée qui pourrait diverger. */
    CommissionModule,
    TypeOrmModule.forFeature([
      Partner,
      Company,
      Delivery,
      Correspondent,
      CreationCode,
      PaiementDistribution,
      Wallet,
      Report,
      PlatformSettings,
      Commande,
      User,
      PartnerSetting,
    ]),
  ],
  controllers: [PartenaireDashboardController],
  providers:   [PartenaireDashboardService],
  exports:     [PartenaireParametresModule],
})
export class PartenaireDashboardModule {}
