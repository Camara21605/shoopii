/* ================================================================
 * FICHIER : src/modules/company-settings/company-settings.controller.ts
 *
 * Routes  : /api/company-settings/*
 * Guard   : JwtAuthGuard + RolesGuard (ADMIN, SUPER_ADMIN)
 *
 * SÉCURITÉ : cette config singleton (commissionType/Value/Min/Max,
 *            règles catégories…) n'avait AUCUNE restriction de rôle —
 *            n'importe quel utilisateur authentifié (client, livreur,
 *            partenaire…) pouvait lire ET RÉÉCRIRE la configuration de
 *            commission entreprises pour TOUTE la plateforme. Restreint
 *            au niveau contrôleur à ADMIN + SUPER_ADMIN : seul le
 *            dashboard administrateur de zone (`EntreprisesSection.tsx`)
 *            et le Centre de Commissions Super Admin consomment ces
 *            routes (vérifié — aucun autre frontend ne les appelle).
 *            getStats() extrait userId depuis req.user.id (JWT), jamais
 *            via query param.
 * ================================================================ */

import {
  Controller, Get, Put, Body, Request,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';

import { JwtAuthGuard }              from '../../common/guards/auth.guard';
import { RolesGuard }                from '../../common/guards/roles.guard';
import { Roles }                     from '../../common/decorators/roles.decorator';
import { UserRole }                  from '../../common/enums/user-role.enum';
import { CompanySettingsService }  from './company-settings.service';
import { UpdateCompanySettingsDto } from './company-settings.dto';

@Controller('company-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class CompanySettingsController {

  constructor(private readonly svc: CompanySettingsService) {}

  /* ── GET /api/company-settings ───────────────────────────── */
  @Get()
  getSettings() {
    return this.svc.getSettings();
  }

  /* ── PUT /api/company-settings ───────────────────────────── */
  @Put()
  @HttpCode(HttpStatus.OK)
  updateSettings(@Body() dto: UpdateCompanySettingsDto) {
    return this.svc.updateSettings(dto);
  }

  /* ── GET /api/company-settings/stats ─────────────────────── */
  @Get('stats')
  getStats(@Request() req: { user: { id: string } }) {
    return this.svc.getStats(req.user.id);
  }

  /* ── GET /api/company-settings/categories-list ───────────── */
  @Get('categories-list')
  getCategoriesList() {
    return this.svc.getCategoriesList();
  }
}
