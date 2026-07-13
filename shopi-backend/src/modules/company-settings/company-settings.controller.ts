/* ================================================================
 * FICHIER : src/modules/company-settings/company-settings.controller.ts
 *
 * Routes  : /api/company-settings/*
 * Guard   : JwtAuthGuard
 *
 * SÉCURITÉ : getStats() et toutes les routes scopées extraient
 *            userId depuis req.user.id (JWT), jamais via query param.
 * ================================================================ */

import {
  Controller, Get, Put, Body, Request,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';

import { JwtAuthGuard }           from '../../common/guards/auth.guard';
import { CompanySettingsService }  from './company-settings.service';
import { UpdateCompanySettingsDto } from './company-settings.dto';

@Controller('company-settings')
@UseGuards(JwtAuthGuard)
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
