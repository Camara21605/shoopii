/* ============================================================
 * FICHIER : partenaire-parametres.module.ts
 *
 * MODULE des paramètres du dashboard partenaire.
 *
 * Assemble :
 *   - 1 controller  : PartenaireParametresController (17 endpoints)
 *   - 4 services    : Profil, Sécurité, Notifs, Danger
 *   - 2 entités     : Partner + User (via TypeOrmModule.forFeature)
 *   - 1 module ext. : UploadModule (Cloudinary pour photo de profil)
 *
 * À importer dans : PartenaireDashboardModule
 * ============================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

/* ── Entités ── */
import { Partner } from 'src/database/entities/profiles/partenaire-profile.entity';
import { User }    from 'src/database/entities/user.entity';

/* ── Module Cloudinary ── */
import { UploadModule } from 'src/modules/upload/upload.module';

/* ── Controller ── */
import { PartenaireParametresController } from './partenaire-parametres.controller';

/* ── Services (1 par domaine fonctionnel) ── */
import { ProfilPartenaireService }   from './services/profil-partenaire.service';
import { SecuritePartenaireService } from './services/securite-partenaire.service';
import { NotifsPartenaireService }   from './services/notifs-partenaire.service';
import { DangerPartenaireService }   from './services/danger-partenaire.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Partner, // table partenaires
      User,    // pour bcrypt (changement de mot de passe)
    ]),
    UploadModule, // Cloudinary (photo de profil)
  ],

  controllers: [
    PartenaireParametresController,
  ],

  providers: [
    ProfilPartenaireService,   // profil + localisation + photo
    SecuritePartenaireService, // mot de passe + 2FA
    NotifsPartenaireService,   // notifications + confidentialité + préférences
    DangerPartenaireService,   // pause + désactivation + suppression
  ],

  exports: [
    ProfilPartenaireService, // exporté pour la topbar (getAvatarInfo)
  ],
})
export class PartenaireParametresModule {}
