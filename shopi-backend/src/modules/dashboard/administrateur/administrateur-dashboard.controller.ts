/* ============================================================
 * FICHIER : administrateur-dashboard.controller.ts
 * RÔLE    : Endpoints du dashboard administrateur de zone.
 * ============================================================ */

import {
  Body, Controller, Delete, Get, Param, Patch, Post,
  Query, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/auth.guard';
import { AdministrateurDashboardService, GenerateCodeDto } from './administrateur-dashboard.service';

@UseGuards(JwtAuthGuard)
@Controller('dashboard/admin')
export class AdministrateurDashboardController {

  constructor(private readonly svc: AdministrateurDashboardService) {}

  // ── Taux (existant) ─────────────────────────────────────────
  @Get('taux')
  getTaux() { return this.svc.getTaux(); }

  // ── Profil admin (sidebar) ───────────────────────────────────
  @Get('me')
  getMe(@Request() req: any) { return this.svc.getAdminProfile(req.user.id); }

  // ── Overview ────────────────────────────────────────────────
  @Get('overview')
  getOverview(@Request() req: any) { return this.svc.getOverview(req.user.id); }

  // ── Finances ─────────────────────────────────────────────────
  @Get('finances')
  getFinances(@Request() req: any) { return this.svc.getFinances(req.user.id); }

  // ── Codes ───────────────────────────────────────────────────
  @Get('codes')
  getCodes(@Request() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.svc.getCodes(req.user.id, Number(page) || 1, Number(limit) || 20);
  }

  @Post('codes')
  generateCode(@Request() req: any, @Body() body: GenerateCodeDto) {
    return this.svc.generateCode(req.user.id, body);
  }

  @Delete('codes/:id')
  revokeCode(@Request() req: any, @Param('id') id: string) {
    return this.svc.revokeCode(req.user.id, id);
  }

  @Post('codes/:id/send-email')
  sendCodeByEmail(@Request() req: any, @Param('id') id: string) {
    return this.svc.sendCodeByEmail(req.user.id, id);
  }

  // ── Acteurs ─────────────────────────────────────────────────
  @Get('acteurs')
  getActeurs(
    @Request() req: any,
    @Query('role')   role?:   string,
    @Query('search') search?: string,
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
  ) {
    return this.svc.getActeurs(req.user.id, role, search, Number(page) || 1, Number(limit) || 20);
  }

  // ── Validations ─────────────────────────────────────────────
  @Get('validations')
  getValidations(@Request() req: any) { return this.svc.getValidations(req.user.id); }

  @Patch('validations/:id/approve')
  approveValidation(@Request() req: any, @Param('id') id: string) {
    return this.svc.approveValidation(req.user.id, id);
  }

  @Patch('validations/:id/reject')
  rejectValidation(@Request() req: any, @Param('id') id: string) {
    return this.svc.rejectValidation(req.user.id, id);
  }

  // ── Partenaires ─────────────────────────────────────────────
  @Get('partenaires')
  getPartenaires(
    @Request() req: any,
    @Query('tier')   tier?:   string,
    @Query('search') search?: string,
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
  ) {
    return this.svc.getPartenaires(req.user.id, tier, search, Number(page) || 1, Number(limit) || 20);
  }

  // ── Signalements ────────────────────────────────────────────
  @Get('signalements')
  getSignalements(@Request() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.svc.getSignalements(req.user.id, Number(page) || 1, Number(limit) || 20);
  }

  @Patch('signalements/:id/resolve')
  resolveSignalement(@Request() req: any, @Param('id') id: string) {
    return this.svc.resolveSignalement(req.user.id, id);
  }

  // ── Commandes ───────────────────────────────────────────────
  @Get('commandes')
  getCommandes(
    @Request() req: any,
    @Query('onglet') onglet?: 'toutes' | 'encours' | 'litiges',
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
  ) {
    return this.svc.getCommandes(req.user.id, onglet, Number(page) || 1, Number(limit) || 20);
  }

  // ── Audit ───────────────────────────────────────────────────
  @Get('audit')
  getAudit(@Request() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.svc.getAudit(req.user.id, Number(page) || 1, Number(limit) || 20);
  }

  // ── Clients de la zone (lecture seule) ───────────────────────
  @Get('clients')
  getClients(
    @Request() req: any,
    @Query('search') search?: string,
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
  ) {
    return this.svc.getClients(req.user.id, search, Number(page) || 1, Number(limit) || 20);
  }

  // ── Statistiques complémentaires ─────────────────────────────
  @Get('stats')
  getStats(@Request() req: any) { return this.svc.getStats(req.user.id); }
}
