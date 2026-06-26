/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/livreur-dashboard.controller.ts
 *
 * RÔLE : Endpoints stats & overview du dashboard livreur.
 *   GET /dashboard/livreur/stats    → stats globales (missions, gains, note)
 *   GET /dashboard/livreur/missions → missions actives / récentes
 * ============================================================ */

import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard }                        from 'src/common/guards/auth.guard';
import { LivreurDashboardService }          from './livreur-dashboard.service';

@UseGuards(JwtAuthGuard)
@Controller('dashboard/livreur')
export class LivreurDashboardController {

  constructor(private readonly dashboardService: LivreurDashboardService) {}

  /** Stats globales du livreur connecté */
  @Get('stats')
  getStats(@Req() req: any) {
    return this.dashboardService.getStats(req.user.id);
  }

  /** Missions actives + récentes */
  @Get('missions')
  getMissions(@Req() req: any) {
    return this.dashboardService.getMissions(req.user.id);
  }
}