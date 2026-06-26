/* ============================================================
 * FICHIER : src/modules/dashboard/super-admin/controllers/utilisateurs.controller.ts
 * ============================================================ */

import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  Res,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard }        from '../../../../common/guards/auth.guard';
import { RolesGuard }          from '../../../../common/guards/roles.guard';
import { Roles }               from '../../../../common/decorators/roles.decorator';
import { UserRole }            from '../../../../common/enums/user-role.enum';
import { UtilisateursService } from '../services/utilisateurs.service';
import { FilterUsersDto }      from '../dto/utilisateurs.dto';

@Controller('dashboard/super-admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class UtilisateursController {

  constructor(
    private readonly utilisateursService: UtilisateursService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // GET /dashboard/super-admin/users
  // Liste paginée avec filtres
  // ══════════════════════════════════════════════════════════════════════════

  @Get()
  async listUsers(
    @Query() dto: FilterUsersDto,
    @Request() req: any,
  ) {
    return this.utilisateursService.listUsers(dto, req.user);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GET /dashboard/super-admin/users/stats
  // Statistiques globales (total, par rôle, par statut, pays, 30j)
  // ══════════════════════════════════════════════════════════════════════════

  @Get('stats')
  async getStats(@Request() req: any) {
    return this.utilisateursService.getStats(req.user);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GET /dashboard/super-admin/users/export
  // Export CSV — retourne un fichier téléchargeable
  // ══════════════════════════════════════════════════════════════════════════

  @Get('export')
  async exportCsv(
    @Query() dto: FilterUsersDto,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const csv = await this.utilisateursService.exportCsv(dto, req.user);

    res
      .status(HttpStatus.OK)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader(
        'Content-Disposition',
        `attachment; filename="shopi-utilisateurs-${Date.now()}.csv"`,
      )
      .send(csv);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GET /dashboard/super-admin/users/:id
  // Détail complet d'un utilisateur
  // ══════════════════════════════════════════════════════════════════════════

  @Get(':id')
  async getUser(
    @Param('id', ParseUUIDPipe) userId: string,
    @Request() req: any,
  ) {
    return this.utilisateursService.getUser(userId, req.user);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PATCH /dashboard/super-admin/users/:id/block
  // Bloquer / Débloquer toggle
  // ══════════════════════════════════════════════════════════════════════════

  @Patch(':id/block')
  async toggleBlock(
    @Param('id', ParseUUIDPipe) userId: string,
    @Request() req: any,
  ) {
    return this.utilisateursService.toggleBlock(userId, req.user);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PATCH /dashboard/super-admin/users/:id/suspend
  // Suspendre un utilisateur
  // ══════════════════════════════════════════════════════════════════════════

  @Patch(':id/suspend')
  async suspendUser(
    @Param('id', ParseUUIDPipe) userId: string,
    @Request() req: any,
    @Body('raison') raison?: string,
  ) {
    return this.utilisateursService.suspendUser(userId, req.user, raison);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PATCH /dashboard/super-admin/users/:id/verify
  // Vérifier manuellement un compte
  // ══════════════════════════════════════════════════════════════════════════

  @Patch(':id/verify')
  async verifyUser(
    @Param('id', ParseUUIDPipe) userId: string,
    @Request() req: any,
  ) {
    return this.utilisateursService.verifyUser(userId, req.user);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DELETE /dashboard/super-admin/users/:id
  // Supprimer un utilisateur (soft delete)
  // ══════════════════════════════════════════════════════════════════════════

  @Delete(':id')
  async deleteUser(
    @Param('id', ParseUUIDPipe) userId: string,
    @Request() req: any,
  ) {
    return this.utilisateursService.deleteUser(userId, req.user);
  }
}