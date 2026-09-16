/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/livreur-dashboard.controller.ts
 *
 * RÔLE : Endpoints stats & overview du dashboard livreur.
 *   GET /dashboard/livreur/stats    → stats globales (missions, gains, note)
 *   GET /dashboard/livreur/missions → missions actives / récentes
 * ============================================================ */

import { Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard }                        from 'src/common/guards/auth.guard';
import { LivreurDashboardService }          from './livreur-dashboard.service';
import { BoutiquesManagementService }       from './services/boutiques-management.service';

@UseGuards(JwtAuthGuard)
@Controller('dashboard/livreur')
export class LivreurDashboardController {

  constructor(
    private readonly dashboardService: LivreurDashboardService,
    private readonly boutiquesService: BoutiquesManagementService,
  ) {}

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

  /** Missions diffusées par l'entreprise, pas encore acceptées — voir
   *  "Diffuser une mission" côté LivreursPage.tsx (entreprise). */
  @Get('missions/disponibles')
  getMissionsDisponibles(@Req() req: any) {
    return this.dashboardService.getMissionsDisponibles(req.user.id);
  }

  /** Accepte une mission diffusée — premier arrivé, premier servi. */
  @Patch('missions/:id/accepter')
  accepterMission(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.dashboardService.accepterMission(id, req.user.id);
  }

  /** 15 notifications récentes (activité du jour) */
  @Get('activite')
  getActivite(@Req() req: any) {
    return this.dashboardService.getActivite(req.user.id);
  }

  /** Taux de commission + revenus réels depuis les distributions */
  @Get('revenus')
  getRevenus(@Req() req: any) {
    return this.dashboardService.getRevenus(req.user.id);
  }

  /** Revenus réels groupés par jour, pour le graphique du dashboard */
  @Get('revenus/chart')
  getRevenusChart(@Req() req: any, @Query('period') period?: 'semaine' | 'mois') {
    return this.dashboardService.getRevenusChart(req.user.id, period === 'mois' ? 'mois' : 'semaine');
  }

  /** Boutiques avec lesquelles CE livreur a réellement effectué des livraisons */
  @Get('boutiques')
  getBoutiques(@Req() req: any) {
    return this.boutiquesService.getBoutiques(req.user.id);
  }
}