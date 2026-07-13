/* ================================================================
 * FICHIER : src/modules/geo/geo.controller.ts
 *
 * Routes CRUD pour les 6 niveaux géographiques.
 * Toutes les routes sont protégées JWT + rôles SUPER_ADMIN / ADMIN.
 *
 * Préfixe : /geo
 *
 *   GET    /geo/all
 *   GET    /geo/pays              GET    /geo/pays/:id
 *   POST   /geo/pays              PATCH  /geo/pays/:id
 *   DELETE /geo/pays/:id         PATCH  /geo/pays/:id/toggle
 *   (idem pour regions, prefectures, communes, quartiers, zones)
 * ================================================================ */

import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, Request,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard }   from '../../common/guards/roles.guard';
import { Roles }        from '../../common/decorators/roles.decorator';
import { Public }       from '../../common/decorators/public.decorator';
import { UserRole }     from '../../common/enums/user-role.enum';

import { GeoService }        from './geo.service';
import { CreateGeoItemDto }  from './geo.dto';

@ApiTags('Référentiel Géographique')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  /* ══════════════════════════════════════════════════════════
   * ITEMS PUBLICS PAR NIVEAU — accessibles sans authentification
   * GET /geo/items?niveau=commune
   * ══════════════════════════════════════════════════════════ */
  @Get('items')
  @Public()
  @Roles()
  @ApiOperation({ summary: 'Items géographiques actifs par niveau (pays/region/prefecture/commune/quartier) — route publique' })
  itemsByNiveau(@Query('niveau') niveau: string) {
    const valid = ['pays', 'region', 'prefecture', 'commune', 'quartier'] as const;
    if (!valid.includes(niveau as any)) return [];
    return this.geo.itemsByNiveau(niveau as any);
  }

  /* ══════════════════════════════════════════════════════════
   * VILLES PUBLIQUES — accessibles sans authentification
   * GET /geo/villes?indicatif=+224
   * ══════════════════════════════════════════════════════════ */
  @Get('villes')
  @Public()
  @Roles()
  @ApiOperation({ summary: 'Préfectures (villes) liées à un indicatif téléphonique — route publique' })
  villesByIndicatif(@Query('indicatif') indicatif: string) {
    if (!indicatif?.trim()) return [];
    return this.geo.villesByIndicatif(indicatif.trim());
  }

  /* ══════════════════════════════════════════════════════════
   * ALL — charge tout en une seule requête (cascade selectors)
   * ══════════════════════════════════════════════════════════ */
  @Get('all')
  @ApiOperation({ summary: 'Retourne les 6 niveaux pour les sélecteurs en cascade' })
  getAll() {
    return this.geo.getAll();
  }

  /* ══════════════════════════════════════════════════════════
   * PAYS
   * ══════════════════════════════════════════════════════════ */
  @Get('pays')
  findAllPays(@Query('search') search?: string, @Query('statut') statut?: 'actif' | 'inactif') {
    return this.geo.findAllPays({ search, statut });
  }

  @Post('pays')
  @HttpCode(HttpStatus.CREATED)
  createPays(@Body() dto: CreateGeoItemDto) {
    return this.geo.createPays(dto);
  }

  @Patch('pays/:id')
  updatePays(@Param('id') id: string, @Body() dto: CreateGeoItemDto, @Request() req: any) {
    return this.geo.updatePays(id, dto, req.user.role, req.user.id);
  }

  @Delete('pays/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePays(@Param('id') id: string, @Request() req: any) {
    return this.geo.removePays(id, req.user.role, req.user.id);
  }

  @Patch('pays/:id/toggle')
  togglePays(@Param('id') id: string, @Request() req: any) {
    return this.geo.togglePays(id, req.user.role, req.user.id);
  }

  @Patch('pays/:id/delegation')
  @Roles(UserRole.SUPER_ADMIN)
  delegationPays(@Param('id') id: string) {
    return this.geo.toggleDelegationPays(id);
  }

  /* ══════════════════════════════════════════════════════════
   * RÉGIONS
   * ══════════════════════════════════════════════════════════ */
  @Get('regions')
  findAllRegions(@Query('search') search?: string, @Query('statut') statut?: 'actif' | 'inactif') {
    return this.geo.findAllRegions({ search, statut });
  }

  @Post('regions')
  @HttpCode(HttpStatus.CREATED)
  createRegion(@Body() dto: CreateGeoItemDto) {
    return this.geo.createRegion(dto);
  }

  @Patch('regions/:id')
  updateRegion(@Param('id') id: string, @Body() dto: CreateGeoItemDto, @Request() req: any) {
    return this.geo.updateRegion(id, dto, req.user.role, req.user.id);
  }

  @Delete('regions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeRegion(@Param('id') id: string, @Request() req: any) {
    return this.geo.removeRegion(id, req.user.role, req.user.id);
  }

  @Patch('regions/:id/toggle')
  toggleRegion(@Param('id') id: string, @Request() req: any) {
    return this.geo.toggleRegion(id, req.user.role, req.user.id);
  }

  @Patch('regions/:id/delegation')
  @Roles(UserRole.SUPER_ADMIN)
  delegationRegion(@Param('id') id: string) {
    return this.geo.toggleDelegationRegion(id);
  }

  /* ══════════════════════════════════════════════════════════
   * PRÉFECTURES
   * ══════════════════════════════════════════════════════════ */
  @Get('prefectures')
  findAllPrefectures(@Query('search') search?: string, @Query('statut') statut?: 'actif' | 'inactif') {
    return this.geo.findAllPrefectures({ search, statut });
  }

  @Post('prefectures')
  @HttpCode(HttpStatus.CREATED)
  createPrefecture(@Body() dto: CreateGeoItemDto) {
    return this.geo.createPrefecture(dto);
  }

  @Patch('prefectures/:id')
  updatePrefecture(@Param('id') id: string, @Body() dto: CreateGeoItemDto, @Request() req: any) {
    return this.geo.updatePrefecture(id, dto, req.user.role, req.user.id);
  }

  @Delete('prefectures/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePrefecture(@Param('id') id: string, @Request() req: any) {
    return this.geo.removePrefecture(id, req.user.role, req.user.id);
  }

  @Patch('prefectures/:id/toggle')
  togglePrefecture(@Param('id') id: string, @Request() req: any) {
    return this.geo.togglePrefecture(id, req.user.role, req.user.id);
  }

  @Patch('prefectures/:id/delegation')
  @Roles(UserRole.SUPER_ADMIN)
  delegationPrefecture(@Param('id') id: string) {
    return this.geo.toggleDelegationPrefecture(id);
  }

  /* ══════════════════════════════════════════════════════════
   * COMMUNES
   * ══════════════════════════════════════════════════════════ */
  @Get('communes')
  findAllCommunes(@Query('search') search?: string, @Query('statut') statut?: 'actif' | 'inactif') {
    return this.geo.findAllCommunes({ search, statut });
  }

  @Post('communes')
  @HttpCode(HttpStatus.CREATED)
  createCommune(@Body() dto: CreateGeoItemDto) {
    return this.geo.createCommune(dto);
  }

  @Patch('communes/:id')
  updateCommune(@Param('id') id: string, @Body() dto: CreateGeoItemDto, @Request() req: any) {
    return this.geo.updateCommune(id, dto, req.user.role, req.user.id);
  }

  @Delete('communes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCommune(@Param('id') id: string, @Request() req: any) {
    return this.geo.removeCommune(id, req.user.role, req.user.id);
  }

  @Patch('communes/:id/toggle')
  toggleCommune(@Param('id') id: string, @Request() req: any) {
    return this.geo.toggleCommune(id, req.user.role, req.user.id);
  }

  @Patch('communes/:id/delegation')
  @Roles(UserRole.SUPER_ADMIN)
  delegationCommune(@Param('id') id: string) {
    return this.geo.toggleDelegationCommune(id);
  }

  /* ══════════════════════════════════════════════════════════
   * QUARTIERS
   * ══════════════════════════════════════════════════════════ */
  @Get('quartiers')
  findAllQuartiers(@Query('search') search?: string, @Query('statut') statut?: 'actif' | 'inactif') {
    return this.geo.findAllQuartiers({ search, statut });
  }

  @Post('quartiers')
  @HttpCode(HttpStatus.CREATED)
  createQuartier(@Body() dto: CreateGeoItemDto) {
    return this.geo.createQuartier(dto);
  }

  @Patch('quartiers/:id')
  updateQuartier(@Param('id') id: string, @Body() dto: CreateGeoItemDto, @Request() req: any) {
    return this.geo.updateQuartier(id, dto, req.user.role, req.user.id);
  }

  @Delete('quartiers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeQuartier(@Param('id') id: string, @Request() req: any) {
    return this.geo.removeQuartier(id, req.user.role, req.user.id);
  }

  @Patch('quartiers/:id/toggle')
  toggleQuartier(@Param('id') id: string, @Request() req: any) {
    return this.geo.toggleQuartier(id, req.user.role, req.user.id);
  }

  @Patch('quartiers/:id/delegation')
  @Roles(UserRole.SUPER_ADMIN)
  delegationQuartier(@Param('id') id: string) {
    return this.geo.toggleDelegationQuartier(id);
  }

  /* ══════════════════════════════════════════════════════════
   * ZONES DE LIVRAISON
   * ══════════════════════════════════════════════════════════ */
  @Get('zones')
  findAllZones(@Query('search') search?: string, @Query('statut') statut?: 'actif' | 'inactif') {
    return this.geo.findAllZones({ search, statut });
  }

  @Post('zones')
  @HttpCode(HttpStatus.CREATED)
  createZone(@Body() dto: CreateGeoItemDto) {
    return this.geo.createZone(dto);
  }

  @Patch('zones/:id')
  updateZone(@Param('id') id: string, @Body() dto: CreateGeoItemDto, @Request() req: any) {
    return this.geo.updateZone(id, dto, req.user.role, req.user.id);
  }

  @Delete('zones/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeZone(@Param('id') id: string, @Request() req: any) {
    return this.geo.removeZone(id, req.user.role, req.user.id);
  }

  @Patch('zones/:id/toggle')
  toggleZone(@Param('id') id: string, @Request() req: any) {
    return this.geo.toggleZone(id, req.user.role, req.user.id);
  }

  @Patch('zones/:id/delegation')
  @Roles(UserRole.SUPER_ADMIN)
  delegationZone(@Param('id') id: string) {
    return this.geo.toggleDelegationZone(id);
  }
}
