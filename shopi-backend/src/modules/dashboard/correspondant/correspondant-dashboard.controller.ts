/* ============================================================
 * FICHIER : correspondant-dashboard.controller.ts
 *
 * RÔLE : Endpoints du dashboard correspondant — toutes les
 * données renvoyées sont scopées à CE correspondant (req.user.id),
 * jamais aux autres points relais.
 * ============================================================ */

import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard }                     from 'src/common/guards/auth.guard';
import { CorrespondantDashboardService }    from './correspondant-dashboard.service';
import { ColisManagementService }           from './services/colis-management.service';
import { BoutiquesManagementService }       from './services/boutiques-management.service';
import { LivreursManagementService }        from './services/livreurs-management.service';
import { ClientsManagementService }         from './services/clients-management.service';
import { ZoneManagementService }            from './services/zone-management.service';
import { OverviewAggregateService }         from './services/overview-aggregate.service';

@UseGuards(JwtAuthGuard)
@Controller('dashboard/correspondant')
export class CorrespondantDashboardController {

  constructor(
    private readonly dashboardService: CorrespondantDashboardService,
    private readonly colisService:     ColisManagementService,
    private readonly boutiquesService: BoutiquesManagementService,
    private readonly livreursService:  LivreursManagementService,
    private readonly clientsService:   ClientsManagementService,
    private readonly zoneService:      ZoneManagementService,
    private readonly overviewService:  OverviewAggregateService,
  ) {}

  /** Taux de commission + revenus réels depuis les distributions, + graphe */
  @Get('revenus')
  getRevenus(@Req() req: any) {
    return this.dashboardService.getRevenus(req.user.id);
  }

  /**
   * Colis (commandes) dans lesquels CE correspondant est impliqué —
   * jamais les commandes des autres points relais.
   */
  @Get('colis')
  getColis(@Req() req: any) {
    return this.colisService.getColis(req.user.id);
  }

  /** Boutiques avec lesquelles CE correspondant a réellement traité des colis */
  @Get('boutiques')
  getBoutiques(@Req() req: any) {
    return this.boutiquesService.getBoutiques(req.user.id);
  }

  /** Livreurs auxquels CE correspondant a réellement remis des colis */
  @Get('livreurs')
  getLivreurs(@Req() req: any) {
    return this.livreursService.getLivreurs(req.user.id);
  }

  /** Clients dont au moins une commande est passée par CE correspondant */
  @Get('clients')
  getClients(@Req() req: any) {
    return this.clientsService.getClients(req.user.id);
  }

  /** Statistiques par commune, dérivées des commandes de CE correspondant */
  @Get('zone')
  getZone(@Req() req: any) {
    return this.zoneService.getZone(req.user.id);
  }

  /** Vue d'ensemble — KPIs, flux de relais, activité récente, colis urgent */
  @Get('overview')
  getOverview(@Req() req: any) {
    return this.overviewService.getOverview(req.user.id);
  }

  /** Note moyenne + total missions (colonnes réelles, futur système d'avis) */
  @Get('evaluation')
  getEvaluation(@Req() req: any) {
    return this.overviewService.getEvaluation(req.user.id);
  }
}
