/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/livreur-parametres.module.ts
 *
 * MODULE des paramètres livreur.
 * Assemble les 8 services + 1 controller + entités TypeORM.
 *
 * À IMPORTER DANS : livreur.module.ts (ou livreur-dashboard.module.ts)
 *   imports: [LivreurParametresModule, ...]
 * ============================================================ */

import { Module }         from '@nestjs/common';
import { TypeOrmModule }  from '@nestjs/typeorm';

/* ── Entités ── */
import { Delivery }       from 'src/database/entities/profiles/livreur-profile.entity';
import { User }           from 'src/database/entities/user.entity';
import { LivreurHoraire } from 'src/database/entities/livreur.table/livreur-horaire.entity';

/* ── Module Upload Cloudinary ── */
import { UploadModule }   from 'src/modules/upload/upload.module';

/* ── Controller ── */
import { LivreurParametresController } from './livreur-parametres.controller';

/* ── Services (1 par section) ── */
import { ProfilLivreurService }   from './services/profil-livreur.service';
import { ZoneLivreurService }     from './services/zone-livreur.service';
import { VitessesLivreurService } from './services/vitesses-livreur.service';
import { VehiculeLivreurService } from './services/vehicule-livreur.service';
import { PaiementLivreurService } from './services/paiement-livreur.service';
import { SecuriteLivreurService } from './services/securite-livreur.service';
import { NotifsLivreurService }   from './services/notifs-livreur.service';
import { DangerLivreurService }   from './services/danger-livreur.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Delivery,       // table livreurs
      User,           // pour bcrypt (changement de mot de passe)
      LivreurHoraire, // table livreur_horaires
    ]),
    UploadModule, // Cloudinary (photo + documents)
  ],

  controllers: [
    LivreurParametresController, // 1 seul controller
  ],

  providers: [
    ProfilLivreurService,   // sections 1 + 2
    ZoneLivreurService,     // section 3
    VitessesLivreurService, // section 4
    VehiculeLivreurService, // section 5
    PaiementLivreurService, // section 6
    SecuriteLivreurService, // section 7
    NotifsLivreurService,   // sections 8 + 9
    DangerLivreurService,   // section 10
  ],

  exports: [
    ProfilLivreurService,
    ZoneLivreurService,
  ],
})
export class LivreurParametresModule {}