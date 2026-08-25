/* ============================================================
 * FICHIER : administrateur-dashboard.module.ts
 *
 * Module du dashboard administrateur de zone.
 *
 * Déclare toutes les entités TypeORM utilisées par les services
 * de domaine, enregistre chaque service dans le provider NestJS,
 * et expose uniquement la façade AdministrateurDashboardService
 * aux autres modules qui importent ce module.
 * ============================================================ */

import { Module }           from '@nestjs/common';
import { TypeOrmModule }    from '@nestjs/typeorm';
import { NotificationsModule } from '../../notifications/notifications.module';
import { MailModule }          from '../../email/email.module';
import { PerformanceModule }   from '../../performance-engine/performance.module';

// ── Entités ──────────────────────────────────────────────────
import { PlatformSettings }     from '../../../database/entities/platform-settings.entity';
import { PaiementDistribution } from '../../../database/entities/paiement/paiement-distribution.entity';
import { Admin }                from '../../../database/entities/profiles/admin-profile.entity';
import { Partner }              from '../../../database/entities/profiles/partenaire-profile.entity';
import { Company }              from '../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }             from '../../../database/entities/profiles/livreur-profile.entity';
import { Correspondent }        from '../../../database/entities/profiles/correspondant-profile.entity';
import { CreationCode }         from '../../../database/entities/code-creation.entity';
import { Report }               from '../../../database/entities/report.entity';
import { AuditLog }             from '../../../database/entities/audit-log.entity';
import { User }                 from '../../../database/entities/user.entity';
import { Commande }             from '../../../database/entities/commande/commande.entity';
import { Client }               from '../../../database/entities/profiles/client-profile.entity';

// ── Controller ───────────────────────────────────────────────
import { AdministrateurDashboardController } from './administrateur-dashboard.controller';

// ── Façade centrale ──────────────────────────────────────────
import { AdministrateurDashboardService }    from './administrateur-dashboard.service';

// ── Services de domaine ───────────────────────────────────────
import { AdminZoneService }          from './services/admin-zone.service';
import { AdminTauxService }          from './services/admin-taux.service';
import { AdminOverviewService }      from './services/admin-overview.service';
import { AdminCodesService }         from './services/admin-codes.service';
import { AdminActeursService }       from './services/admin-acteurs.service';
import { AdminPartenairesService }   from './services/admin-partenaires.service';
import { AdminSignalementsService }  from './services/admin-signalements.service';
import { AdminCommandesService }     from './services/admin-commandes.service';
import { AdminAuditService }         from './services/admin-audit.service';
import { AdminClientsService }       from './services/admin-clients.service';
import { AdminStatsService }         from './services/admin-stats.service';

/** Services de domaine — chacun gère un périmètre fonctionnel isolé. */
const DOMAIN_SERVICES = [
  AdminZoneService,          // fondation : adminOf + partnerIds/companyIds/deliveryIds
  AdminTauxService,          // taux de commission (PlatformSettings + PaiementDistribution)
  AdminOverviewService,      // vue d'ensemble + profil sidebar
  AdminCodesService,         // codes de création CRUD
  AdminActeursService,       // acteurs de la zone + validations
  AdminPartenairesService,   // liste et classement des partenaires
  AdminSignalementsService,  // signalements + résolution
  AdminCommandesService,     // commandes de la zone + graphe financier
  AdminAuditService,         // journal d'audit
  AdminClientsService,       // clients ayant commandé dans la zone (lecture seule)
  AdminStatsService,         // statistiques complémentaires (communes, litiges, rôles)
];

@Module({
  imports: [
    NotificationsModule,
    MailModule,
    PerformanceModule,
    TypeOrmModule.forFeature([
      PlatformSettings,
      PaiementDistribution,
      Admin,
      Partner,
      Company,
      Delivery,
      Correspondent,
      CreationCode,
      Report,
      AuditLog,
      User,
      Commande,
      Client,
    ]),
  ],
  controllers: [AdministrateurDashboardController],
  providers:   [...DOMAIN_SERVICES, AdministrateurDashboardService],
  exports:     [AdministrateurDashboardService],
})
export class AdministrateurDashboardModule {}
