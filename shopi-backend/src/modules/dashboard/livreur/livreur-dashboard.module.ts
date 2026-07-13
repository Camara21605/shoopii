/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/livreur-dashboard.module.ts
 *
 * RÔLE : Module complet du dashboard livreur.
 *        Regroupe TOUS les controllers et services liés
 *        à l'acteur "Livreur".
 *
 * SOUS-DOMAINES GÉRÉS :
 *   - Stats & métriques livreur      → LivreurDashboardService
 *   - Missions actives               → MissionsService (à créer)
 *   - Paramètres complets (10 sec.)  → LivreurParametresModule
 *
 * ROUTES ENREGISTRÉES :
 *   /dashboard/livreur/*             → LivreurDashboardController
 *   /dashboard/livreur/parametres/*  → LivreurParametresController
 *                                       (via LivreurParametresModule)
 *
 * IMPORT DANS :
 *   dashboard.module.ts  ← importe ce module
 * ============================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

/* ── Entités TypeORM directement utilisées par ce module ── */
import { Delivery }       from '../../../database/entities/profiles/livreur-profile.entity';
import { User }           from '../../../database/entities/user.entity';
import { LivreurHoraire } from '../../../database/entities/livreur.table/livreur-horaire.entity';
import { Commande }       from '../../../database/entities/commande/commande.entity';
import { Notification }   from '../../../database/entities/notification/notification.entitiy';

/* ── Module Paramètres (assemble les 8 services + controller) ── */
import { LivreurParametresModule } from './livreur-parametres.module';

/* ── Controller principal du dashboard ── */
import { LivreurDashboardController } from './livreur-dashboard.controller';

/* ── Service principal du dashboard ── */
import { LivreurDashboardService } from './livreur-dashboard.service';

@Module({
  imports: [
    /* Entités TypeORM utilisées directement par ce module */
    TypeOrmModule.forFeature([
      Delivery,
      User,
      LivreurHoraire,
      Commande,
      Notification,
    ]),

    /*
     * ✅ Module Paramètres — enregistre automatiquement :
     *   - LivreurParametresController
     *   - ProfilLivreurService, ZoneLivreurService,
     *     VitessesLivreurService, VehiculeLivreurService,
     *     PaiementLivreurService, SecuriteLivreurService,
     *     NotifsLivreurService, DangerLivreurService
     */
    LivreurParametresModule,
  ],

  controllers: [
    /* Controller stats/overview du dashboard livreur */
    LivreurDashboardController,
  ],

  providers: [
    /* Service stats/overview */
    LivreurDashboardService,
  ],

  exports: [
    LivreurDashboardService,
    LivreurParametresModule,
  ],
})
export class LivreurDashboardModule {}