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

import { ReportsService } from '../services/reports.service';
import { AuditLogService } from '../services/audit-log.service';
import { AdminsService }   from '../services/admins.service';

@Controller('dashboard/super-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class ModerationController {

  constructor(
    private readonly reportsService: ReportsService,
    private readonly auditLogService: AuditLogService,
    private readonly adminsService: AdminsService,
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
}
