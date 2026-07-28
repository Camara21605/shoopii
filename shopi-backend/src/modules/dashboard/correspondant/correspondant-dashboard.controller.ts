/* ============================================================
 * FICHIER : correspondant-dashboard.controller.ts
 *
 * RÔLE : Endpoints overview du dashboard correspondant.
 *   GET /dashboard/correspondant/revenus
 * ============================================================ */

import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard }                     from 'src/common/guards/auth.guard';
import { CorrespondantDashboardService }    from './correspondant-dashboard.service';

@UseGuards(JwtAuthGuard)
@Controller('dashboard/correspondant')
export class CorrespondantDashboardController {

  constructor(private readonly dashboardService: CorrespondantDashboardService) {}

  /** Taux de commission + revenus réels depuis les distributions */
  @Get('revenus')
  getRevenus(@Req() req: any) {
    return this.dashboardService.getRevenus(req.user.id);
  }
}
