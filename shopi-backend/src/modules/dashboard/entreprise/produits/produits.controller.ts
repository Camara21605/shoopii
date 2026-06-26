/* ============================================================
 * FICHIER : src/modules/produits/produits.controller.ts
 *
 * CORRECTION :
 *   Ajout de GET /produits/categories
 *   → Retourne les catégories filtrées selon le type de
 *     l'entreprise connectée
 *   → Déclarée AVANT GET /produits/:id (obligatoire)
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

import { ProduitsService }   from './produits.service';
import {
  CreateProductDto,
  FilterProductsDto,
  UpdateProductDto,
} from './dto/create-product.dto';

import { JwtAuthGuard }       from 'src/common/guards/auth.guard';
import { RolesGuard }         from 'src/common/guards/roles.guard';
import { Roles, CurrentUser } from 'src/common/decorators/roles.decorator';
import { User }     from 'src/database/entities/user.entity';
import { UserRole } from 'src/common/enums/user-role.enum';

@ApiTags('🛍️ Produits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('produits')
export class ProduitsController {

  constructor(private readonly produitsService: ProduitsService) {}

  // ── POST /produits ────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.COMPANY, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Créer un nouveau produit' })
  @ApiResponse({ status: 201, description: 'Produit créé.' })
  @ApiResponse({ status: 400, description: 'Données invalides ou catégorie hors type.' })
  @ApiResponse({ status: 409, description: 'URL slug déjà utilisé.' })
  create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: User,
  ) {
    return this.produitsService.createProduct(dto, user);
  }

  // ── GET /produits/check-slug ──────────────────────────────────
  // ⚠️ Déclaré avant /:id → NestJS ne confond pas 'check-slug' avec un UUID

  @Get('check-slug')
  @Roles(UserRole.COMPANY, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Vérifier la disponibilité d\'un URL slug' })
  @ApiQuery({ name: 'slug',      required: true })
  @ApiQuery({ name: 'excludeId', required: false })
  checkSlug(
    @Query('slug')      slug:      string,
    @Query('excludeId') excludeId: string | undefined,
  ) {
    return this.produitsService.checkSlugUnique(slug, excludeId);
  }

  // ── GET /produits/categories ──────────────────────────────────
  // ✅ NOUVELLE ROUTE — déclarée avant /:id
  // Retourne uniquement les catégories du type de l'entreprise connectée.
  // Appelée par AjouterPage.tsx pour peupler le sélecteur de catégorie.

  @Get('categories')
  @Roles(UserRole.COMPANY, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Catégories disponibles pour cette entreprise',
    description:
      'Retourne les catégories filtrées selon le type d\'entreprise du compte connecté. ' +
      'Inclut aussi les catégories génériques (sans type assigné).',
  })
  @ApiResponse({ status: 200, description: 'Liste des catégories + leurs sous-catégories.' })
  @ApiResponse({ status: 404, description: 'Profil entreprise introuvable.' })
  getCategoriesPourEntreprise(
    @CurrentUser() user: User,
  ) {
    return this.produitsService.getCategoriesPourEntreprise(user);
  }

  // ── GET /produits ─────────────────────────────────────────────

  @Get()
  @Roles(UserRole.COMPANY, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Lister les produits (paginé + filtres)' })
  list(
    @Query() dto: FilterProductsDto,
    @CurrentUser() user: User,
  ) {
    return this.produitsService.listProducts(dto, user);
  }

  // ── GET /produits/:id ─────────────────────────────────────────

  @Get(':id')
  @Roles(UserRole.COMPANY, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Récupérer le détail complet d\'un produit' })
  @ApiParam({ name: 'id', description: 'UUID du produit' })
  @ApiResponse({ status: 404, description: 'Produit introuvable.' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.produitsService.getProduct(id, user);
  }

  // ── GET /produits/:id/stats ───────────────────────────────────

  @Get(':id/stats')
  @Roles(UserRole.COMPANY, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Statistiques d\'un produit' })
  @ApiParam({ name: 'id', description: 'UUID du produit' })
  stats(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.produitsService.getProductStats(id, user);
  }

  // ── PATCH /produits/:id ───────────────────────────────────────

  @Patch(':id')
  @Roles(UserRole.COMPANY, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Modifier un produit existant' })
  @ApiParam({ name: 'id', description: 'UUID du produit' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: User,
  ) {
    return this.produitsService.updateProduct(id, dto, user);
  }

  // ── PATCH /produits/:id/publish ───────────────────────────────

  @Patch(':id/publish')
  @Roles(UserRole.COMPANY, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Publier un produit (draft → public)' })
  @ApiParam({ name: 'id', description: 'UUID du produit' })
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.produitsService.publishProduct(id, user);
  }

  // ── PATCH /produits/:id/archive ───────────────────────────────

  @Patch(':id/archive')
  @Roles(UserRole.COMPANY, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Archiver un produit (public → private)' })
  @ApiParam({ name: 'id', description: 'UUID du produit' })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.produitsService.archiveProduct(id, user);
  }

  // ── DELETE /produits/:id ──────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.COMPANY, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Supprimer définitivement un produit' })
  @ApiParam({ name: 'id', description: 'UUID du produit' })
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.produitsService.deleteProduct(id, user);
  }
}