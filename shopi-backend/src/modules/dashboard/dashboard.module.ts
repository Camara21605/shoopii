/* ============================================================
 * FICHIER  : src/modules/dashboard/dashboard.module.ts
 * ============================================================ */

import { Module } from '@nestjs/common';

import { SuperAdminModule }              from './super-admin/super-admin.module';
import { EntrepriseDashboardModule }     from './entreprise/entreprise-dashboard.module';
import { LivreurDashboardModule }        from './livreur/livreur-dashboard.module';
import { CorrespondantParametresModule } from './correspondant/correspondant-parametres.module';
import { ClientModule }                  from './client/client.module'; // ✅ AJOUTÉ

// import { AdministrateurDashboardModule } from './administrateur/administrateur-dashboard.module';
// import { PartenaireDashboardModule }     from './partenaire/partenaire-dashboard.module';

import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    SuperAdminModule,
    EntrepriseDashboardModule,
    LivreurDashboardModule,
    CorrespondantParametresModule,
    ClientModule,                  // ✅ AJOUTÉ — active toutes les routes /client/parametres
  ],

  controllers: [
    DashboardController,
  ],

  providers: [],

  exports: [
    SuperAdminModule,
    EntrepriseDashboardModule,
    LivreurDashboardModule,
    CorrespondantParametresModule,
    ClientModule,                  // ✅ AJOUTÉ
  ],
})
export class DashboardModule {}