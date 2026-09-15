/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/prestations/prestations.controller.ts
 * RÔLE    : Routes CRUD des prestations de service — miroir de
 *           produits.controller.ts, sans stories (hors scope Service).
 * ============================================================ */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { PrestationsService } from './prestations.service';
import {
  CreateServiceDto,
  FilterServicesDto,
  UpdateServiceDto,
} from './dto/create-service.dto';

import { JwtAuthGuard }       from 'src/common/guards/auth.guard';
import { RolesGuard }         from 'src/common/guards/roles.guard';
import { Roles, CurrentUser } from 'src/common/decorators/roles.decorator';
import { User }     from 'src/database/entities/user.entity';
import { UserRole } from 'src/common/enums/user-role.enum';
import { TeamPermissionGuard }    from 'src/modules/company-team/guards/team-permission.guard';
import { RequiresTeamPermission } from 'src/modules/company-team/decorators/requires-team-permission.decorator';

@ApiTags('🛠️ Prestations de service')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('prestations')
export class PrestationsController {

  constructor(private readonly prestationsService: PrestationsService) {}

  // ── POST /prestations ───────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.COMPANY, UserRole.SUPER_ADMIN)
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('services', 'create')
  @ApiOperation({ summary: 'Créer une nouvelle prestation de service' })
  @ApiResponse({ status: 201, description: 'Prestation créée.' })
  @ApiResponse({ status: 400, description: 'Données invalides ou catégorie hors type.' })
  @ApiResponse({ status: 403, description: "Compte non enregistré comme prestataire de services." })
  @ApiResponse({ status: 409, description: 'URL slug déjà utilisé.' })
  create(
    @Body() dto: CreateServiceDto,
    @CurrentUser() user: User,
  ) {
    return this.prestationsService.createService(dto, user);
  }

  // ── GET /prestations/check-slug ─────────────────────────────────
  // ⚠️ Déclaré avant /:id

  @Get('check-slug')
  @Roles(UserRole.COMPANY, UserRole.SUPER_ADMIN)
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('services', 'view')
  @ApiOperation({ summary: "Vérifier la disponibilité d'un URL slug" })
  @ApiQuery({ name: 'slug',      required: true })
  @ApiQuery({ name: 'excludeId', required: false })
  checkSlug(
    @Query('slug')      slug:      string,
    @Query('excludeId') excludeId: string | undefined,
  ) {
    return this.prestationsService.checkSlugUnique(slug, excludeId);
  }

  // ── GET /prestations/categories ─────────────────────────────────
  // ⚠️ Déclarée avant /:id

  @Get('categories')
  @Roles(UserRole.COMPANY, UserRole.SUPER_ADMIN)
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('services', 'view')
  @ApiOperation({
    summary: 'Catégories disponibles pour cette entreprise',
    description:
      "Retourne les catégories filtrées selon le type d'entreprise du compte connecté. " +
      'Inclut aussi les catégories génériques (sans type assigné).',
  })
  @ApiResponse({ status: 200, description: 'Liste des catégories + leurs sous-catégories.' })
  @ApiResponse({ status: 404, description: 'Profil entreprise introuvable.' })
  getCategoriesPourEntreprise(
    @CurrentUser() user: User,
  ) {
    return this.prestationsService.getCategoriesPourEntreprise(user);
  }

  // ── GET /prestations ────────────────────────────────────────────

  @Get()
  @Roles(UserRole.COMPANY, UserRole.SUPER_ADMIN)
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('services', 'view')
  @ApiOperation({ summary: 'Lister les prestations (paginé + filtres)' })
  list(
    @Query() dto: FilterServicesDto,
    @CurrentUser() user: User,
  ) {
    return this.prestationsService.listServices(dto, user);
  }

  // ── GET /prestations/:id ────────────────────────────────────────

  @Get(':id')
  @Roles(UserRole.COMPANY, UserRole.SUPER_ADMIN)
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('services', 'view')
  @ApiOperation({ summary: "Récupérer le détail complet d'une prestation" })
  @ApiParam({ name: 'id', description: 'UUID de la prestation' })
  @ApiResponse({ status: 404, description: 'Prestation introuvable.' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.prestationsService.getService(id, user);
  }

  // ── PATCH /prestations/:id ──────────────────────────────────────

  @Patch(':id')
  @Roles(UserRole.COMPANY, UserRole.SUPER_ADMIN)
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('services', 'edit')
  @ApiOperation({ summary: 'Modifier une prestation existante' })
  @ApiParam({ name: 'id', description: 'UUID de la prestation' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() user: User,
  ) {
    return this.prestationsService.updateService(id, dto, user);
  }

  // ── PATCH /prestations/:id/publish ──────────────────────────────

  @Patch(':id/publish')
  @Roles(UserRole.COMPANY, UserRole.SUPER_ADMIN)
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('services', 'edit')
  @ApiOperation({ summary: 'Publier une prestation (draft → public)' })
  @ApiParam({ name: 'id', description: 'UUID de la prestation' })
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.prestationsService.publishService(id, user);
  }

  // ── PATCH /prestations/:id/archive ──────────────────────────────

  @Patch(':id/archive')
  @Roles(UserRole.COMPANY, UserRole.SUPER_ADMIN)
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('services', 'edit')
  @ApiOperation({ summary: 'Archiver une prestation (public → private)' })
  @ApiParam({ name: 'id', description: 'UUID de la prestation' })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.prestationsService.archiveService(id, user);
  }

  // ── DELETE /prestations/:id ─────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.COMPANY, UserRole.SUPER_ADMIN)
  @UseGuards(TeamPermissionGuard)
  @RequiresTeamPermission('services', 'delete')
  @ApiOperation({ summary: 'Supprimer définitivement une prestation' })
  @ApiParam({ name: 'id', description: 'UUID de la prestation' })
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.prestationsService.deleteService(id, user);
  }
}
