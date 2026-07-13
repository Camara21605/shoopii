/* ============================================================
 * FICHIER : src/modules/dashboard/super-admin/controllers/moderation.controller.ts
 *
 * Routes de modération du dashboard Super Admin :
 *   - Signalements (Alertes)  : /dashboard/super-admin/alerts/*
 *   - Journal d'audit         : /dashboard/super-admin/audit
 *   - Comptes admin / perms   : /dashboard/super-admin/admins/*
 * ============================================================ */

import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../common/guards/auth.guard';
import { RolesGuard }   from '../../../../common/guards/roles.guard';
import { Roles }        from '../../../../common/decorators/roles.decorator';
import { UserRole }     from '../../../../common/enums/user-role.enum';

import { ReportsService }        from '../services/reports.service';
import { AuditLogService }        from '../services/audit-log.service';
import { AdminsService }          from '../services/admins.service';
import { SecuriteAdminService }   from '../services/securite-admin.service';

@Controller('dashboard/super-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class ModerationController {

  constructor(
    private readonly reportsService:       ReportsService,
    private readonly auditLogService:      AuditLogService,
    private readonly adminsService:        AdminsService,
    private readonly securiteAdminService: SecuriteAdminService,
  ) {}

  // ── Signalements ─────────────────────────────────────────────

  @Get('alerts')
  async listAlerts(@Request() req: any) {
    return this.reportsService.list(req.user);
  }

  @Patch('alerts/:id/resolve')
  async resolveAlert(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    return this.reportsService.resolve(id, req.user);
  }

  // ── Journal d'audit ──────────────────────────────────────────

  @Get('audit')
  async listAudit(@Query('limit') limit?: string) {
    return this.auditLogService.list(limit ? parseInt(limit, 10) : undefined);
  }

  // ── Comptes admin / permissions ──────────────────────────────

  @Get('admins')
  async listAdmins(@Request() req: any) {
    return this.adminsService.list(req.user);
  }

  @Patch('admins/:email/permissions')
  async setAdminPermission(
    @Param('email') email: string,
    @Body() body: { perm: string; value: boolean },
    @Request() req: any,
  ) {
    return this.adminsService.setPermission(email, body.perm, body.value, req.user);
  }

  /** Pays assigné à un admin (super-admin uniquement) */
  @Patch('admins/:email/pays-assigne')
  @Roles(UserRole.SUPER_ADMIN)
  async setAdminPaysAssigne(
    @Param('email') email: string,
    @Body() body: { paysId: string | null },
    @Request() req: any,
  ) {
    return this.adminsService.setAssignedCountry(email, body.paysId ?? null, req.user);
  }

  /** Permissions de l'admin connecté — accessible par le rôle ADMIN */
  @Get('my-permissions')
  async getMyPermissions(@Request() req: any) {
    return this.adminsService.getMyPermissions(req.user.id);
  }

  /** Profil de l'admin connecté */
  @Get('my-profil')
  async getMyProfil(@Request() req: any) {
    return this.adminsService.getMyProfil(req.user.id);
  }

  @Patch('my-profil')
  async updateMyProfil(
    @Body() body: { firstName?: string; lastName?: string; phone?: string; zone?: string; bio?: string },
    @Request() req: any,
  ) {
    return this.adminsService.updateMyProfil(req.user.id, body);
  }

  @Patch('my-profil/avatar')
  async updateMyAvatar(
    @Body() body: { avatarUrl: string | null },
    @Request() req: any,
  ) {
    return this.adminsService.updateMyAvatar(req.user.id, body.avatarUrl ?? null);
  }

  /* ── Sécurité du compte admin connecté ─────────────────────────
   * Accessible par ADMIN et SUPER_ADMIN (hérité du @Roles class-level).
   * ──────────────────────────────────────────────────────────────── */

  /**
   * GET my-securite
   * Retourne le score de sécurité, le statut 2FA,
   * et les informations de dernière connexion.
   */
  @Get('my-securite')
  async getMySecurite(@Request() req: any) {
    return this.securiteAdminService.getSecurite(req.user.id);
  }

  /**
   * PATCH my-securite/password
   * Valide l'ancien mot de passe et applique le nouveau (bcrypt 12).
   * Body : { currentPassword, newPassword, confirmPassword }
   */
  @Patch('my-securite/password')
  async changeMyPassword(
    @Body() body: { currentPassword: string; newPassword: string; confirmPassword: string },
    @Request() req: any,
  ) {
    return this.securiteAdminService.changePassword(req.user.id, body);
  }

  /**
   * PATCH my-securite/2fa
   * Active ou désactive la 2FA TOTP.
   * Body : { twoFaEnabled: boolean; twoFaMethod?: 'app' | 'sms' | 'email' }
   * Quand twoFaEnabled=true + method='app' :
   *   → retourne { otpAuthUri, secret } pour générer le QR code côté frontend.
   */
  @Patch('my-securite/2fa')
  async toggleMyTwoFa(
    @Body() body: { twoFaEnabled: boolean; twoFaMethod?: string },
    @Request() req: any,
  ) {
    return this.securiteAdminService.toggleTwoFa(req.user.id, body);
  }
}
