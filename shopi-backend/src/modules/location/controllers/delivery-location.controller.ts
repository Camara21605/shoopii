/* ============================================================
 * FICHIER : src/modules/location/controllers/delivery-location.controller.ts
 * ROUTES  :
 *   GET    /location/delivery/:id/position       → position actuelle
 *   PATCH  /location/delivery/:id/position       → mettre à jour position (REST fallback)
 *   PATCH  /location/delivery/:id/zone           → mettre à jour la zone
 *   GET    /location/delivery/:id/history        → historique de position
 *   GET    /location/delivery/nearby             → livreurs proches
 * ============================================================ */

import {
  Controller, Get, Patch, Body, Param, ParseUUIDPipe,
  UseGuards, Query, HttpCode, HttpStatus, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard }                from '../../../common/guards/auth.guard';
import { Roles, CurrentUser }          from '../../../common/decorators/roles.decorator';
import { RolesGuard }                  from '../../../common/guards/roles.guard';
import { UserRole }                    from '../../../common/enums/user-role.enum';
import { User }                        from '../../../database/entities/user.entity';
import { DeliveryLocationService }     from '../services/delivery-location.service';
import {
  UpdateDeliveryPositionDto,
  UpdateDeliveryZoneDto,
} from '../dto/delivery-position.dto';
import { ProximityQueryDto }           from '../dto/proximity.dto';

@Controller('location/delivery')
@UseGuards(JwtAuthGuard)
export class DeliveryLocationController {

  constructor(private readonly svc: DeliveryLocationService) {}

  /** Livreurs proches d'un point GPS */
  @Get('nearby')
  findNearby(@Query() query: ProximityQueryDto) {
    return this.svc.findNearby(query);
  }

  /** Position actuelle d'un livreur (livreur lui-même ou admin) */
  @Get(':id/position')
  getPosition(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    this.assertSelfOrAdmin(id, user);
    return this.svc.getPosition(id);
  }

  /** Historique des positions (livreur lui-même ou admin) */
  @Get(':id/history')
  getHistory(
    @Param('id', ParseUUIDPipe) id:        string,
    @Query('sessionId')         sessionId?: string,
    @Query('limit')             limit?:     number,
    @CurrentUser()              user?:      User,
  ) {
    this.assertSelfOrAdmin(id, user!);
    return this.svc.getHistory(id, sessionId, limit ? Number(limit) : undefined);
  }

  /* Autorisation — seul le livreur concerné ou un admin peut consulter sa
   * position/trajectoire GPS. Sans ce contrôle, n'importe quel utilisateur
   * authentifié (client, entreprise…) pouvait suivre les déplacements de
   * n'importe quel livreur en connaissant son UUID. */
  private assertSelfOrAdmin(deliveryId: string, user: User): void {
    const actorId = (user as any).actorId as string | undefined;
    const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
    if (!isAdmin && actorId !== deliveryId) {
      throw new ForbiddenException("Vous n'avez pas accès à cette position.");
    }
  }

  /** Mise à jour REST (fallback si WebSocket indisponible) */
  @Patch(':id/position')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles(UserRole.DELIVERY)
  updatePosition(
    @Param('id', ParseUUIDPipe) id:  string,
    @Body()                     dto: UpdateDeliveryPositionDto,
  ) {
    return this.svc.updatePosition(id, dto);
  }

  /** Mise à jour de la zone de livraison */
  @Patch(':id/zone')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DELIVERY)
  updateZone(
    @Param('id', ParseUUIDPipe) id:  string,
    @Body()                     dto: UpdateDeliveryZoneDto,
  ) {
    return this.svc.updateZone(id, dto);
  }
}
