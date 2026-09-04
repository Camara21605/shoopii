/* ============================================================
 * FICHIER : src/modules/explore/explore.controller.ts
 *
 * RÔLE : Endpoints de l'onglet Explorer (home client).
 *        Suit exactement le style de public.controller.ts :
 *        @Query('x') un par un, parsing manuel dans le contrôleur,
 *        pas de DTO class-validator (réservés aux bodies POST/PATCH
 *        ailleurs dans le projet — ex. create-product.dto.ts).
 *
 * Monté sous /public/explore/* (et non /products/explore) pour :
 *   - rester dans le namespace /public/* déjà établi pour tout ce
 *     qui est navigation produit publique (produits, boutiques...)
 *   - éviter toute collision avec la route existante
 *     GET /public/produits/:id (où "explore" serait capturé comme
 *     un :id si on avait choisi /public/produits/explore).
 * ============================================================ */

import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiQuery, ApiParam, ApiTags } from '@nestjs/swagger';
import { ExploreService } from './explore.service';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';

@ApiTags('Explore')
@Controller('public/explore')
export class ExploreController {

  constructor(private readonly exploreService: ExploreService) {}

  @Get()
  @ApiOperation({ summary: 'Grille principale Explorer — recherche + filtres + pagination' })
  @ApiQuery({ name: 'page',     required: false })
  @ApiQuery({ name: 'limit',    required: false })
  @ApiQuery({ name: 'search',   required: false })
  @ApiQuery({ name: 'category', required: false, description: 'UUID ou slug de catégorie' })
  @ApiQuery({ name: 'minPrice', required: false, description: 'Prix minimum en GNF' })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'Prix maximum en GNF' })
  @ApiQuery({ name: 'ville',    required: false, description: 'Filtre "Proches de vous" par ville de la boutique' })
  grid(
    @Query('page')     page?:     string,
    @Query('limit')    limit?:    string,
    @Query('search')   search?:   string,
    @Query('category') category?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('ville')    ville?:    string,
  ) {
    return this.exploreService.grid({
      page:     page  ? parseInt(page, 10)  : undefined,
      limit:    limit ? parseInt(limit, 10) : undefined,
      search,
      category,
      minPrice: minPrice != null ? Number(minPrice) : undefined,
      maxPrice: maxPrice != null ? Number(maxPrice) : undefined,
      ville,
    });
  }

  @Get('tendances')
  @ApiOperation({ summary: 'Produits tendance — lit le cache trending_products (recalculé toutes les heures)' })
  @ApiQuery({ name: 'limit', required: false })
  tendances(@Query('limit') limit?: string) {
    return this.exploreService.tendances(limit ? parseInt(limit, 10) : undefined);
  }

  @Get('nouveautes')
  @ApiOperation({ summary: 'Nouveaux produits — tri createdAt DESC' })
  @ApiQuery({ name: 'limit', required: false })
  nouveautes(@Query('limit') limit?: string) {
    return this.exploreService.nouveautes(limit ? parseInt(limit, 10) : undefined);
  }

  @Get('proches')
  @ApiOperation({ summary: 'Produits de boutiques proches — filtre par ville' })
  @ApiQuery({ name: 'ville', required: true })
  @ApiQuery({ name: 'limit', required: false })
  proches(
    @Query('ville') ville?: string,
    @Query('limit') limit?: string,
  ) {
    return this.exploreService.proches(ville, limit ? parseInt(limit, 10) : undefined);
  }

  @Get('pour-vous')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Recommandations personnalisées (likes + achats du client) — repli sur les tendances si non connecté ou perso désactivé' })
  @ApiQuery({ name: 'limit', required: false })
  pourVous(@Req() req: Request, @Query('limit') limit?: string) {
    const userId = (req as any).user?.id as string | undefined;
    return this.exploreService.pourVous(userId, limit ? parseInt(limit, 10) : undefined);
  }

  @Get(':id/souvent-achete-avec')
  @ApiOperation({ summary: 'Produits souvent achetés avec celui-ci — lit le cache product_cooccurrence' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'limit', required: false })
  souventAcheteAvec(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
  ) {
    return this.exploreService.souventAcheteAvec(id, limit ? parseInt(limit, 10) : undefined);
  }
}
