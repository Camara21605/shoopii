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
  Request, Body,
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

  constructor(
    private readonly utilisateursService:    UtilisateursService,
    private readonly platformSettingsService: PlatformSettingsService,
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

  @ApiOperation({
    summary:     'Récupérer la configuration plateforme',
    description: 'Retourne tous les paramètres globaux de Shopi Africa.',
  })
  @Get('settings')
  getSettings() {
    return this.platformSettingsService.getSettings();
  }

  @ApiOperation({
    summary:     'Modifier la configuration plateforme',
    description: 'Met à jour un ou plusieurs paramètres globaux. Seuls les champs fournis sont modifiés.',
  })
  @Patch('settings')
  updateSettings(@Body() dto: UpdatePlatformSettingsDto) {
    return this.platformSettingsService.updateSettings(dto);
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

  @ApiOperation({ summary: 'Purger le cache applicatif' })
  @Roles(UserRole.SUPER_ADMIN)
  @Post('maintenance/cache-purge')
  purgeCache() {
    return this.platformSettingsService.purgeCache();
  }
}