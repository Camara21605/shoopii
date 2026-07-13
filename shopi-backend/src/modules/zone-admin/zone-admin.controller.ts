/* ================================================================
 * FICHIER : src/modules/zone-admin/zone-admin.controller.ts
 *
 * Routes  : /api/zones/*
 * Guard   : JwtAuthGuard (JWT obligatoire sur toutes les routes)
 *
 * SÉCURITÉ : Toutes les routes extraient userId depuis req.user.id
 *            — jamais depuis les paramètres de requête — pour
 *            garantir qu'un admin ne peut voir que sa propre zone.
 * ================================================================ */

import {
  Controller, Get, Patch, Body,
  Request, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';

import { JwtAuthGuard }             from '../../common/guards/auth.guard';
import { ZoneAdminService }          from './zone-admin.service';
import { UpdateAlertPreferencesDto } from './zone-admin.dto';

@Controller('zones')
@UseGuards(JwtAuthGuard)
export class ZoneAdminController {

  constructor(private readonly zoneService: ZoneAdminService) {}

  /* ──────────────────────────────────────────────────────────────
   * GET /api/zones/me
   * Identité complète de la zone de l'admin connecté.
   * ────────────────────────────────────────────────────────────── */
  @Get('me')
  getMyZone(@Request() req: { user: { id: string } }) {
    return this.zoneService.getMyZone(req.user.id);
  }

  /* ──────────────────────────────────────────────────────────────
   * GET /api/zones/statistiques
   * KPIs agrégés de la zone.
   * ────────────────────────────────────────────────────────────── */
  @Get('statistiques')
  getStatistiques(@Request() req: { user: { id: string } }) {
    return this.zoneService.getStatistiques(req.user.id);
  }

  /* ──────────────────────────────────────────────────────────────
   * GET /api/zones/acteurs
   * Décompte des acteurs par type.
   * ────────────────────────────────────────────────────────────── */
  @Get('acteurs')
  getActeurs(@Request() req: { user: { id: string } }) {
    return this.zoneService.getActeurs(req.user.id);
  }

  /* ──────────────────────────────────────────────────────────────
   * GET /api/zones/couverture
   * Taux de couverture par commune.
   * ────────────────────────────────────────────────────────────── */
  @Get('couverture')
  getCouverture(@Request() req: { user: { id: string } }) {
    return this.zoneService.getCouverture(req.user.id);
  }

  /* ──────────────────────────────────────────────────────────────
   * GET /api/zones/preferences
   * Lit les préférences d'alertes sauvegardées.
   * ────────────────────────────────────────────────────────────── */
  @Get('preferences')
  getPreferences(@Request() req: { user: { id: string } }) {
    return this.zoneService.getPreferences(req.user.id);
  }

  /* ──────────────────────────────────────────────────────────────
   * PATCH /api/zones/preferences
   * Sauvegarde les préférences d'alertes.
   * ────────────────────────────────────────────────────────────── */
  @Patch('preferences')
  @HttpCode(HttpStatus.OK)
  updatePreferences(
    @Request() req: { user: { id: string } },
    @Body() dto: UpdateAlertPreferencesDto,
  ) {
    return this.zoneService.updatePreferences(req.user.id, dto);
  }
}
