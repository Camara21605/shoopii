/* ============================================================
 * FICHIER : src/modules/public/public.controller.ts
 * ✅ AJOUT : GET /public/produits/:id/similaires
 * ============================================================ */

import {
  Controller, Get, Post, Param, ParseUUIDPipe, Query, Req, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
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
  @ApiQuery({ name: 'type',       required: false, description: 'detail | gros' })
  listProduits(
    @Query('page')       page?:       string,
    @Query('limit')      limit?:      string,
    @Query('categoryId') categoryId?: string,
    @Query('search')     search?:     string,
    @Query('type')       type?:       string,
  ) {
    return this.publicService.listProduits({
      page:  page  ? parseInt(page)  : 1,
      limit: limit ? parseInt(limit) : 20,
      categoryId, search, type,
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
  @ApiQuery({ name: 'page',          required: false })
  @ApiQuery({ name: 'limit',         required: false })
  @ApiQuery({ name: 'search',        required: false })
  @ApiQuery({ name: 'categoryId',    required: false })
  @ApiQuery({ name: 'subCategoryId', required: false })
  @ApiQuery({ name: 'companyTypeId', required: false })
  listBoutiques(
    @Query('page')          page?:          string,
    @Query('limit')         limit?:         string,
    @Query('search')        search?:        string,
    @Query('categoryId')    categoryId?:    string,
    @Query('subCategoryId') subCategoryId?: string,
    @Query('companyTypeId') companyTypeId?: string,
  ) {
    return this.publicService.listBoutiques({
      page:  page  ? parseInt(page)  : 1,
      limit: limit ? parseInt(limit) : 12,
      search, categoryId, subCategoryId, companyTypeId,
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

  @Get('boutiques/:id/correspondants')
  @ApiOperation({ summary: "Correspondants d'une boutique" })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  getBoutiqueCorrespondants(@Param('id', ParseUUIDPipe) id: string) {
    return this.publicService.getBoutiqueCorrespondants(id);
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
  @ApiOperation({ summary: "Stories actives d'une boutique (non expirées) — même format que GET /public/stories, filtré sur cette boutique" })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  getBoutiqueStories(@Param('id', ParseUUIDPipe) id: string) {
    return this.publicService.getHomeStories(id);
  }

  @Get('stories')
  @ApiOperation({ summary: 'Stories actives de toutes les boutiques — page d\'accueil (max 15 boutiques × 4 produits)' })
  getHomeStories() {
    return this.publicService.getHomeStories();
  }

  /* ─── POST /public/stories/:id/view — vue optionnelle (visiteur anonyme accepté) ─── */
  @Post('stories/:id/view')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Enregistre qu'un utilisateur connecté a vu cette story" })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async recordStoryView(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    const u = (req as any).user;
    await this.publicService.recordStoryView(id, u?.userId ?? u?.id);
  }

  /* ─── GET /public/stories/:id/viewers — réservé au propriétaire de la story ─── */
  @Get('stories/:id/viewers')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Liste des clients ayant vu cette story, avec leur éventuel ❤️ (propriétaire uniquement)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  getStoryViewers(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    const u = (req as any).user;
    return this.publicService.getStoryViewers(id, u?.userId ?? u?.id);
  }

  /* ─── POST /public/stories/:id/like — bascule le ❤️ (connexion requise) ─── */
  @Post('stories/:id/like')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "Bascule le \"j'aime\" d'un client sur cette story" })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  toggleStoryLike(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    const u = (req as any).user;
    return this.publicService.toggleStoryLike(id, u?.userId ?? u?.id);
  }
}