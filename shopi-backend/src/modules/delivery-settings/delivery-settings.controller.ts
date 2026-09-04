/* ============================================================
 * FICHIER : src/modules/delivery-settings/delivery-settings.controller.ts
 *
 * SÉCURITÉ : config singleton (platformCommissionRate, règles de
 *            score/pénalité/bonus…) — n'avait AUCUNE restriction de
 *            rôle, n'importe quel utilisateur authentifié pouvait la
 *            réécrire pour TOUTE la plateforme. Restreint à ADMIN +
 *            SUPER_ADMIN (seuls consommateurs vérifiés :
 *            `LivreursSection.tsx` administrateur et le Centre de
 *            Commissions Super Admin).
 * ============================================================ */

import {
  Controller, Get, Put, Body,
  UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard }           from '../../common/guards/auth.guard';
import { RolesGuard }             from '../../common/guards/roles.guard';
import { Roles }                  from '../../common/decorators/roles.decorator';
import { UserRole }               from '../../common/enums/user-role.enum';
import { DeliverySettingsService } from './delivery-settings.service';
import { UpdateDeliverySettingsDto } from './delivery-settings.dto';

@Controller('delivery-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class DeliverySettingsController {

  constructor(private readonly svc: DeliverySettingsService) {}

  @Get()
  getSettings() {
    return this.svc.getSettings();
  }

  @Put()
  updateSettings(@Request() req: { user: { id: string } }, @Body() dto: UpdateDeliverySettingsDto) {
    return this.svc.updateSettings(dto, req.user.id);
  }

  @Get('stats')
  getStats(@Request() req: { user: { id: string } }) {
    return this.svc.getStats(req.user.id);
  }
}
