// src/modules/codes/codes.controller.ts

import {
  Body, Controller, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';

import { CodeCreationService }       from './code-creation.service';
import {
  GenerateAndSendCodeDto,
  GenerateBulkCodesDto,
  ValidateCodeDto,
} from './dto/generate-and-send.dto';
import { FilterCodesDto }            from './dto/filter-codes.dto';
import { JwtAuthGuard }              from '../../../common/guards/auth.guard';
import { RolesGuard }                from '../../../common/guards/roles.guard';
import { Roles, CurrentUser }        from '../../../common/decorators/roles.decorator';
import { Public }                    from '../../../common/decorators/public.decorator';
import { User }                      from '../../../database/entities/user.entity';
import { UserRole }                  from '../../../common/enums/user-role.enum';

@Controller('codes')
export class CodesController {
  constructor(private readonly codesService: CodeCreationService) {}

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  invite(@Body() dto: GenerateAndSendCodeDto, @CurrentUser() superAdmin: User) {
    return this.codesService.generateAndSendCode(dto, superAdmin);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  bulk(@Body() dto: GenerateBulkCodesDto, @CurrentUser() superAdmin: User) {
    return this.codesService.generateBulkCodes(dto, superAdmin);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  list(@Query() dto: FilterCodesDto, @CurrentUser() superAdmin: User) {
    return this.codesService.listCodes(superAdmin, dto);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  stats(@CurrentUser() superAdmin: User) {
    return this.codesService.getCodeStats(superAdmin);
  }

  @Get('export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  export(@Query() dto: FilterCodesDto, @CurrentUser() superAdmin: User) {
    return this.codesService.listCodes(superAdmin, { ...dto, limit: 10_000 });
  }

  /*
   * GET /codes/info/:code — PUBLIC
   * Retourne qui a envoyé l'invitation (entreprise ou livreur).
   * Utilisé par CorrespondantCodeBlock pour auto-sélectionner le type.
   * ⚠️ Doit être avant @Get(':id/revoke') pour éviter les conflits de route
   */
  @Get('info/:code')
  @Public()
  getCodeInfo(@Param('code') code: string) {
    return this.codesService.getCodeInfo(code);
  }

  @Patch(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() superAdmin: User,
  ) {
    return this.codesService.revokeCode(id, superAdmin);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  validate(@Body() dto: ValidateCodeDto) {
    return this.codesService.validateCode(dto.code, dto.role);
  }
}