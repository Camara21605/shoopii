/* ============================================================
 * FICHIER : src/modules/location/controllers/tracking.controller.ts
 *
 * ROUTES :
 *   GET  /location/tracking/:orderId  → suivi complet d'une commande
 *   POST /location/route              → calcul d'itinéraire libre
 * ============================================================ */

import {
  Controller, Get, Post, Param, ParseUUIDPipe,
  Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard }    from '../../../common/guards/auth.guard';
import { CurrentUser }     from '../../../common/decorators/roles.decorator';
import { User }            from '../../../database/entities/user.entity';
import { TrackingService } from '../services/tracking.service';
import { RouteService }    from '../services/route.service';
import { RouteRequestDto } from '../dto/tracking.dto';

@Controller('location')
@UseGuards(JwtAuthGuard)
export class TrackingController {

  constructor(
    private readonly trackingService: TrackingService,
    private readonly routeService:    RouteService,
  ) {}

  /**
   * GET /location/tracking/:orderId
   *
   * Retourne la position de tous les acteurs d'une commande
   * (vendeur, livreur, client) ainsi que l'itinéraire calculé.
   *
   * Sécurité : seul le client, le livreur ou l'entreprise
   * concernés par la commande peuvent accéder à ce tracking.
   */
  @Get('tracking/:orderId')
  getOrderTracking(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: User,
  ) {
    return this.trackingService.getOrderTracking(orderId, user.id);
  }

  /**
   * POST /location/route
   *
   * Calcule un itinéraire libre entre N points GPS.
   * Utilise OpenRouteService (gratuit, 2000 req/jour).
   * Fallback vers ligne droite si l'API est indisponible.
   *
   * Body : { waypoints: [{ latitude, longitude }, ...] }
   */
  @Post('route')
  @HttpCode(HttpStatus.OK)
  calculateRoute(@Body() dto: RouteRequestDto) {
    return this.routeService.getRoute(dto.waypoints);
  }
}
