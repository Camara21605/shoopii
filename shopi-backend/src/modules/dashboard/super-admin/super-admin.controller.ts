/* ============================================================
 * FICHIER : src/modules/dashboard/super-admin/super-admin.controller.ts
 *
 * RÔLE    : Controller principal du dashboard Super Admin.
 *           Agrège toutes les routes des sous-controllers :
 *             - Utilisateurs  → /dashboard/super-admin/users/*
 *             - Catégories    → /categories/* et /sub-categories/*
 *             - Stats         → /dashboard/super-admin/stats
 *
 * GUARDS  : JWT + rôle SUPER_ADMIN ou ADMIN selon la route.
 *
 * PLACEMENT :
 *   src/modules/dashboard/super-admin/super-admin.controller.ts
 * ============================================================ */

import {
  Controller,
  Get, Patch, Post,
  UseGuards,
  Request, Body, Query, Param,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../common/guards/auth.guard';
import { RolesGuard }   from '../../../common/guards/roles.guard';
import { Roles }        from '../../../common/decorators/roles.decorator';
import { UserRole }     from '../../../common/enums/user-role.enum';

import { UtilisateursService }    from './services/utilisateurs.service';
import { PlatformSettingsService, UpdatePlatformSettingsDto } from './services/platform-settings.service';
import { ReportingEngine }        from '../../../modules/reporting-engine/reporting.engine';
import { CommissionHistoryService } from '../../commission/services/commission-history.service';

// ─────────────────────────────────────────────────────────────
// CONTROLLER PRINCIPAL
// Préfixe commun à toutes les routes du dashboard super-admin.
// Les sous-controllers (UtilisateursController, etc.)
// définissent leurs propres préfixes.
// ─────────────────────────────────────────────────────────────

@ApiTags('Dashboard — Super Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
@Controller('dashboard/super-admin')
export class SuperAdminController {

  private readonly logger = new Logger(SuperAdminController.name);

  constructor(
    private readonly utilisateursService:    UtilisateursService,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly reportingEngine:        ReportingEngine,
    private readonly commissionHistory:      CommissionHistoryService,
  ) {}

  // ══════════════════════════════════════════════════════════════
  // GET /dashboard/super-admin
  // Point de santé du dashboard — vérifie que le module répond
  // ══════════════════════════════════════════════════════════════

  @ApiOperation({
    summary:     'Santé du dashboard Super Admin',
    description: 'Retourne les infos de base du super-admin connecté.',
  })
  @Get()
  getInfo(@Request() req: any) {
    return {
      status:    'ok',
      dashboard: 'super-admin',
      user: {
        id:    req.user.id,
        email: req.user.email,
        role:  req.user.role,
      },
      timestamp: new Date().toISOString(),
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GET /dashboard/super-admin/overview
  // Statistiques globales de la plateforme
  // Appelé par : OverviewSection.tsx au montage
  // ══════════════════════════════════════════════════════════════

  @ApiOperation({
    summary:     'Statistiques globales plateforme',
    description: 'Retourne total users, répartition par rôle/statut/pays, nouveaux 30j.',
  })
  @Get('overview')
  getOverview(@Request() req: any) {
    return this.utilisateursService.getStats(req.user);
  }

  // ══════════════════════════════════════════════════════════════
  // GET  /dashboard/super-admin/settings
  // PATCH /dashboard/super-admin/settings
  // ══════════════════════════════════════════════════════════════

  /* SÉCURITÉ — cette route (comme PATCH ci-dessous) n'avait QUE le garde
   * de contrôleur @Roles(SUPER_ADMIN, ADMIN), alors que PlatformSettings
   * est explicitement documentée comme "Gérée exclusivement par le Super
   * Admin" (voir platform-settings.entity.ts) et que cette page se
   * présente elle-même comme le "Centre de contrôle total" de la
   * plateforme (maintenance, ratios de commission plateforme entière,
   * providers de paiement activés, seuils de sécurité JWT/rate-limit…).
   * N'importe quel ADMIN régional (zone territoriale) pouvait donc LIRE
   * l'intégralité de cette config (webhookUrl, analyticsTrackingId, seuils
   * de sécurité) — et, plus grave sur la route PATCH ci-dessous, la
   * MODIFIER entièrement, y compris activer le mode maintenance pour
   * TOUTE la plateforme ou changer les ratios de commission globaux.
   * Vérifié : aucun frontend du dashboard `administrateur` (régional)
   * n'appelle cette route — seul le dashboard `super-admin` le fait.
   * Même précédent déjà appliqué à POST .../maintenance/cache-purge
   * plus bas dans ce fichier. */
  @ApiOperation({
    summary:     'Récupérer la configuration plateforme',
    description: 'Retourne tous les paramètres globaux de Shopi.',
  })
  @Roles(UserRole.SUPER_ADMIN)
  @Get('settings')
  getSettings() {
    return this.platformSettingsService.getSettings();
  }

  @ApiOperation({
    summary:     'Modifier la configuration plateforme',
    description: 'Met à jour un ou plusieurs paramètres globaux. Seuls les champs fournis sont modifiés.',
  })
  @Roles(UserRole.SUPER_ADMIN)
  @Patch('settings')
  updateSettings(@Request() req: any, @Body() dto: UpdatePlatformSettingsDto) {
    return this.platformSettingsService.updateSettings(dto, req.user?.id);
  }

  // ══════════════════════════════════════════════════════════════
  // GET /dashboard/super-admin/commissions/history
  // Historique versionné des CommissionRule (Centre de Commissions)
  // ══════════════════════════════════════════════════════════════

  @ApiOperation({
    summary:     'Historique des taux de commission',
    description: 'Liste toutes les versions de CommissionRule (la plus récente en premier), avec le nombre de distributions ayant utilisé chacune.',
  })
  @Roles(UserRole.SUPER_ADMIN)
  @Get('commissions/history')
  getCommissionHistory() {
    return this.commissionHistory.historiqueRegles();
  }

  // ══════════════════════════════════════════════════════════════
  // GET /dashboard/super-admin/platform-stats
  // KPIs plateforme : produits, commandes, inscriptions 14j
  // ══════════════════════════════════════════════════════════════

  @ApiOperation({
    summary:     'Stats plateforme (produits, commandes, inscriptions)',
    description: 'Retourne les KPIs produits/commandes et la courbe des inscriptions 14j.',
  })
  @Get('platform-stats')
  async getPlatformStats(@Request() req: any) {
    const [stats, settings] = await Promise.all([
      this.utilisateursService.getPlatformStats(req.user),
      this.platformSettingsService.getSettings(),
    ]);
    return {
      ...stats,
      commission:     settings.platformCommission,
      maintenanceMode: settings.maintenanceMode,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // POST /dashboard/super-admin/maintenance/cache-purge
  // ══════════════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════════════
  // GET /dashboard/super-admin/finances
  // Dashboard financier global : KPIs, tendances, top acteurs
  // ══════════════════════════════════════════════════════════════

  @ApiOperation({
    summary:     'Dashboard financier super-admin',
    description: 'KPIs paiements/commissions/retraits/litiges + séries temporelles + top acteurs (30 derniers jours par défaut).',
  })
  @Get('finances')
  async getFinances() {
    try {
      return await this.reportingEngine.getSuperAdminDashboard();
    } catch (err) {
      this.logger.error('getSuperAdminDashboard failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException('Erreur lors du chargement du tableau de bord financier');
    }
  }

  // ══════════════════════════════════════════════════════════════
  // GET /dashboard/super-admin/finances/top-acteurs?type=entreprise|livreur|partenaire_produit&limit=10
  // GET /dashboard/super-admin/finances/acteur/:userId
  //
  // Terminé — AnalyticsService/StatisticsService avaient déjà ces calculs,
  // complets et corrects (agrégés depuis PaiementDistribution), mais
  // aucune route ne les exposait : code mort, jamais atteignable depuis
  // aucun dashboard. Voir ReportingEngine.getTopEntreprises/Livreurs/
  // Partenaires/getActeurStats.
  // ══════════════════════════════════════════════════════════════

  private static readonly TOP_ACTEURS_TYPES = ['entreprise', 'livreur', 'partenaire_produit'] as const;

  @ApiOperation({
    summary:     'Top acteurs par montant distribué',
    description: 'Classement des entreprises/livreurs/partenaires par montant total versé (30 derniers jours par défaut).',
  })
  @Get('finances/top-acteurs')
  async getTopActeurs(
    @Query('type')  type: string,
    @Query('limit') limitQuery?: string,
  ) {
    const limit = limitQuery ? Number(limitQuery) : 10;
    switch (type) {
      case 'entreprise':        return this.reportingEngine.getTopEntreprises(undefined, limit);
      case 'livreur':           return this.reportingEngine.getTopLivreurs(undefined, limit);
      case 'partenaire_produit':return this.reportingEngine.getTopPartenaires(undefined, limit);
      default:
        throw new BadRequestException(
          `type doit être une valeur parmi: ${SuperAdminController.TOP_ACTEURS_TYPES.join(', ')}`,
        );
    }
  }

  @ApiOperation({
    summary:     "Statistiques complètes d'un acteur",
    description: 'Revenus, commandes, retraits et solde wallet actuel pour un acteur donné (30 derniers jours par défaut).',
  })
  @Get('finances/acteur/:userId')
  async getActeurStats(@Param('userId') userId: string) {
    return this.reportingEngine.getActeurStats(userId);
  }

  @ApiOperation({ summary: 'Purger le cache applicatif' })
  @Roles(UserRole.SUPER_ADMIN)
  @Post('maintenance/cache-purge')
  purgeCache() {
    return this.platformSettingsService.purgeCache();
  }
}