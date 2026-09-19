/* ================================================================
 * FICHIER : src/modules/validation-config/validation-config.controller.ts
 *
 * Routes  : /api/validation-config/*
 * Guard   : JwtAuthGuard (JWT obligatoire sur toutes les routes)
 *
 * SÉCURITÉ :
 *   - getStats() extrait userId depuis req.user.id (JWT),
 *     jamais depuis les query params.
 *   - Les stats ne retournent que les acteurs de l'admin connecté.
 * ================================================================ */

import {
  Controller, Get, Put, Body, Request,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';

import { JwtAuthGuard }              from '../../common/guards/auth.guard';
import { RolesGuard }                from '../../common/guards/roles.guard';
import { Roles }                     from '../../common/decorators/roles.decorator';
import { UserRole }                  from '../../common/enums/user-role.enum';
import { ValidationConfigService }    from './validation-config.service';
import { UpdateValidationConfigDto }  from './validation-config.dto';

/* SÉCURITÉ — jusqu'ici JwtAuthGuard seul : n'importe quel utilisateur connecté (un simple
 * client) pouvait lire ET modifier (PUT) cette configuration commune à toute la plateforme.
 * Réservé aux administrateurs. */
@Controller('validation-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class ValidationConfigController {

  constructor(private readonly svc: ValidationConfigService) {}

  /* ──────────────────────────────────────────────────────────
   * GET /api/validation-config
   * Configuration globale du moteur de validation.
   * ────────────────────────────────────────────────────────── */
  @Get()
  getConfig() {
    return this.svc.getConfig();
  }

  /* ──────────────────────────────────────────────────────────
   * PUT /api/validation-config
   * Met à jour la configuration (champs fournis uniquement).
   * ────────────────────────────────────────────────────────── */
  @Put()
  @HttpCode(HttpStatus.OK)
  updateConfig(@Body() dto: UpdateValidationConfigDto) {
    return this.svc.updateConfig(dto);
  }

  /* ──────────────────────────────────────────────────────────
   * GET /api/validation-config/stats
   * Statistiques scopées à l'admin connecté :
   * uniquement ses propres acteurs (partenaires, entreprises,
   * livreurs, correspondants liés à cet admin).
   * ────────────────────────────────────────────────────────── */
  @Get('stats')
  getStats(@Request() req: { user: { id: string } }) {
    return this.svc.getStats(req.user.id);
  }
}
