/* ============================================================
 * FICHIER : src/modules/catalogue/catalogue.controller.ts
 *
 * CORRECTION :
 *   Le @UseGuards(JwtAuthGuard) était sur la classe entière
 *   → toutes les routes étaient protégées → 401 sur /company-types
 *     lors de l'inscription (utilisateur non connecté).
 *
 *   Fix : @UseGuards(JwtAuthGuard) retiré de la classe.
 *         Ajouté uniquement sur les routes qui nécessitent
 *         une authentification (mutations SUPER_ADMIN).
 *
 *   Routes publiques (sans token) :
 *     GET /company-types                      ← inscription entreprise
 *     GET /company-types/:id
 *     GET /company-types/:typeId/categories
 *     GET /categories
 *     GET /categories/:id
 *     GET /categories/:id/sub-categories
 *
 *   Routes protégées (token + SUPER_ADMIN) :
 *     POST/PATCH/DELETE /company-types
 *     POST/PATCH/DELETE /categories
 *     POST/PATCH/DELETE /sub-categories
 * ============================================================ */

import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import {
  IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional,
  IsString, IsUUID, MaxLength, Min,
} from 'class-validator';
import { Type }                             from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { JwtAuthGuard } from 'src/common/guards/auth.guard';
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-jwt.guard';
import { RolesGuard }   from 'src/common/guards/roles.guard';
import { Roles }        from 'src/common/decorators/roles.decorator';
import { UserRole }     from 'src/common/enums/user-role.enum';
import { CompanyTypeNature } from 'src/database/entities/entreprise.table/company-type.entity';

import {
  CompanyTypesService,
  CompanyTypeResponse,
} from '../dashboard/super-admin/categories/company-types.service';

import {
  CategoriesService,
  CategoryResponse,
  SubCategoryResponse,
} from '../dashboard/super-admin/categories/categories.service';

import { CatalogueAffinityService } from './catalogue-affinity.service';

// ══════════════════════════════════════════════════════════════
// DTOs — TYPES D'ENTREPRISE
// ══════════════════════════════════════════════════════════════

export class CreateCompanyTypeDto {
  @ApiProperty({ example: 'boutique-high-tech' })
  @IsString() @IsNotEmpty() @MaxLength(60)
  slug: string;

  @ApiProperty({ example: 'Boutique High-Tech' })
  @IsString() @IsNotEmpty() @MaxLength(120)
  nom: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '🏪' })
  @IsOptional() @IsString() @MaxLength(50)
  icone?: string;

  @ApiPropertyOptional({ description: "URL de l'image (Cloudinary) — vide pour retirer" })
  @IsOptional() @IsString() @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({ example: '#059669' })
  @IsOptional() @IsString() @MaxLength(7)
  couleur?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  ordre?: number;

  @ApiPropertyOptional({ enum: CompanyTypeNature, description: "Filtre le sélecteur de type à l'inscription selon le modèle économique choisi." })
  @IsOptional() @IsEnum(CompanyTypeNature)
  nature?: CompanyTypeNature;
}

export class UpdateCompanyTypeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(60)
  slug?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120)
  nom?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  icone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(7)
  couleur?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  ordre?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  actif?: boolean;

  @ApiPropertyOptional({ enum: CompanyTypeNature })
  @IsOptional() @IsEnum(CompanyTypeNature)
  nature?: CompanyTypeNature;
}

// ══════════════════════════════════════════════════════════════
// DTOs — CATÉGORIES
// ══════════════════════════════════════════════════════════════

export class CreateCategoryDto {
  @ApiProperty({ example: 'Électronique' })
  @IsString() @IsNotEmpty() @MaxLength(100)
  nom: string;

  @ApiProperty({ example: 'electronique' })
  @IsString() @IsNotEmpty() @MaxLength(100)
  slug: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  icone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({ example: '#059669' })
  @IsOptional() @IsString() @MaxLength(7)
  couleur?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  description?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  ordre?: number;

  @ApiPropertyOptional() @IsOptional() @IsUUID('all')
  companyTypeId?: string;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100)
  nom?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  icone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(7)
  couleur?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  description?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  ordre?: number;

  @ApiPropertyOptional() @IsOptional() @IsUUID('all')
  companyTypeId?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  actif?: boolean;
}

// ══════════════════════════════════════════════════════════════
// DTOs — SOUS-CATÉGORIES
// ══════════════════════════════════════════════════════════════

export class CreateSubCategoryDto {
  @ApiProperty({ example: 'Smartphones Android' })
  @IsString() @IsNotEmpty() @MaxLength(100)
  nom: string;

  @ApiProperty({ example: 'smartphones-android' })
  @IsString() @IsNotEmpty() @MaxLength(100)
  slug: string;

  @ApiProperty({ description: 'UUID de la catégorie parente' })
  @IsUUID('all', { message: 'categoryId doit être un UUID valide.' })
  categoryId: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  icone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  description?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  ordre?: number;
}

