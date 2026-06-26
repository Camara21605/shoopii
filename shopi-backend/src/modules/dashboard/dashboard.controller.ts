// ============================================================
// FICHIER  : src/modules/dashboard/dashboard.controller.ts
// RÔLE     : Routes communes à tous les dashboards.
//            Prefix : /dashboard
//
// ROUTES :
//   GET /dashboard/health    → santé du module
//   GET /dashboard/me        → retourne le dashboard selon le rôle JWT
// ============================================================

import { Controller, Get, Request, UseGuards } from '@nestjs/common';
// import { DashboardService } from './dashboard.service';
import { JwtAuthGuard }        from '../../common/guards/auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  // constructor(private readonly dashboardService: DashboardService) {}

  // GET /dashboard/health
  // Vérifie que le module est bien chargé (utilise en CI/CD)
  @ApiOperation({ summary: 'Santé du module dashboard' })
  @Get('health')
  health() {
    return { status: 'ok', module: 'DashboardModule', timestamp: new Date() };
  }

  // GET /dashboard/me
  // Renvoie le rôle actif + les métriques de base selon le JWT
  @ApiOperation({ summary: 'Dashboard selon le rôle JWT de l\'utilisateur' })
  @Get('me')
  async getMyDashboard(@Request() req: any) {
    // return this.dashboardService.getDashboardForUser(req.user);
  }
}