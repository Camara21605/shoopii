/* ============================================================
 * FICHIER : src/modules/dashboard/client/service-favoris.controller.ts
 *
 * ROUTES (token + rôle CLIENT) :
 *   GET  /client/favoris-services            → prestations favorites du client
 *   GET  /client/favoris-services/ids        → IDs des prestations likées
 *   POST /client/favoris-services/:id/toggle → like / unlike une prestation
 *
 * Miroir exact de favoris.controller.ts (produits).
 * ============================================================ */

import {
  Controller, Get, Post, Param, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard }       from '../../../common/guards/auth.guard';
import { RolesGuard }         from '../../../common/guards/roles.guard';
import { Roles, CurrentUser } from '../../../common/decorators/roles.decorator';
import { User }               from '../../../database/entities/user.entity';
import { UserRole }           from '../../../common/enums/user-role.enum';
import { ServiceFavorisService } from './services/service-favoris.service';

@Controller('client/favoris-services')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
export class ServiceFavorisController {

  constructor(private readonly serviceFavorisService: ServiceFavorisService) {}

  @Get()
  getAll(@CurrentUser() user: User) {
    return this.serviceFavorisService.getAll(user);
  }

  @Get('ids')
  getIds(@CurrentUser() user: User) {
    return this.serviceFavorisService.getLikedIds(user);
  }

  @Post(':serviceId/toggle')
  @HttpCode(HttpStatus.OK)
  toggle(@Param('serviceId') serviceId: string, @CurrentUser() user: User) {
    return this.serviceFavorisService.toggle(user, serviceId);
  }
}
