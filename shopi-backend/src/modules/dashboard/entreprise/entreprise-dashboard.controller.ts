// ============================================================
// FICHIER  : src/modules/dashboard/entreprise/entreprise-dashboard.controller.ts
// RÔLE     : Endpoints du dashboard entreprise — toutes les
//            données renvoyées sont scopées à CETTE entreprise
//            (req.user.id), jamais aux autres boutiques.
//
// ROUTES :
//   GET  /dashboard/entreprise/overview        → KPIs, CA, top produits, alertes
//   GET  /dashboard/entreprise/analytics       → CA, top produits, perf catégories
//   GET  /dashboard/entreprise/finances        → solde, transactions, virements
//   GET  /dashboard/entreprise/commission-rate → taux de commission plateforme
// ============================================================

import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard }      from '../../../common/guards/auth.guard';
import { RolesGuard }        from '../../../common/guards/roles.guard';
import { Roles }             from '../../../common/decorators/roles.decorator';
import { UserRole }          from '../../../common/enums/user-role.enum';
import { PlatformSettings }  from '../../../database/entities/platform-settings.entity';
import { EntrepriseDashboardService } from './entreprise-dashboard.service';
import { TeamPermissionGuard }        from '../../company-team/guards/team-permission.guard';
import { RequiresTeamPermission }     from '../../company-team/decorators/requires-team-permission.decorator';

@ApiTags('Dashboard Entreprise')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY)
@Controller('dashboard/entreprise')
export class EntrepriseDashboardController {

  constructor(
    @InjectRepository(PlatformSettings)
    private readonly platformSettingsRepo: Repository<PlatformSettings>,

    private readonly dashboardService: EntrepriseDashboardService,
  ) {}

  /** Vue d'ensemble : KPIs, CA mensuel, top produits, alertes stock, activité */
  @ApiOperation({ summary: "Vue d'ensemble réelle du dashboard entreprise" })
  @ApiResponse({ status: 200, description: 'Aperçu retourné avec succès' })
  @Get('overview')
  async getOverview(@Request() req: any) {
    /* actorId (pas req.user.id) — déjà résolu au login vers le bon
     * Company.id pour le propriétaire COMME pour un collaborateur (voir
     * AuthService.findProfileId). Avec req.user.id, cette page restait
     * toujours vide pour tout collaborateur (resolveCompany() cherchait
     * Company.userId = req.user.id, qui n'existe que pour le propriétaire). */
    return this.dashboardService.getOverview(req.user.actorId);
  }

  /** Analytics : CA, top produits, performances par catégorie (données réelles uniquement) */
  @ApiOperation({ summary: 'Analytics réelles du dashboard entreprise' })
  @ApiResponse({ status: 200, description: 'Analytics retournées avec succès' })
  @Get('analytics')
  async getAnalytics(@Request() req: any) {
    return this.dashboardService.getAnalytics(req.user.actorId);
  }

  /** Finances : solde wallet, revenus/dépenses, transactions, virements —
   *  première catégorie de permissions réellement appliquée (Paiements +
   *  Portefeuille) : un collaborateur sans payments.view reçoit un 403
   *  plutôt que d'accéder aux données financières de la boutique quelles
   *  que soient ses permissions configurées (voir TeamPermissionGuard). */
  @ApiOperation({ summary: 'Finances réelles du dashboard entreprise' })
  @ApiResponse({ status: 200, description: 'Finances retournées avec succès' })
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('payments', 'view')
  @Get('finances')
  async getFinances(@Request() req: any) {
    return this.dashboardService.getFinances(req.user.actorId);
  }

  // ──────────────────────────────────────────────────────────
  // GET /dashboard/entreprise/commission-rate
  // Retourne le taux de commission actuel de la plateforme.
  // Utilisé par AjouterPage pour l'aperçu du revenu net.
  // ──────────────────────────────────────────────────────────
  @Get('commission-rate')
  async getCommissionRate() {
    let settings = await this.platformSettingsRepo.findOne({ where: { id: 1 } });

    /* Initialise la ligne avec les valeurs par défaut si elle n'existe pas encore */
    if (!settings) {
      settings = this.platformSettingsRepo.create({ id: 1 });
      settings = await this.platformSettingsRepo.save(settings);
    }

    const percentage = Number(settings.platformCommission);
    return {
      percentage,             // ex: 6  (affiché en %)
      rate: percentage / 100, // ex: 0.06 (utilisé pour les calculs)
    };
  }
}
