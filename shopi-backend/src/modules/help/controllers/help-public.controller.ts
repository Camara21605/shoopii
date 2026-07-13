/* ============================================================
 * FICHIER            : src/modules/help/controllers/help-public.controller.ts
 * RÔLE               : Endpoints publics du Centre d'aide (sans authentification).
 * RESPONSABILITES    : Servir les catégories, articles, FAQ et recherche
 *                      à tous les visiteurs (utilisateurs connectés ou non).
 *                      Protéger contre les abus via des bornes strictes
 *                      sur les paramètres de pagination.
 * DEPENDANCES        : HelpCategoryService, HelpArticleService,
 *                      HelpSearchService, HelpFaqService, SearchHelpDto
 * AUTEUR             : Shopi03
 * DERNIERE MISE A JOUR: 2026-07-03
 *
 * SECURITE :
 *   Les paramètres page et limit sont bornés (1 ≤ page, 1 ≤ limit ≤ 50)
 *   afin de prévenir les attaques DoS par requête géante (limit=999999).
 *   La recherche passe par SearchHelpDto validé (class-validator).
 * ============================================================ */
import {
  Controller, Get, Post, Param, Query, Body,
  UseGuards, Request, Optional,
} from '@nestjs/common';
import { JwtAuthGuard }      from '../../../common/guards/auth.guard';
import { HelpCategoryService } from '../services/help-category.service';
import { HelpArticleService }  from '../services/help-article.service';
import { HelpSearchService }   from '../services/help-search.service';
import { HelpFaqService }      from '../services/help-faq.service';
import { SearchHelpDto, ArticleFeedbackDto } from '../dto/help.dto';

/** Borne les entiers de pagination pour prévenir les requêtes géantes. */
function parsePaginationParam(raw: string | undefined, def: number, max: number): number {
  const n = parseInt(raw ?? String(def), 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, 1), max);
}

@Controller('help')
export class HelpPublicController {

  constructor(
    private readonly categories: HelpCategoryService,
    private readonly articles:   HelpArticleService,
    private readonly search:     HelpSearchService,
    private readonly faq:        HelpFaqService,
  ) {}

  /* ── Catégories ── */

  @Get('categories')
  getCategories(@Query('audience') audience?: string) {
    return this.categories.findAll(audience);
  }

  @Get('categories/:slug')
  getCategoryBySlug(@Param('slug') slug: string, @Query('audience') audience?: string) {
    return this.categories.findBySlug(slug, audience);
  }

  /* ── Articles ── */

  @Get('articles')
  getArticles(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('audience') audience?: string,
  ) {
    return this.articles.findPublished(
      parsePaginationParam(page,  1,  1000),  // page sans borne haute raisonnable
      parsePaginationParam(limit, 20, 50),    // max 50 articles par page
      audience,
    );
  }

  @Get('popular')
  getPopular(@Query('limit') limit?: string) {
    return this.articles.findPopular(parsePaginationParam(limit, 10, 50));
  }

  @Get('articles/:slug')
  getArticle(@Param('slug') slug: string) {
    return this.articles.findBySlug(slug);
  }

  @Post('articles/:slug/feedback')
  submitFeedback(@Param('slug') slug: string, @Body() dto: ArticleFeedbackDto) {
    return this.articles.submitFeedback(slug, dto.helpful);
  }

  /* ── Recherche ── */

  @Get('search')
  searchArticles(@Query() dto: SearchHelpDto) {
    return this.search.search(
      dto.q ?? '',
      dto.categoryId,
      dto.audience,
      dto.page ?? 1,
      dto.limit ?? 20,
    );
  }

  /* ── FAQ ── */

  @Get('faq')
  getFaq(@Query('audience') audience?: string) {
    return this.faq.findAll(audience);
  }

  @Get('faq/:category')
  getFaqByCategory(@Param('category') slug: string, @Query('audience') audience?: string) {
    return this.faq.findByCategory(slug, audience);
  }
}
