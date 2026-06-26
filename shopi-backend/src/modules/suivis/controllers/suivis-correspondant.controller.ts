/* ============================================================
 * src/modules/suivis/controllers/suivis-correspondant.controller.ts
 *
 * FIX : GET /suivis/correspondants utilise OptionalJwtAuthGuard
 *   → Token présent → req.user hydraté → isSuivi correct
 *   → Token absent  → req.user = null  → isSuivi = false
 * ============================================================ */

import {
  Controller, Post, Get, Param, Req,
  UseGuards, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard }               from '../../../common/guards/auth.guard';
import { OptionalJwtAuthGuard }       from '../../../common/guards/optional-jwt.guard'; /* ✅ */
import { SuivisCorrespondantService } from '../services/suivis-correspondant.service';
import { UserRole }                   from '../../../common/enums/user-role.enum';

@Controller('suivis/correspondants')
export class SuivisCorrespondantController {

  constructor(private readonly service: SuivisCorrespondantService) {}

  private ctx(req: Request): { userId: string; role: UserRole } {
    const u = (req as any).user;
    return {
      userId: u?.userId ?? u?.id ?? 'anonymous',
      role:   u?.role   ?? UserRole.CLIENT,
    };
  }

  /* ─── POST /suivis/correspondants/:id — PROTÉGÉ ─── */
  @Post(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async toggleSuivi(@Req() req: Request, @Param('id') id: string) {
    const { userId, role } = this.ctx(req);
    return this.service.toggleSuivi(userId, role, id);
  }

  /* ─── GET /suivis/correspondants — OPTIONNEL ✅ ─── */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)   /* ← remplace @Public() */
  async getCorrespondants(
    @Req()            req:      Request,
    @Query('commune') commune?: string,
    @Query('ville')   ville?:   string,
    @Query('type')    type?:    'regional' | 'zonal' | 'national',
    @Query('online')  online?:  string,
  ) {
    const { userId, role } = this.ctx(req);
    return this.service.getCorrespondantsWithSuiviStatus(userId, role, {
      commune,
      ville,
      type,
      online: online === undefined ? undefined : online === 'true',
    });
  }

  /* ─── GET /suivis/correspondants/:id/count ─── */
  @Get(':id/count')
  @UseGuards(JwtAuthGuard)
  async getFollowersCount(@Param('id') id: string) {
    return { followersCount: await this.service.getFollowersCount(id) };
  }

  /* ─── GET /suivis/correspondants/:id/statut ─── */
  @Get(':id/statut')
  @UseGuards(JwtAuthGuard)
  async getSuiviStatut(@Req() req: Request, @Param('id') id: string) {
    const { userId, role } = this.ctx(req);
    return { isSuivi: await this.service.isSuivi(userId, role, id) };
  }
}