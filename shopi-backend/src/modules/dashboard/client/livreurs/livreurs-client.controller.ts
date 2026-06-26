/* ================================================================
 * FICHIER : src/modules/dashboard/client/livreurs/livreurs-client.controller.ts
 *
 * RÔLE : Routes publiques des livreurs (côté client).
 *
 * ROUTES :
 *   GET /client/livreurs          → liste + filtres + isSuivi
 *   GET /client/livreurs/stats    → stats réseau (hero banner)
 *   GET /client/livreurs/:id      → profil complet d'un livreur
 *
 * GUARD : OptionalJwtAuthGuard
 *   → Pas de blocage anonyme
 *   → req.user = null si pas de token
 *   → isSuivi = false pour les anonymes
 * ================================================================ */

import {
  Controller, Get, Param, Query,
  UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';

import { OptionalJwtAuthGuard }  from '../../../../common/guards/optional-jwt.guard';
import { LivreursClientService } from './livreurs-client.service';
import { QueryLivreursDto }      from './dto/query-livreurs.dto';

@Controller('client/livreurs')
@UseGuards(OptionalJwtAuthGuard)
export class LivreursClientController {

  constructor(private readonly livreursService: LivreursClientService) {}

  /* ── GET /client/livreurs ── */
  @Get()
  @HttpCode(HttpStatus.OK)
  getLivreurs(@Query() dto: QueryLivreursDto, @Request() req: any) {
    return this.livreursService.getLivreurs(dto, req.user?.id);
  }

  /* ── GET /client/livreurs/stats (déclaré AVANT :id) ── */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  getStats() {
    return this.livreursService.getNetworkStats();
  }

  /* ── GET /client/livreurs/:id ── */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  getLivreurById(@Param('id') id: string, @Request() req: any) {
    return this.livreursService.getLivreurById(id, req.user?.id);
  }
}