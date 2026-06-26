/* ============================================================
 * FICHIER : src/modules/location/controllers/correspondant-location.controller.ts
 * ROUTES  :
 *   GET    /location/correspondant/:id           → localisation dépôt
 *   PATCH  /location/correspondant/:id           → mettre à jour
 *   GET    /location/correspondant/nearby        → correspondants proches
 * ============================================================ */

import {
  Controller, Get, Patch, Body, Param,
  ParseUUIDPipe, UseGuards, Query,
} from '@nestjs/common';
import { JwtAuthGuard }                    from '../../../common/guards/auth.guard';
import { Roles, CurrentUser }              from '../../../common/decorators/roles.decorator';
import { RolesGuard }                      from '../../../common/guards/roles.guard';
import { UserRole }                        from '../../../common/enums/user-role.enum';
import { User }                            from '../../../database/entities/user.entity';
import { CorrespondantLocationService }    from '../services/correspondant-location.service';
import { UpdateCorrespondantLocationDto }  from '../dto/correspondant-location.dto';
import { ProximityQueryDto }               from '../dto/proximity.dto';

@Controller('location/correspondant')
@UseGuards(JwtAuthGuard)
export class CorrespondantLocationController {

  constructor(private readonly svc: CorrespondantLocationService) {}

  /** Correspondants proches */
  @Get('nearby')
  findNearby(@Query() query: ProximityQueryDto) {
    return this.svc.findNearby(query);
  }

  /** Localisation du dépôt */
  @Get(':id')
  getLocation(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getLocation(id);
  }

  /** Mettre à jour la localisation */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CORRESPONDENT)
  updateLocation(
    @Param('id', ParseUUIDPipe) id:   string,
    @CurrentUser()              user: User,
    @Body()                     dto:  UpdateCorrespondantLocationDto,
  ) {
    return this.svc.updateLocation(id, user.id, dto);
  }
}