export class UpdateSubCategoryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100)
  nom?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID('all')
  categoryId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  icone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  description?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  ordre?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  actif?: boolean;
}

// ══════════════════════════════════════════════════════════════
// CONTROLLER
// ══════════════════════════════════════════════════════════════

@ApiTags('Catalogue')
@Controller()
// ✅ @UseGuards(JwtAuthGuard) RETIRÉ de la classe
// → les routes GET sont publiques (accessibles sans token)
// → le guard est appliqué uniquement sur les mutations
export class CatalogueController {

  constructor(
    private readonly companyTypesService: CompanyTypesService,
    private readonly categoriesService:   CategoriesService,
    private readonly affinityService:     CatalogueAffinityService,
  ) {}

  /** userId JWT (undefined si visiteur anonyme, voir OptionalJwtAuthGuard). */
  private userIdFromReq(req: Request): string | undefined {
    const u = (req as any).user;
    return u?.userId ?? u?.id ?? undefined;
  }

  /** BUG ÉVITÉ — ces mêmes routes GET publiques sont aussi utilisées par
   *  CatalogueTab.tsx (super-admin) pour LISTER le catalogue à gérer/
   *  réordonner (@ordre) : un super-admin, une entreprise, etc. n'ont
   *  aucun profil Client, donc affinityService.resolveClientId() renvoie
   *  toujours null pour eux — les traiter comme "anonyme" aurait mélangé
   *  aléatoirement la liste d'administration à chaque rechargement.
   *  Seuls un VRAI rôle client (personnalisé) et un visiteur SANS TOKEN
   *  du tout (mélangé, pour varier l'affichage) sortent de l'ordre admin
   *  d'origine — tout autre rôle connecté le conserve tel quel. */
  private async personalizeList<T>(
    req: Request, items: T[], getId: (item: T) => string, dimension: Parameters<CatalogueAffinityService['scoreByDimension']>[1],
  ): Promise<T[]> {
    const user = (req as any).user;
    if (!user) return CatalogueAffinityService.shuffle(items);
    if (user.role !== UserRole.CLIENT) return items;

    const clientId = await this.affinityService.resolveClientId(this.userIdFromReq(req));
    if (!clientId) return items; // opt-out perso, ou profil client introuvable → ordre stable

    const scores = await this.affinityService.scoreByDimension(clientId, dimension);
    return this.affinityService.personalize(items, getId, scores);
  }

  // ── Types d'entreprise — LECTURE PUBLIQUE ─────────────────────
  // Pas de @UseGuards → accessible sans token
  // Utilisé lors de l'inscription d'une entreprise

  @ApiOperation({ summary: "Lister tous les types d'entreprise — ordre personnalisé selon les goûts du client connecté (repli aléatoire sinon)" })
  @ApiQuery({ name: 'nature', required: false, enum: CompanyTypeNature, description: "Filtre selon le modèle économique choisi à l'inscription (un type 'neutral' est toujours inclus)." })
  @Get('company-types')
  @UseGuards(OptionalJwtAuthGuard)
  async findAllTypes(@Req() req: Request, @Query('nature') nature?: CompanyTypeNature): Promise<CompanyTypeResponse[]> {
    const types = await this.companyTypesService.findAll(nature);
    return this.personalizeList(req, types, t => t.id, 'companyType');
  }

  @ApiOperation({ summary: "Récupérer un type d'entreprise par ID" })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @Get('company-types/:id')
  findOneType(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CompanyTypeResponse> {
    return this.companyTypesService.findOne(id);
  }

  @ApiOperation({ summary: "Lister les catégories d'un type — ordre personnalisé selon les goûts du client connecté (repli aléatoire sinon)" })
  @ApiParam({ name: 'typeId', type: 'string', format: 'uuid' })
  @Get('company-types/:typeId/categories')
  @UseGuards(OptionalJwtAuthGuard)
  async findCategoriesByType(
    @Req() req: Request,
    @Param('typeId', ParseUUIDPipe) typeId: string,
  ): Promise<CategoryResponse[]> {
    const categories = await this.categoriesService.findAllByType(typeId);
    return this.personalizeCategories(req, categories);
  }

  // ── Types d'entreprise — MUTATIONS (token + SUPER_ADMIN) ───────

  @ApiOperation({ summary: "Créer un type d'entreprise" })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post('company-types')
  createType(@Body() body: CreateCompanyTypeDto): Promise<CompanyTypeResponse> {
    return this.companyTypesService.create(body);
  }

  @ApiOperation({ summary: "Modifier un type d'entreprise" })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Patch('company-types/:id')
  updateType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCompanyTypeDto,
  ): Promise<CompanyTypeResponse> {
    return this.companyTypesService.update(id, body);
  }

  @ApiOperation({ summary: "Supprimer un type d'entreprise" })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @Delete('company-types/:id')
  removeType(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string; catsMisesAJour: number }> {
    return this.companyTypesService.remove(id);
  }

  // ── Catégories — LECTURE PUBLIQUE ─────────────────────────────

