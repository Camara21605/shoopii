/* ============================================================
 * FICHIER : src/modules/public/public.controller.ts
 * ✅ AJOUT : GET /public/produits/:id/similaires
 * ============================================================ */

import {
  Controller, Get, Param, ParseUUIDPipe, Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PublicService } from './public.service';

@ApiTags('Public')
@Controller('public')
export class PublicController {

  constructor(private readonly publicService: PublicService) {}

  @Get('produits')
  @ApiOperation({ summary: 'Produits publics paginés' })
  @ApiQuery({ name: 'page',       required: false })
  @ApiQuery({ name: 'limit',      required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'search',     required: false })
  listProduits(
    @Query('page')       page?:       string,
    @Query('limit')      limit?:      string,
    @Query('categoryId') categoryId?: string,
    @Query('search')     search?:     string,
  ) {
    return this.publicService.listProduits({
      page:  page  ? parseInt(page)  : 1,
      limit: limit ? parseInt(limit) : 20,
      categoryId, search,
    });
  }

  @Get('produits/:id')
  @ApiOperation({ summary: 'Détail produit public' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  getProduit(@Param('id', ParseUUIDPipe) id: string) {
    return this.publicService.getProduit(id);
  }

  /* ✅ NOUVEAU — placé AVANT :id pour ne pas être capturé par getProduit */
  @Get('produits/:id/similaires')
  @ApiOperation({ summary: 'Produits similaires (même catégorie)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'limit', required: false })
  getSimilaires(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
  ) {
    return this.publicService.getSimilaires(id, limit ? parseInt(limit) : 5);
  }

  @Get('boutiques')
  @ApiOperation({ summary: 'Liste des boutiques actives' })
  @ApiQuery({ name: 'page',   required: false })
  @ApiQuery({ name: 'limit',  required: false })
  @ApiQuery({ name: 'search', required: false })
  listBoutiques(
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
    @Query('search') search?: string,
  ) {
    return this.publicService.listBoutiques({
      page:  page  ? parseInt(page)  : 1,
      limit: limit ? parseInt(limit) : 12,
      search,
    });
  }

  @Get('boutiques/:id')
  @ApiOperation({ summary: 'Détail boutique' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  getBoutique(@Param('id', ParseUUIDPipe) id: string) {
    return this.publicService.getBoutique(id);
  }

  @Get('boutiques/:id/produits')
  @ApiOperation({ summary: "Produits publics d'une boutique" })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'page',       required: false })
  @ApiQuery({ name: 'limit',      required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'search',     required: false })
  getBoutiqueProduits(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page')       page?:       string,
    @Query('limit')      limit?:      string,
    @Query('categoryId') categoryId?: string,
    @Query('search')     search?:     string,
  ) {
    return this.publicService.getBoutiqueProduits(id, {
      page:  page  ? parseInt(page)  : 1,
      limit: limit ? parseInt(limit) : 20,
      categoryId, search,
    });
  }

  @Get('boutiques/:id/livreurs')
  @ApiOperation({ summary: "Livreurs d'une boutique" })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  getBoutiqueLivreurs(@Param('id', ParseUUIDPipe) id: string) {
    return this.publicService.getBoutiqueLivreurs(id);
  }

  @Get('boutiques/:id/avis')
  @ApiOperation({ summary: "Avis clients d'une boutique — note globale + liste" })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  getBoutiqueAvis(@Param('id', ParseUUIDPipe) id: string) {
    return this.publicService.getBoutiqueAvis(id);
  }

  @Get('boutiques/:id/promotions')
  @ApiOperation({ summary: "Promotions actives d'une boutique" })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  getBoutiquePromotions(@Param('id', ParseUUIDPipe) id: string) {
    return this.publicService.getBoutiquePromotions(id);
  }

  @Get('boutiques/:id/stories')
  @ApiOperation({ summary: "Stories actives d'une boutique (non expirées)" })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  getBoutiqueStories(@Param('id', ParseUUIDPipe) id: string) {
    return this.publicService.getBoutiqueStories(id);
  }

  @Get('stories')
  @ApiOperation({ summary: 'Stories actives de toutes les boutiques — page d\'accueil (max 15 boutiques × 4 slides)' })
  getHomeStories() {
    return this.publicService.getHomeStories();
  }
}