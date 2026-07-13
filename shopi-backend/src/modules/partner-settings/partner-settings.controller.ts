/* ============================================================
 * FICHIER : src/modules/partner-settings/partner-settings.controller.ts
 * ============================================================ */

import {
  Controller, Get, Put, Body,
  UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard }              from '../../common/guards/auth.guard';
import { PartnerSettingsService }    from './partner-settings.service';
import { UpdatePartnerSettingsDto }  from './partner-settings.dto';

@Controller('partner-settings')
@UseGuards(JwtAuthGuard)
export class PartnerSettingsController {

  constructor(private readonly svc: PartnerSettingsService) {}

  @Get()
  getSettings() {
    return this.svc.getSettings();
  }

  @Put()
  updateSettings(@Body() dto: UpdatePartnerSettingsDto) {
    return this.svc.updateSettings(dto);
  }

  @Get('stats')
  getStats(@Request() req: { user: { id: string } }) {
    return this.svc.getStats(req.user.id);
  }
}