  @ApiOperation({ summary: 'Lister toutes les catégories — ordre personnalisé selon les goûts du client connecté (repli aléatoire sinon)' })
  @Get('categories')
  @UseGuards(OptionalJwtAuthGuard)
  async findAllCategories(@Req() req: Request): Promise<CategoryResponse[]> {
    const categories = await this.categoriesService.findAll();
    return this.personalizeCategories(req, categories);
  }

  @ApiOperation({ summary: 'Récupérer une catégorie par ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @Get('categories/:id')
  findOneCategory(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CategoryResponse> {
    return this.categoriesService.findOne(id);
  }

  @ApiOperation({ summary: "Lister les sous-catégories d'une catégorie — ordre personnalisé selon les goûts du client connecté (repli aléatoire sinon)" })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @Get('categories/:id/sub-categories')
  @UseGuards(OptionalJwtAuthGuard)
  async findSubCats(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SubCategoryResponse[]> {
    const subCats = await this.categoriesService.findSubCatsByCategory(id);
    return this.personalizeList(req, subCats, s => s.id, 'subCategory');
  }

  /** Réordonne une liste de catégories ET, pour chacune, ses
   *  sous-catégories nichées — factorisé car réutilisé par
   *  findAllCategories() et findCategoriesByType(). Ne recalcule PAS
   *  resolveClientId/scoreByDimension une fois par catégorie (N+1) :
   *  résolus une seule fois puis appliqués à chaque sous-liste. */
  private async personalizeCategories(req: Request, categories: CategoryResponse[]): Promise<CategoryResponse[]> {
    const user = (req as any).user;

    if (!user) {
      return CatalogueAffinityService.shuffle(categories).map(c => ({
        ...c,
        subCategories: CatalogueAffinityService.shuffle(c.subCategories),
      }));
    }
    if (user.role !== UserRole.CLIENT) return categories; // admin/entreprise… : ordre stable

    const clientId = await this.affinityService.resolveClientId(this.userIdFromReq(req));
    if (!clientId) return categories; // opt-out perso, ou profil client introuvable

    const [catScores, subScores] = await Promise.all([
      this.affinityService.scoreByDimension(clientId, 'category'),
      this.affinityService.scoreByDimension(clientId, 'subCategory'),
    ]);

    const ranked = this.affinityService.personalize(categories, c => c.id, catScores);
    return ranked.map(c => ({
      ...c,
      subCategories: this.affinityService.personalize(c.subCategories, s => s.id, subScores),
    }));
  }

  // ── Catégories — MUTATIONS (token + SUPER_ADMIN) ──────────────

  @ApiOperation({ summary: 'Créer une catégorie' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post('categories')
  createCategory(@Body() body: CreateCategoryDto): Promise<CategoryResponse> {
    return this.categoriesService.create({
      nom:           body.nom,
      slug:          body.slug,
      icone:         body.icone,
      imageUrl:      body.imageUrl,
      couleur:       body.couleur,
      description:   body.description,
      ordre:         body.ordre,
      companyTypeId: body.companyTypeId,
    });
  }

  @ApiOperation({ summary: 'Modifier une catégorie' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Patch('categories/:id')
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCategoryDto,
  ): Promise<CategoryResponse> {
    return this.categoriesService.update(id, {
      nom:           body.nom,
      slug:          body.slug,
      icone:         body.icone,
      imageUrl:      body.imageUrl,
      couleur:       body.couleur,
      description:   body.description,
      ordre:         body.ordre,
      companyTypeId: body.companyTypeId,
      actif:         body.actif,
    });
  }

  @ApiOperation({ summary: 'Supprimer une catégorie' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @Delete('categories/:id')
  removeCategory(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string; subsSupprimees: number }> {
    return this.categoriesService.remove(id);
  }

  // ── Sous-catégories — MUTATIONS (token + SUPER_ADMIN) ─────────

  @ApiOperation({ summary: 'Créer une sous-catégorie' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post('sub-categories')
  createSubCategory(@Body() body: CreateSubCategoryDto): Promise<SubCategoryResponse> {
    return this.categoriesService.createSubCategory({
      nom:         body.nom,
      slug:        body.slug,
      categoryId:  body.categoryId,
      icone:       body.icone,
      imageUrl:      body.imageUrl,
      description: body.description,
      ordre:       body.ordre,
    });
  }

  @ApiOperation({ summary: 'Modifier une sous-catégorie' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Patch('sub-categories/:id')
  updateSubCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateSubCategoryDto,
  ): Promise<SubCategoryResponse> {
    return this.categoriesService.updateSubCategory(id, {
      nom:         body.nom,
      slug:        body.slug,
      categoryId:  body.categoryId,
      icone:       body.icone,
      imageUrl:      body.imageUrl,
      description: body.description,
      ordre:       body.ordre,
      actif:       body.actif,
    });
  }

  @ApiOperation({ summary: 'Supprimer une sous-catégorie' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @Delete('sub-categories/:id')
  removeSubCategory(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    return this.categoriesService.removeSubCategory(id);
  }
}