/* ============================================================
 * FICHIER : src/modules/location/controllers/actor-search.controller.ts
 * ROUTE   : GET /location/search-actor?q=<nom>
 *           Recherche une boutique/un livreur/un correspondant par
 *           nom, pour affichage sur la carte "Ma position" du client.
 * ============================================================ */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/auth.guard';
import { ActorSearchService } from '../services/actor-search.service';
import { ActorSearchQueryDto } from '../dto/actor-search.dto';

@Controller('location/search-actor')
@UseGuards(JwtAuthGuard)
export class ActorSearchController {
  constructor(private readonly svc: ActorSearchService) {}

  @Get()
  search(@Query() dto: ActorSearchQueryDto) {
    return this.svc.search(dto.q);
  }
}
