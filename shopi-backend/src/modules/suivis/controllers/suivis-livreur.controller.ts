/* ============================================================
 * src/modules/suivis/controllers/suivis-livreur.controller.ts
 *
 * CORRECTIONS :
 *   ✅ GET /suivis/livreurs → LivreursClientService.getLivreurs()
 *      au lieu de service.getLivreursWithSuiviStatus()
 *      → supporte tous les filtres du frontend (zone, vehicule…)
 *
 *   ✅ userId = undefined pour les anonymes (pas 'anonymous')
 *      → LivreursClientService.getFollowedIds(undefined) = Set vide
 *      → isSuivi = false pour tous les anonymes → correct
 *
 *   ✅ GET /:id/count sans JWT (données publiques)
 * ============================================================ */

import {
  Controller, Post, Patch, Get, Param, Body, Req,
  UseGuards, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard }          from '../../../common/guards/auth.guard';
import { OptionalJwtAuthGuard }  from '../../../common/guards/optional-jwt.guard';
import { SuivisLivreurService }  from '../services/suivis-livreur.service';
import { LivreursClientService } from '../../dashboard/client/livreurs/livreurs-client.service';
import { UserRole }              from '../../../common/enums/user-role.enum';
import { QueryLivreursDto }      from '../../dashboard/client/livreurs/dto/query-livreurs.dto';
import { SetHiddenDto }          from '../dto/suivis.dto';

@Controller('suivis/livreurs')
export class SuivisLivreurController {

  constructor(
    private readonly service:         SuivisLivreurService,
    private readonly livreursService: LivreursClientService,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * Helper : extrait userId et role depuis req.user
   * ✅ userId = undefined si anonyme (pas 'anonymous')
   *    → getFollowedIds(undefined) retourne Set vide
   *    → isSuivi = false pour toutes les cards → correct
   * ────────────────────────────────────────────────────────── */
  private getAuth(req: Request): { userId?: string; role: UserRole } {
    const u = (req as any).user;
    return {
      userId: u?.userId ?? u?.id ?? undefined,
      role:   u?.role   ?? UserRole.CLIENT,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * POST /suivis/livreurs/:id
   * Toggle follow/unfollow — JWT obligatoire
   * ────────────────────────────────────────────────────────── */
  @Post(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async toggleSuivi(@Req() req: Request, @Param('id') id: string) {
    const { userId, role } = this.getAuth(req);
    return this.service.toggleSuivi(userId!, role, id);
  }

  /* ──────────────────────────────────────────────────────────
   * GET /suivis/livreurs
   * Liste publique, enrichie avec isSuivi si connecté.
   *
   * ✅ Délègue à LivreursClientService.getLivreurs(dto, userId)
   *    → filtre/tri/pagination via QueryLivreursDto
   *    → isSuivi calculé depuis follows WHERE isSubscribed = true
   * ────────────────────────────────────────────────────────── */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async getLivreurs(
    @Req()   req: Request,
    @Query() dto: QueryLivreursDto,
  ) {
    const { userId } = this.getAuth(req);
    return this.livreursService.getLivreurs(dto, userId);
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH /suivis/livreurs/:id/masquer
   * Masque/réaffiche un livreur déjà suivi, sans se désabonner.
   * ────────────────────────────────────────────────────────── */
  @Patch(':id/masquer')
  @UseGuards(JwtAuthGuard)
  async setMasque(@Req() req: Request, @Param('id') id: string, @Body() dto: SetHiddenDto) {
    const { userId, role } = this.getAuth(req);
    return this.service.setHidden(userId!, role, id, dto.hidden);
  }

  /* ──────────────────────────────────────────────────────────
   * GET /suivis/livreurs/:id/count
   * Nombre d'abonnés d'un livreur — public (pas de JWT)
   * ────────────────────────────────────────────────────────── */
  @Get(':id/count')
  async getFollowersCount(@Param('id') id: string) {
    return { followersCount: await this.service.getFollowersCount(id) };
  }

  /* ──────────────────────────────────────────────────────────
   * GET /suivis/livreurs/:id/statut
   * Vérifie si l'utilisateur suit ce livreur — JWT obligatoire
   * ────────────────────────────────────────────────────────── */
  @Get(':id/statut')
  @UseGuards(JwtAuthGuard)
  async getSuiviStatut(@Req() req: Request, @Param('id') id: string) {
    const { userId, role } = this.getAuth(req);
    return { isSuivi: await this.service.isSuivi(userId!, role, id) };
  }
}