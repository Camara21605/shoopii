/* ============================================================
 * FICHIER : src/modules/dashboard/client/favoris.controller.ts
 *
 * ROUTES (token + rôle CLIENT) :
 *   GET  /client/favoris            → produits favoris du client
 *   GET  /client/favoris/ids        → IDs des produits likés
 *   POST /client/favoris/:id/toggle → like / unlike un produit
 * ============================================================ */

import {
  Controller, Get, Post, Param, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard }       from '../../../common/guards/auth.guard';
import { RolesGuard }         from '../../../common/guards/roles.guard';
import { Roles, CurrentUser } from '../../../common/decorators/roles.decorator';
import { User }               from '../../../database/entities/user.entity';
import { UserRole }           from '../../../common/enums/user-role.enum';
import { FavorisService }     from './services/favoris.service';

@Controller('client/favoris')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
export class FavorisController {

  constructor(private readonly favorisService: FavorisService) {}

  @Get()
  getAll(@CurrentUser() user: User) {
    return this.favorisService.getAll(user);
  }

  @Get('ids')
  getIds(@CurrentUser() user: User) {
    return this.favorisService.getLikedIds(user);
  }

  @Post(':productId/toggle')
  @HttpCode(HttpStatus.OK)
  toggle(@Param('productId') productId: string, @CurrentUser() user: User) {
    return this.favorisService.toggle(user, productId);
  }
}
