/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/parametres.module.ts
 *
 * RÔLE : Module NestJS qui assemble les 12 services paramètres
 *        + le controller unique + les entités nécessaires.
 *
 * CE MODULE EST IMPORTÉ DANS : entreprise.module.ts
 *
 * DÉPENDANCES EXTERNES INJECTÉES :
 *   - TypeORM : Company, User, CompanyHoraire
 *   - UploadModule : pour les uploads Cloudinary (logo, cover, docs)
 * ============================================================ */

import { Module }         from '@nestjs/common';
import { TypeOrmModule }  from '@nestjs/typeorm';

/* ── Entités TypeORM nécessaires ── */
import { Company }        from 'src/database/entities/profiles/entreprise-profile.entity';
import { User }           from 'src/database/entities/user.entity';
import { CompanyHoraire } from 'src/database/entities/entreprise.table/company-horaire.entity';

/* ── Module Upload (Cloudinary) ── */
import { UploadModule }   from 'src/modules/upload/upload.module';

/* ── Controller ── */
import { ParametresController } from './parametres.controller';

/* ── Les 12 services — un par section ── */
import { BoutiqueParametresService }   from './services/boutique-parametres.service';
import { HorairesParametresService }   from './services/horaires-parametres.service';
import { CatalogueParametresService }  from './services/catalogue-parametres.service';
import { LivraisonParametresService }  from './services/livraison-parametres.service';
import { PaiementParametresService }   from './services/paiement-parametres.service';
import { CommissionsParametresService } from './services/commissions-parametres.service';
import { DocumentsParametresService }  from './services/documents-parametres.service';
import { SecuriteParametresService }   from './services/securite-parametres.service';
import { NotifsParametresService }     from './services/notifs-parametres.service';
import { PrivacyParametresService }    from './services/privacy-parametres.service';
import { DangerParametresService }     from './services/danger-parametres.service';

@Module({
  imports: [
    /* Entités TypeORM dont les services ont besoin */
    TypeOrmModule.forFeature([
      Company,
      User,
      CompanyHoraire,
    ]),

    /* Module upload Cloudinary (logo, cover, documents) */
    UploadModule,
  ],

  controllers: [
    /* 1 seul controller qui regroupe tous les endpoints */
    ParametresController,
  ],

  providers: [
    /* ── 12 services — un par section ────────────────────── */
    BoutiqueParametresService,    // sections 1 + 2 (boutique + contact)
    HorairesParametresService,    // section 3 (horaires par jour)
    CatalogueParametresService,   // section 4 (règles publication)
    LivraisonParametresService,   // section 5 (méthodes + zones)
    PaiementParametresService,    // section 6 (paiement + facturation)
    CommissionsParametresService, // section 7 (plan de commissions)
    DocumentsParametresService,   // section 8 (documents + vérification)
    SecuriteParametresService,    // section 9 (password + 2FA)
    NotifsParametresService,      // section 10 (14 toggles notifs)
    PrivacyParametresService,     // section 11 (7 toggles privacy)
    DangerParametresService,      // section 12 (pause / suppression)
  ],

  exports: [
    /* Exporter les services au cas où entreprise.module en aurait besoin */
    BoutiqueParametresService,
    HorairesParametresService,
    SecuriteParametresService,
  ],
})
export class ParametresModule {}
