/* ============================================================
 * FICHIER : src/modules/dashboard/client/wishlist.controller.ts
 *
 * ROUTES (token + rôle CLIENT) :
 *   GET  /client/wishlist            → produits de la liste de souhaits
 *   GET  /client/wishlist/ids        → IDs des produits présents
 *   POST /client/wishlist/:id/toggle → ajouter / retirer un produit
 * ============================================================ */

import {
  Controller, Get, Post, Param, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard }       from '../../../common/guards/auth.guard';
import { RolesGuard }         from '../../../common/guards/roles.guard';
import { Roles, CurrentUser } from '../../../common/decorators/roles.decorator';
import { User }               from '../../../database/entities/user.entity';
import { UserRole }           from '../../../common/enums/user-role.enum';
import { WishlistService }    from './services/wishlist.service';

@Controller('client/wishlist')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
export class WishlistController {

  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  getAll(@CurrentUser() user: User) {
    return this.wishlistService.getAll(user);
  }

  @Get('ids')
  getIds(@CurrentUser() user: User) {
    return this.wishlistService.getIds(user);
  }

  @Post(':productId/toggle')
  @HttpCode(HttpStatus.OK)
  toggle(@Param('productId') productId: string, @CurrentUser() user: User) {
    return this.wishlistService.toggle(user, productId);
  }
}
