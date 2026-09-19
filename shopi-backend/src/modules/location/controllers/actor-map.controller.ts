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
import { PlaceSearchService } from '../services/place-search.service';
import { ActorMapQueryDto, LocateQueryDto, PlacesQueryDto } from '../dto/actor-map.dto';

@Controller('location/map')
@UseGuards(JwtAuthGuard)
export class ActorMapController {
  constructor(
    private readonly svc:    ActorMapService,
    private readonly places: PlaceSearchService,
  ) {}

  /* 60 requêtes / minute : la recherche est déclenchée à la frappe (avec délai côté client) */
  @Get('search')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  search(@Query() dto: ActorMapQueryDto) {
    return this.svc.search(dto);
  }

  /* Suggestions de lieux : recherche locale, sans appel externe */
  @Get('places')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  suggestPlaces(@Query() dto: PlacesQueryDto) {
    return { places: this.places.suggestions(dto.q) };
  }

  /* Coordonnées d'UN lieu choisi (géocodage précis) : 20 / minute suffisent — un clic = un appel */
  @Get('locate')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async locate(@Query() dto: LocateQueryDto) {
    return { position: await this.places.locate(dto) };
  }
}
