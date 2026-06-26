/* ============================================================
 * FICHIER : src/modules/location/controllers/company-location.controller.ts
 * ROUTES  :
 *   GET    /location/company/:id             → localisation siège
 *   PATCH  /location/company/:id             → mettre à jour localisation
 *   GET    /location/company/:id/branches    → liste agences
 *   POST   /location/company/:id/branches    → créer une agence
 *   PATCH  /location/company/:id/branches/:bid  → modifier agence
 *   DELETE /location/company/:id/branches/:bid  → supprimer agence
 *   GET    /location/company/nearby          → entreprises proches
 * ============================================================ */

import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  ParseUUIDPipe, UseGuards, HttpCode, HttpStatus, Query,
} from '@nestjs/common';
import { JwtAuthGuard }            from '../../../common/guards/auth.guard';
import { Roles, CurrentUser }      from '../../../common/decorators/roles.decorator';
import { RolesGuard }              from '../../../common/guards/roles.guard';
import { UserRole }                from '../../../common/enums/user-role.enum';
import { User }                    from '../../../database/entities/user.entity';
import { CompanyLocationService }  from '../services/company-location.service';
import {
  UpdateCompanyLocationDto,
  CreateCompanyBranchDto,
  UpdateCompanyBranchDto,
} from '../dto/company-location.dto';
import { ProximityQueryDto }       from '../dto/proximity.dto';

@Controller('location/company')
@UseGuards(JwtAuthGuard)
export class CompanyLocationController {

  constructor(private readonly svc: CompanyLocationService) {}

  /** Entreprises proches */
  @Get('nearby')
  findNearby(@Query() query: ProximityQueryDto) {
    return this.svc.findNearby(query);
  }

  /** Localisation du siège */
  @Get(':id')
  getLocation(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getLocation(id);
  }

  /** Mettre à jour la localisation */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COMPANY)
  updateLocation(
    @Param('id', ParseUUIDPipe) id:   string,
    @CurrentUser()              user: User,
    @Body()                     dto:  UpdateCompanyLocationDto,
  ) {
    return this.svc.updateLocation(id, user.id, dto);
  }

  /** Liste des agences */
  @Get(':id/branches')
  getBranches(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getBranches(id);
  }

  /** Créer une agence */
  @Post(':id/branches')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(UserRole.COMPANY)
  createBranch(
    @Param('id', ParseUUIDPipe) id:   string,
    @CurrentUser()              user: User,
    @Body()                     dto:  CreateCompanyBranchDto,
  ) {
    return this.svc.createBranch(id, user.id, dto);
  }

  /** Modifier une agence */
  @Patch(':id/branches/:bid')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COMPANY)
  updateBranch(
    @Param('id',  ParseUUIDPipe) id:   string,
    @Param('bid', ParseUUIDPipe) bid:  string,
    @CurrentUser()               user: User,
    @Body()                      dto:  UpdateCompanyBranchDto,
  ) {
    return this.svc.updateBranch(bid, id, user.id, dto);
  }

  /** Supprimer une agence */
  @Delete(':id/branches/:bid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles(UserRole.COMPANY)
  removeBranch(
    @Param('id',  ParseUUIDPipe) id:   string,
    @Param('bid', ParseUUIDPipe) bid:  string,
    @CurrentUser()               user: User,
  ) {
    return this.svc.removeBranch(bid, id, user.id);
  }
}
