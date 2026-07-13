/* ================================================================
 * FICHIER : src/modules/appearance/appearance.controller.ts
 *
 * Routes exposées sous /api/appearance :
 *
 *   GET  /api/appearance        → charger (ou créer) les prefs
 *   PUT  /api/appearance        → sauvegarder toutes les prefs
 *   POST /api/appearance/reset  → remettre les valeurs par défaut
 *
 * Sécurité : toutes les routes exigent un JWT valide (@UseGuards).
 *            Chaque opération est scopée à l'utilisateur connecté
 *            via req.user.id — jamais d'accès inter-utilisateurs.
 * ================================================================ */

import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard }      from '../../common/guards/auth.guard';
import { AppearanceService } from './appearance.service';

@Controller('appearance')
@UseGuards(JwtAuthGuard) /* JWT obligatoire sur toutes les routes */
export class AppearanceController {

  constructor(private readonly appearanceService: AppearanceService) {}

  /**
   * GET /api/appearance
   * Retourne les préférences de l'utilisateur connecté.
   * Si aucune ligne n'existe, elle est créée avec les valeurs par défaut.
   */
  @Get()
  getPrefs(@Request() req: any) {
    return this.appearanceService.getOrCreate(req.user.id);
  }

  /**
   * PUT /api/appearance
   * Sauvegarde tout ou partie des préférences.
   * Body : { theme?, accentColor?, fontFamily?, fontScale?,
   *          density?, borderRadius?, sidebarCollapsed?,
   *          animationsEnabled?, highContrast?, reduceMotion? }
   */
  @Put()
  updatePrefs(
    @Body() dto: Record<string, unknown>,
    @Request() req: any,
  ) {
    return this.appearanceService.update(req.user.id, dto as any);
  }

  /**
   * POST /api/appearance/reset
   * Remet toutes les préférences aux valeurs par défaut du design system.
   */
  @Post('reset')
  resetPrefs(@Request() req: any) {
    return this.appearanceService.reset(req.user.id);
  }
}
