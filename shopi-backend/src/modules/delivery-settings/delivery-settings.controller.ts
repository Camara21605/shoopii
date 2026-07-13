/* ============================================================
 * FICHIER : src/modules/delivery-settings/delivery-settings.controller.ts
 * ============================================================ */

import {
  Controller, Get, Put, Body,
  UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard }           from '../../common/guards/auth.guard';
import { DeliverySettingsService } from './delivery-settings.service';
import { UpdateDeliverySettingsDto } from './delivery-settings.dto';

@Controller('delivery-settings')
@UseGuards(JwtAuthGuard)
export class DeliverySettingsController {

  constructor(private readonly svc: DeliverySettingsService) {}

  @Get()
  getSettings() {
    return this.svc.getSettings();
  }

  @Put()
  updateSettings(@Body() dto: UpdateDeliverySettingsDto) {
    return this.svc.updateSettings(dto);
  }

  @Get('stats')
  getStats(@Request() req: { user: { id: string } }) {
    return this.svc.getStats(req.user.id);
  }
}
