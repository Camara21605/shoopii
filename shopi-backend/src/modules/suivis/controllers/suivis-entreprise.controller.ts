/* ============================================================
 * FICHIER : src/modules/suivis/controllers/suivis-entreprise.controller.ts
 * Base URL : /api/suivis/entreprises
 * ============================================================ */

import {
  Controller, Post, Get, Param, Req, UseGuards, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard }               from '../../../common/guards/auth.guard';
import { SuivisEntrepriseService } from '../services/suivis-entreprise.service';
import { UserRole }                from '../../../common/enums/user-role.enum';

@Controller('suivis/entreprises')
@UseGuards(JwtAuthGuard)
export class SuivisEntrepriseController {

  constructor(private readonly service: SuivisEntrepriseService) {}

  private ctx(req: Request): { userId: string; role: UserRole } {
    const u = (req as any).user;
    return { userId: u.userId ?? u.id, role: u.role };
  }

  /**
   * POST /suivis/entreprises/:id
   * Suivre ou désabonner d'une entreprise — toggle immédiat.
   */
  @Post(':id')
  @HttpCode(HttpStatus.OK)
  async toggleSuivi(@Req() req: Request, @Param('id') companyId: string) {
    const { userId, role } = this.ctx(req);
    return this.service.toggleSuivi(userId, role, companyId);
  }

  /**
   * GET /suivis/entreprises?commune=Kaloum&category=tech
   * Liste des entreprises avec isSuivi pour l'utilisateur courant.
   */
  @Get()
  async getEntreprises(
    @Req()             req: Request,
    @Query('commune')  commune?:  string,
    @Query('category') category?: string,
  ) {
    const { userId, role } = this.ctx(req);
    return this.service.getEntreprisesWithSuiviStatus(userId, role, { commune, category });
  }

  /** GET /suivis/entreprises/:id/count → nombre de followers */
  @Get(':id/count')
  async getFollowersCount(@Param('id') id: string) {
    return { followersCount: await this.service.getFollowersCount(id) };
  }

  /** GET /suivis/entreprises/:id/statut → isSuivi */
  @Get(':id/statut')
  async getSuiviStatut(@Req() req: Request, @Param('id') id: string) {
    const { userId, role } = this.ctx(req);
    return { isSuivi: await this.service.isSuivi(userId, role, id) };
  }
}