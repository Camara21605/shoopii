/* ============================================================
 * FICHIER : src/modules/location/controllers/client-address.controller.ts
 * ROUTES  :
 *   GET    /location/addresses           → liste des adresses
 *   POST   /location/addresses           → créer une adresse
 *   PATCH  /location/addresses/:id       → modifier une adresse
 *   DELETE /location/addresses/:id       → supprimer une adresse
 *   PATCH  /location/addresses/:id/default → définir par défaut
 *   GET    /location/addresses/default   → adresse par défaut
 * ============================================================ */

import {
  Controller, Get, Post, Patch, Delete, Body,
  Param, ParseUUIDPipe, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard }          from '../../../common/guards/auth.guard';
import { CurrentUser }           from '../../../common/decorators/roles.decorator';
import { User }                  from '../../../database/entities/user.entity';
import { ClientAddressService }  from '../services/client-address.service';
import {
  CreateClientAddressDto,
  UpdateClientAddressDto,
} from '../dto/client-address.dto';

@Controller('location/addresses')
@UseGuards(JwtAuthGuard)
export class ClientAddressController {

  constructor(private readonly svc: ClientAddressService) {}

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.svc.findAll(user.id);
  }

  @Get('default')
  getDefault(@CurrentUser() user: User) {
    return this.svc.getDefault(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: User,
    @Body()        dto:  CreateClientAddressDto,
  ) {
    return this.svc.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id:   string,
    @CurrentUser()              user: User,
    @Body()                     dto:  UpdateClientAddressDto,
  ) {
    return this.svc.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id:   string,
    @CurrentUser()              user: User,
  ) {
    return this.svc.remove(id, user.id);
  }

  @Patch(':id/default')
  setDefault(
    @Param('id', ParseUUIDPipe) id:   string,
    @CurrentUser()              user: User,
  ) {
    return this.svc.setDefault(id, user.id);
  }
}
