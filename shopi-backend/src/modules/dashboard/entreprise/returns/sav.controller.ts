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
  @Get('stats')
  getStats(@Req() req: any) {
    return this.savService.getStats(req.user.id);
  }

  /* ── Liste tickets ── */
  @Get()
  findAll(@Req() req: any, @Query() filters: FilterSavDto) {
    return this.savService.findAll(req.user.id, filters);
  }

  /* ── Détail ticket + messages ── */
  @Get(':id')
  findOne(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.savService.findOne(req.user.id, id);
  }

  /* ── Répondre à un ticket ── */
  @Post(':id/reply')
  reply(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplySavDto,
  ) {
    return this.savService.reply(req.user.id, id, dto);
  }

  /* ── Fermer un ticket ── */
  @Patch(':id/close')
  close(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.savService.close(req.user.id, id);
  }

  /* ── Résoudre un ticket ── */
  @Patch(':id/resolve')
  resolve(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.savService.resolve(req.user.id, id);
  }

  /* ── Assigner un ticket ── */
  @Patch(':id/assign')
  assign(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignSavDto,
  ) {
    return this.savService.assign(req.user.id, id, dto);
  }

  /* ── Changer priorité ── */
  @Patch(':id/priority')
  updatePriority(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSavPriorityDto,
  ) {
    return this.savService.updatePriority(req.user.id, id, dto);
  }
}
