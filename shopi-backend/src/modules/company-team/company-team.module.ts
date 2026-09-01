/* ============================================================
 * FICHIER      : src/modules/company-team/company-team.module.ts
 * MODULE       : Company Team
 * ROLE         : Module NestJS de gestion des équipes entreprise.
 *
 * FOURNIT :
 *   - CompanyTeamService              — lifecycle des membres
 *   - CompanyTeamPermissionService    — permissions des membres
 *   - CompanyTeamActivityService      — journal activité
 *   - CompanyTeamAuditService         — journal audit
 *   - CompanyTeamInvitationService    — invitations de collaborateurs
 *   - TeamPlanConfigService           — plans et limites dynamiques
 *   - TeamPermissionDefinitionService — schéma de permissions dynamique
 *   - TeamPermissionTemplateService   — modèles de permissions
 *   - API REST : /company-team/*
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../email/email.module';

/* ── Entités Phase 1 ── */
import { CompanyTeamMember }      from '../../database/entities/company-team/company-team-member.entity';
import { CompanyTeamPermission }  from '../../database/entities/company-team/company-team-permission.entity';
import { CompanyTeamActivityLog } from '../../database/entities/company-team/company-team-activity-log.entity';
import { CompanyTeamAuditLog }    from '../../database/entities/company-team/company-team-audit-log.entity';
import { User }                   from '../../database/entities/user.entity';
import { Wallet }                 from '../../database/entities/wallet.entity';
import { Company }                from '../../database/entities/profiles/entreprise-profile.entity';
import { PlatformSettings }       from '../../database/entities/platform-settings.entity';

/* ── Entités Phase 2 (Extensions) ── */
import { TeamPlanConfig }            from '../../database/entities/company-team/team-plan-config.entity';
import { CompanyPlanAssignment }     from '../../database/entities/company-team/company-plan-assignment.entity';
import { CompanyTeamInvitation }     from '../../database/entities/company-team/company-team-invitation.entity';
import { TeamPermissionCategory }    from '../../database/entities/company-team/team-permission-category.entity';
import { TeamPermissionDefinition }  from '../../database/entities/company-team/team-permission-definition.entity';
import { TeamPermissionTemplate }    from '../../database/entities/company-team/team-permission-template.entity';

/* ── Services Phase 1 ── */
import { CompanyTeamService }           from './services/company-team.service';
import { CompanyTeamPermissionService } from './services/company-team-permission.service';
import { CompanyTeamActivityService }   from './services/company-team-activity.service';
import { CompanyTeamAuditService }      from './services/company-team-audit.service';

/* ── Services Phase 2 ── */
import { TeamPlanConfigService }             from './services/team-plan-config.service';
import { CompanyTeamInvitationService }      from './services/company-team-invitation.service';
import { TeamPermissionDefinitionService }   from './services/team-permission-definition.service';
import { TeamPermissionTemplateService }     from './services/team-permission-template.service';
import { TeamEventBusService }               from './services/team-event-bus.service';

/* ── Controller ── */
import { CompanyTeamController } from './company-team.controller';

/* ── Guards ── */
import { TeamOwnerGuard }      from './guards/team-owner.guard';
import { TeamPermissionGuard } from './guards/team-permission.guard';

@Module({
  imports: [
    MailModule,
    TypeOrmModule.forFeature([
      /* Phase 1 */
      CompanyTeamMember,
      CompanyTeamPermission,
      CompanyTeamActivityLog,
      CompanyTeamAuditLog,
      User,
      Wallet,
      Company,
      PlatformSettings,
      /* Phase 2 */
      TeamPlanConfig,
      CompanyPlanAssignment,
      CompanyTeamInvitation,
      TeamPermissionCategory,
      TeamPermissionDefinition,
      TeamPermissionTemplate,
    ]),
  ],
  controllers: [CompanyTeamController],
  providers: [
    /* Phase 1 */
    CompanyTeamService,
    CompanyTeamPermissionService,
    CompanyTeamActivityService,
    CompanyTeamAuditService,
    /* Phase 2 */
    TeamEventBusService,
    TeamPlanConfigService,
    CompanyTeamInvitationService,
    TeamPermissionDefinitionService,
    TeamPermissionTemplateService,
    /* Guards */
    TeamOwnerGuard,
    TeamPermissionGuard,
  ],
  exports: [
    CompanyTeamService,
    CompanyTeamPermissionService,
    CompanyTeamActivityService,
    TeamPlanConfigService,
    TeamPermissionDefinitionService,
    /* Guard exporté — permet à n'importe quel autre module (dashboard
     * entreprise, produits, commandes…) d'importer CompanyTeamModule et
     * d'appliquer @RequiresTeamPermission sur ses propres routes. */
    TeamPermissionGuard,
  ],
})
export class CompanyTeamModule {}
