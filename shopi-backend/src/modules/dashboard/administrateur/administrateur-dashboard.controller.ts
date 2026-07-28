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
  getCodes(@Request() req: any) { return this.svc.getCodes(req.user.id); }

  @Post('codes')
  generateCode(@Request() req: any, @Body() body: GenerateCodeDto) {
    return this.svc.generateCode(req.user.id, body);
  }

  @Delete('codes/:id')
  revokeCode(@Request() req: any, @Param('id') id: string) {
    return this.svc.revokeCode(req.user.id, id);
  }

  // ── Acteurs ─────────────────────────────────────────────────
  @Get('acteurs')
  getActeurs(
    @Request() req: any,
    @Query('role')   role?:   string,
    @Query('search') search?: string,
  ) {
    return this.svc.getActeurs(req.user.id, role, search);
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
  getPartenaires(@Request() req: any) { return this.svc.getPartenaires(req.user.id); }

  // ── Signalements ────────────────────────────────────────────
  @Get('signalements')
  getSignalements(@Request() req: any) { return this.svc.getSignalements(req.user.id); }

  @Patch('signalements/:id/resolve')
  resolveSignalement(@Request() req: any, @Param('id') id: string) {
    return this.svc.resolveSignalement(req.user.id, id);
  }

  // ── Commandes ───────────────────────────────────────────────
  @Get('commandes')
  getCommandes(@Request() req: any) { return this.svc.getCommandes(req.user.id); }

  // ── Audit ───────────────────────────────────────────────────
  @Get('audit')
  getAudit(@Request() req: any) { return this.svc.getAudit(req.user.id); }
}
