/* ============================================================
 * FICHIER : src/modules/location/controllers/actor-map.controller.ts
 * ROUTE   : GET /location/map/search?q=&types=&lat=&lng=&radiusKm=&limit=
 *           Carte de recherche du client : entreprises, livreurs,
 *           correspondants (voir ActorMapService).
 * ============================================================ */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/auth.guard';
import { ActorMapService } from '../services/actor-map.service';
import { ActorMapQueryDto } from '../dto/actor-map.dto';

@Controller('location/map')
@UseGuards(JwtAuthGuard)
export class ActorMapController {
  constructor(private readonly svc: ActorMapService) {}

  /* 60 requêtes / minute : la recherche est déclenchée à la frappe (avec délai côté client) */
  @Get('search')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  search(@Query() dto: ActorMapQueryDto) {
    return this.svc.search(dto);
  }
}
