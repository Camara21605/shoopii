/* ============================================================
 * FICHIER : returns/sav.controller.ts
 * RÔLE    : Routes SAV côté entreprise.
 *           Route base : /dashboard/entreprise/sav
 * ============================================================ */

import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, Req, ParseUUIDPipe,
} from '@nestjs/common';

import { JwtAuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard }   from 'src/common/guards/roles.guard';
import { Roles }        from 'src/common/decorators/roles.decorator';
import { UserRole }     from 'src/common/enums/user-role.enum';
import { TeamPermissionGuard }    from 'src/modules/company-team/guards/team-permission.guard';
import { RequiresTeamPermission } from 'src/modules/company-team/decorators/requires-team-permission.decorator';

import { SavService } from './services/sav.service';
import {
  ReplySavDto, AssignSavDto, FilterSavDto, UpdateSavPriorityDto,
} from './dto/sav.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY)
@Controller('dashboard/entreprise/sav')
export class SavController {

  constructor(private readonly savService: SavService) {}

  /* ── Stats SAV — AVANT :id ── */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('returns', 'view')
  @Get('stats')
  getStats(@Req() req: any) {
    return this.savService.getStats(req.user.actorId ?? req.user.id);
  }

  /* ── Liste tickets ── */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('returns', 'view')
  @Get()
  findAll(@Req() req: any, @Query() filters: FilterSavDto) {
    return this.savService.findAll(req.user.actorId ?? req.user.id, filters);
  }

  /* ── Détail ticket + messages ── */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('returns', 'view')
  @Get(':id')
  findOne(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.savService.findOne(req.user.actorId ?? req.user.id, id);
  }

  /* ── Répondre à un ticket ── */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('returns', 'process')
  @Post(':id/reply')
  reply(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplySavDto,
  ) {
    return this.savService.reply(req.user.actorId ?? req.user.id, id, dto);
  }

  /* ── Fermer un ticket ── */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('returns', 'process')
  @Patch(':id/close')
  close(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.savService.close(req.user.actorId ?? req.user.id, id);
  }

  /* ── Résoudre un ticket ── */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('returns', 'process')
  @Patch(':id/resolve')
  resolve(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.savService.resolve(req.user.actorId ?? req.user.id, id);
  }

  /* ── Assigner un ticket ── */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('returns', 'process')
  @Patch(':id/assign')
  assign(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignSavDto,
  ) {
    return this.savService.assign(req.user.actorId ?? req.user.id, id, dto);
  }

  /* ── Changer priorité ── */
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('returns', 'process')
  @Patch(':id/priority')
  updatePriority(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSavPriorityDto,
  ) {
    return this.savService.updatePriority(req.user.actorId ?? req.user.id, id, dto);
  }
}
