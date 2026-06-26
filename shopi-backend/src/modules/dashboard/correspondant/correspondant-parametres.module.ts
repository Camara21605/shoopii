/* ============================================================
 * FICHIER : correspondant-parametres.module.ts
 *
 * Module unique qui regroupe et expose :
 *   - Les entités TypeORM nécessaires (3 tables)
 *   - Les 11 services (1 par section des paramètres)
 *   - Le controller unique qui orchestre les 11 services
 *   - Le module d'upload Cloudinary
 *
 * Structure des services :
 *   ProfilService          → §1  Profil & Identité
 *   DepotService           → §2  Point de dépôt
 *   ZoneService            → §3  Zone & Horaires
 *   EntitesService         → §4  Entités partenaires
 *   ColisService           → §5  Gestion des colis
 *   PaiementService        → §6  Paiement & Commissions
 *   DocumentsService       → §7  Documents & Vérification
 *   SecuriteService        → §8  Sécurité
 *   NotificationsService   → §9  Notifications
 *   ConfidentialiteService → §10 Confidentialité
 *   DangerService          → §11 Zone sensible
 *
 * Pour ajouter ce module à votre application :
 *   → Importer CorrespondantParametresModule dans DashboardModule
 * ============================================================ */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

/* ── Entités TypeORM ── */
import { Correspondent }        from '../../../database/entities/profiles/correspondant-profile.entity';
import { CorrespondantHoraire } from '../../../database/entities/profiles/correspondant-horaire.entity';
import { User }                 from '../../../database/entities/user.entity';

/* ── Controller ── */
import { CorrespondantParametresController } from './correspondant-parametres.controller';

/* ── 11 Services ── */
import { ProfilService }          from './services/profil.service';
import { DepotService }           from './services/depot.service';
import { ZoneService }            from './services/zone.service';
import { EntitesService }         from './services/entites.service';
import { ColisService }           from './services/colis.service';
import { PaiementService }        from './services/paiement.service';
import { DocumentsService }       from './services/documents.service';
import { SecuriteService }        from './services/securite.service';
import { NotificationsService }   from './services/notifications.service';
import { ConfidentialiteService } from './services/confidentialite.service';
import { DangerService }          from './services/danger.service';

/* ── Module upload Cloudinary ── */
import { UploadModule } from '../../upload/upload.module';

@Module({
  imports: [
    /*
     * TypeORM — enregistrement des 3 entités nécessaires :
     *   - Correspondent     → table correspondants
     *   - CorrespondantHoraire → table correspondant_horaires
     *   - User              → table users (pour firstName/lastName/email…)
     */
    TypeOrmModule.forFeature([
      Correspondent,
      CorrespondantHoraire,
      User,
    ]),

    /* Module Cloudinary pour les uploads photo et documents */
    UploadModule,
  ],

  controllers: [
    CorrespondantParametresController,
  ],

  providers: [
    /* ── Les 11 services, 1 par section ── */
    ProfilService,          // §1  — Profil & Identité
    DepotService,           // §2  — Point de dépôt
    ZoneService,            // §3  — Zone & Horaires
    EntitesService,         // §4  — Entités partenaires
    ColisService,           // §5  — Gestion des colis
    PaiementService,        // §6  — Paiement & Commissions
    DocumentsService,       // §7  — Documents & Vérification
    SecuriteService,        // §8  — Sécurité
    NotificationsService,   // §9  — Notifications
    ConfidentialiteService, // §10 — Confidentialité
    DangerService,          // §11 — Zone sensible
  ],

  /*
   * Exports : seul ProfilService est exporté car d'autres modules
   * (ex: DashboardService) peuvent avoir besoin de getParametres().
   * Les autres services sont internes à ce module.
   */
  exports: [
    ProfilService,
  ],
})
export class CorrespondantParametresModule {}