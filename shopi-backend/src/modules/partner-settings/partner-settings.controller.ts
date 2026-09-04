/* ============================================================
 * FICHIER : src/modules/partner-settings/partner-settings.controller.ts
 *
 * SÉCURITÉ : config singleton (commissionMode/defaultCommissionRate/
 *            tiers) — n'avait AUCUNE restriction de rôle, n'importe
 *            quel utilisateur authentifié pouvait la réécrire pour
 *            TOUTE la plateforme. Restreint à ADMIN + SUPER_ADMIN
 *            (seuls consommateurs vérifiés : `PartenairesSection.tsx`
 *            administrateur et le Centre de Commissions Super Admin).
 * ============================================================ */

import {
  Controller, Get, Put, Body,
  UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard }              from '../../common/guards/auth.guard';
import { RolesGuard }                from '../../common/guards/roles.guard';
import { Roles }                     from '../../common/decorators/roles.decorator';
import { UserRole }                  from '../../common/enums/user-role.enum';
import { PartnerSettingsService }    from './partner-settings.service';
import { UpdatePartnerSettingsDto }  from './partner-settings.dto';

@Controller('partner-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
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
