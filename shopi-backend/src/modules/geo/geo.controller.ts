/* ================================================================
 * FICHIER : src/modules/geo/geo.controller.ts
 *
 * Routes CRUD pour les 6 niveaux géographiques.
 * Toutes les routes sont protégées JWT + rôles SUPER_ADMIN / ADMIN.
 *
 * Préfixe : /geo
 *
 *   GET    /geo/all
 *   GET    /geo/audit             Journal d'audit (filtres action/niveau/search)
 *   POST   /geo/import/:niveau    Import massif CSV — crée réellement les lignes
 *   GET    /geo/pays              GET    /geo/pays/:id
 *   POST   /geo/pays              PATCH  /geo/pays/:id
 *   DELETE /geo/pays/:id         PATCH  /geo/pays/:id/toggle
 *   (idem pour regions, prefectures, communes, quartiers, zones)
 * ================================================================ */

import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, Request,
  HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard }   from '../../common/guards/roles.guard';
import { Roles }        from '../../common/decorators/roles.decorator';
import { Public }       from '../../common/decorators/public.decorator';
import { UserRole }     from '../../common/enums/user-role.enum';

import { GeoService }        from './geo.service';
import { GeoResolutionService } from './geo-resolution.service';
import { CreateGeoItemDto, GeoImportDto } from './geo.dto';
import type { GeoAuditNiveau } from '../../database/entities/geo/geo-audit-log.entity';

const IMPORT_NIVEAUX: GeoAuditNiveau[] = ['pays', 'region', 'prefecture', 'commune', 'quartier', 'zone'];

/* ── Identité de l'acteur pour le journal d'audit ── */
function actor(req: any): { email: string; userId: string } {
  return { email: req.user?.email ?? 'Super Admin', userId: req.user?.id ?? null };
}

@ApiTags('Référentiel Géographique')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
@Controller('geo')
export class GeoController {
  constructor(
    private readonly geo: GeoService,
    private readonly geoResolution: GeoResolutionService,
  ) {}

  /* ══════════════════════════════════════════════════════════
   * RÉSOLUTION GÉO DES ACTEURS (paysId/villeId structurés)
   *
   * Alimente la "communauté" support d'un admin (paysAssigne/
   * villeAssignee/zoneId) — voir geo-resolution.service.ts pour le
   * détail. Réservé au super-admin.
   * ══════════════════════════════════════════════════════════ */

  /* GET /geo/resolve-actors/status — combien d'acteurs ont une ville
   * texte mais pas encore de villeId résolu (avant de lancer le recalcul). */
  @Get('resolve-actors/status')
  @Roles(UserRole.SUPER_ADMIN)
  getResolveActorsStatus() {
    return this.geoResolution.getUnresolvedCounts();
  }

  /* POST /geo/resolve-actors — recalcule paysId/villeId pour tous les
   * partenaires/entreprises/livreurs à partir de leurs champs ville/pays. */
  @Post('resolve-actors')
  @Roles(UserRole.SUPER_ADMIN)
  resolveActors() {
    return this.geoResolution.recomputeAllActors();
  }

