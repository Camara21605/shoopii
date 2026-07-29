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
import { PlatformSettings }     from '../../../database/entities/platform-settings.entity';
import { PaiementDistribution } from '../../../database/entities/paiement/paiement-distribution.entity';
import { Commande }             from '../../../database/entities/commande/commande.entity';
import { CommandeCode }         from '../../../database/entities/commande/commande-code.entity';
import { Company }              from '../../../database/entities/profiles/entreprise-profile.entity';
import { Client }               from '../../../database/entities/profiles/client-profile.entity';
import { Delivery }             from '../../../database/entities/profiles/livreur-profile.entity';

/* ── Controllers ── */
import { CorrespondantParametresController } from './correspondant-parametres.controller';
import { CorrespondantDashboardController }  from './correspondant-dashboard.controller';

/* ── Service dashboard ── */
import { CorrespondantDashboardService }     from './correspondant-dashboard.service';

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
import { ColisManagementService }      from './services/colis-management.service';
import { BoutiquesManagementService }  from './services/boutiques-management.service';
import { LivreursManagementService }   from './services/livreurs-management.service';
import { ClientsManagementService }    from './services/clients-management.service';
import { ZoneManagementService }       from './services/zone-management.service';
import { OverviewAggregateService }    from './services/overview-aggregate.service';

/* ── Module upload Cloudinary ── */
import { UploadModule }     from '../../upload/upload.module';
import { MessagerieModule } from '../../messagerie/messagerie.module';

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
      PlatformSettings,
      PaiementDistribution,
      Commande,
      CommandeCode,
      Company,
      Client,
      Delivery,
    ]),

    /* Module Cloudinary pour les uploads photo et documents */
    UploadModule,

    /* PresenceService (statut en ligne des livreurs) */
    MessagerieModule,
  ],

  controllers: [
    CorrespondantParametresController,
    CorrespondantDashboardController,
  ],

  providers: [
    CorrespondantDashboardService,

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

    ColisManagementService,     // Liste des colis (commandes) du correspondant
    BoutiquesManagementService, // Boutiques réellement traitées par ce correspondant
    LivreursManagementService,  // Livreurs réellement approvisionnés par ce correspondant
    ClientsManagementService,   // Clients servis via ce correspondant
    ZoneManagementService,      // Statistiques par commune
    OverviewAggregateService,   // Vue d'ensemble (compose les services ci-dessus)
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