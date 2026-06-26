/* ============================================================
 * FICHIER : src/modules/dashboard/client/panier.controller.ts
 * FIX : DTOs avec décorateurs class-validator
 * ============================================================ */

import {
  Body, Controller, Delete, Get, HttpCode,
  HttpStatus, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import {
  IsInt, IsOptional, IsString, IsUUID, Max, Min,
} from 'class-validator';

import { JwtAuthGuard }       from '../../../common/guards/auth.guard';
import { RolesGuard }         from '../../../common/guards/roles.guard';
import { Roles, CurrentUser } from '../../../common/decorators/roles.decorator';
import { User }               from '../../../database/entities/user.entity';
import { UserRole }           from '../../../common/enums/user-role.enum';
import { PanierService }      from './services/panier.service';

/* ✅ DTO avec décorateurs — ValidationPipe ne rejette plus les champs */
export class AddToCartDto {
  @IsUUID('all')
  produitId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  qty?: number;

  @IsOptional()
  @IsString()
  variante?: string;
}

export class UpdateQtyDto {
  @IsInt()
  @Min(1)
  @Max(10)
  qty: number;
}

@Controller('client/panier')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
export class PanierController {

  constructor(private readonly panierService: PanierService) {}

  @Get()
  getAll(@CurrentUser() user: User) {
    return this.panierService.getAll(user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  add(@Body() dto: AddToCartDto, @CurrentUser() user: User) {
    return this.panierService.add(user, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  updateQty(
    @Param('id') id: string,
    @Body()      dto: UpdateQtyDto,
    @CurrentUser() user: User,
  ) {
    return this.panierService.updateQty(user, id, dto.qty);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  removeItem(@Param('id') id: string, @CurrentUser() user: User) {
    return this.panierService.removeItem(user, id);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  clear(@CurrentUser() user: User) {
    return this.panierService.clear(user);
  }
}