  /* ══════════════════════════════════════════════════════════
   * ITEMS PUBLICS PAR NIVEAU — accessibles sans authentification
   * GET /geo/items?niveau=commune
   * ══════════════════════════════════════════════════════════ */
  @Get('items')
  @Public()
  @Roles()
  @ApiOperation({ summary: 'Items géographiques actifs par niveau (pays/region/prefecture/commune/quartier), optionnellement filtrés par parentId — route publique' })
  itemsByNiveau(@Query('niveau') niveau: string, @Query('parentId') parentId?: string) {
    const valid = ['pays', 'region', 'prefecture', 'commune', 'quartier'] as const;
    if (!valid.includes(niveau as any)) return [];
    return this.geo.itemsByNiveau(niveau as any, parentId);
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
   * FRAIS DE LIVRAISON RÉEL — accessible sans authentification
   * GET /geo/frais-livraison?ville=Kaloum
   *
   * BUG CORRIGÉ : le checkout affichait/facturait un tarif inventé
   * (celui saisi par le livreur lui-même, ou un mock) au lieu du vrai
   * tarif de zone défini par l'administrateur (permission "geo_zones",
   * accordée par le super-admin). Voir GeoService.resolveFraisLivraison().
   * ══════════════════════════════════════════════════════════ */
  @Get('frais-livraison')
  @Public()
  @Roles()
  @ApiOperation({ summary: 'Tarif de livraison réel (GeoZone.fraisLivraison) pour une destination — route publique' })
  getFraisLivraison(@Query('ville') ville?: string) {
    return this.geo.resolveFraisLivraison(ville);
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
   * JOURNAL D'AUDIT
   * GET /geo/audit?action=create&niveau=zone&search=matoto
   * ══════════════════════════════════════════════════════════ */
  @Get('audit')
  @ApiOperation({ summary: "Journal d'audit du référentiel géographique" })
  findAllAudit(
    @Query('action') action?: string,
    @Query('niveau') niveau?: string,
    @Query('search') search?: string,
  ) {
    return this.geo.findAllAudit({ action, niveau, search });
  }

  /* ══════════════════════════════════════════════════════════
   * IMPORT MASSIF
   * POST /geo/import/:niveau  { rows: GeoImportRowDto[] }
   * ══════════════════════════════════════════════════════════ */
  @Post('import/:niveau')
  @ApiOperation({ summary: 'Import massif CSV pour un niveau géographique donné' })
  importRows(@Param('niveau') niveau: string, @Body() dto: GeoImportDto, @Request() req: any) {
    if (!IMPORT_NIVEAUX.includes(niveau as GeoAuditNiveau)) {
      throw new BadRequestException(`niveau doit être une valeur parmi: ${IMPORT_NIVEAUX.join(', ')}`);
    }
    const a = actor(req);
    return this.geo.importRows(niveau as GeoAuditNiveau, dto.rows, a.email, a.userId, req.user.role);
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
  createPays(@Body() dto: CreateGeoItemDto, @Request() req: any) {
    const a = actor(req);
    return this.geo.createPays(dto, a.email, a.userId);
  }

  @Patch('pays/:id')
  updatePays(@Param('id') id: string, @Body() dto: CreateGeoItemDto, @Request() req: any) {
    return this.geo.updatePays(id, dto, req.user.role, req.user.id, actor(req).email);
  }

  @Delete('pays/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePays(@Param('id') id: string, @Request() req: any) {
    return this.geo.removePays(id, req.user.role, req.user.id, actor(req).email);
  }

  @Patch('pays/:id/toggle')
  togglePays(@Param('id') id: string, @Request() req: any) {
    return this.geo.togglePays(id, req.user.role, req.user.id, actor(req).email);
  }

  @Patch('pays/:id/delegation')
  @Roles(UserRole.SUPER_ADMIN)
  delegationPays(@Param('id') id: string, @Request() req: any) {
    const a = actor(req);
    return this.geo.toggleDelegationPays(id, a.email, a.userId);
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
  createRegion(@Body() dto: CreateGeoItemDto, @Request() req: any) {
    const a = actor(req);
    return this.geo.createRegion(dto, a.email, a.userId);
  }

  @Patch('regions/:id')
  updateRegion(@Param('id') id: string, @Body() dto: CreateGeoItemDto, @Request() req: any) {
    return this.geo.updateRegion(id, dto, req.user.role, req.user.id, actor(req).email);
  }

  @Delete('regions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeRegion(@Param('id') id: string, @Request() req: any) {
    return this.geo.removeRegion(id, req.user.role, req.user.id, actor(req).email);
  }

  @Patch('regions/:id/toggle')
  toggleRegion(@Param('id') id: string, @Request() req: any) {
    return this.geo.toggleRegion(id, req.user.role, req.user.id, actor(req).email);
  }

  @Patch('regions/:id/delegation')
  @Roles(UserRole.SUPER_ADMIN)
  delegationRegion(@Param('id') id: string, @Request() req: any) {
    const a = actor(req);
    return this.geo.toggleDelegationRegion(id, a.email, a.userId);
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
  createPrefecture(@Body() dto: CreateGeoItemDto, @Request() req: any) {
    const a = actor(req);
    return this.geo.createPrefecture(dto, a.email, a.userId);
  }

  @Patch('prefectures/:id')
  updatePrefecture(@Param('id') id: string, @Body() dto: CreateGeoItemDto, @Request() req: any) {
    return this.geo.updatePrefecture(id, dto, req.user.role, req.user.id, actor(req).email);
  }

  @Delete('prefectures/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePrefecture(@Param('id') id: string, @Request() req: any) {
    return this.geo.removePrefecture(id, req.user.role, req.user.id, actor(req).email);
  }

  @Patch('prefectures/:id/toggle')
  togglePrefecture(@Param('id') id: string, @Request() req: any) {
    return this.geo.togglePrefecture(id, req.user.role, req.user.id, actor(req).email);
  }

  @Patch('prefectures/:id/delegation')
  @Roles(UserRole.SUPER_ADMIN)
  delegationPrefecture(@Param('id') id: string, @Request() req: any) {
    const a = actor(req);
    return this.geo.toggleDelegationPrefecture(id, a.email, a.userId);
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
  createCommune(@Body() dto: CreateGeoItemDto, @Request() req: any) {
    const a = actor(req);
    return this.geo.createCommune(dto, a.email, a.userId);
  }

  @Patch('communes/:id')
  updateCommune(@Param('id') id: string, @Body() dto: CreateGeoItemDto, @Request() req: any) {
    return this.geo.updateCommune(id, dto, req.user.role, req.user.id, actor(req).email);
  }

  @Delete('communes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCommune(@Param('id') id: string, @Request() req: any) {
    return this.geo.removeCommune(id, req.user.role, req.user.id, actor(req).email);
  }

  @Patch('communes/:id/toggle')
  toggleCommune(@Param('id') id: string, @Request() req: any) {
    return this.geo.toggleCommune(id, req.user.role, req.user.id, actor(req).email);
  }

  @Patch('communes/:id/delegation')
  @Roles(UserRole.SUPER_ADMIN)
  delegationCommune(@Param('id') id: string, @Request() req: any) {
    const a = actor(req);
    return this.geo.toggleDelegationCommune(id, a.email, a.userId);
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
  createQuartier(@Body() dto: CreateGeoItemDto, @Request() req: any) {
    const a = actor(req);
    return this.geo.createQuartier(dto, a.email, a.userId);
  }

  @Patch('quartiers/:id')
  updateQuartier(@Param('id') id: string, @Body() dto: CreateGeoItemDto, @Request() req: any) {
    return this.geo.updateQuartier(id, dto, req.user.role, req.user.id, actor(req).email);
  }

  @Delete('quartiers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeQuartier(@Param('id') id: string, @Request() req: any) {
    return this.geo.removeQuartier(id, req.user.role, req.user.id, actor(req).email);
  }

  @Patch('quartiers/:id/toggle')
  toggleQuartier(@Param('id') id: string, @Request() req: any) {
    return this.geo.toggleQuartier(id, req.user.role, req.user.id, actor(req).email);
  }

  @Patch('quartiers/:id/delegation')
  @Roles(UserRole.SUPER_ADMIN)
  delegationQuartier(@Param('id') id: string, @Request() req: any) {
    const a = actor(req);
    return this.geo.toggleDelegationQuartier(id, a.email, a.userId);
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
  createZone(@Body() dto: CreateGeoItemDto, @Request() req: any) {
    const a = actor(req);
    return this.geo.createZone(dto, a.email, a.userId, req.user.role);
  }

  @Patch('zones/:id')
  updateZone(@Param('id') id: string, @Body() dto: CreateGeoItemDto, @Request() req: any) {
    return this.geo.updateZone(id, dto, req.user.role, req.user.id, actor(req).email);
  }

  @Delete('zones/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeZone(@Param('id') id: string, @Request() req: any) {
    return this.geo.removeZone(id, req.user.role, req.user.id, actor(req).email);
  }

  @Patch('zones/:id/toggle')
  toggleZone(@Param('id') id: string, @Request() req: any) {
    return this.geo.toggleZone(id, req.user.role, req.user.id, actor(req).email);
  }

  @Patch('zones/:id/delegation')
  @Roles(UserRole.SUPER_ADMIN)
  delegationZone(@Param('id') id: string, @Request() req: any) {
    const a = actor(req);
    return this.geo.toggleDelegationZone(id, a.email, a.userId);
  }
}
