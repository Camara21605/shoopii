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
import { ValidationConfigService }    from './validation-config.service';
import { UpdateValidationConfigDto }  from './validation-config.dto';

@Controller('validation-config')
@UseGuards(JwtAuthGuard)
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
