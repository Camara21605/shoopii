/* ============================================================
 * FICHIER  : src/modules/help/services/help-article.service.ts
 * ROLE     : CRUD et cycle de vie des articles du Centre d'aide.
 *
 * RESPONSABILITES :
 *   - Lister les articles publiés avec filtres d'audience et pagination.
 *   - Récupérer un article par son slug (incrément de vue async).
 *   - Gérer le cycle DRAFT → PUBLISHED → ARCHIVED.
 *   - Soft delete : l'article reste en base pour les liens partagés.
 *   - Mettre à jour le tsvector pour la recherche plein texte (FTS).
 *   - Fournir les analytics : top articles, requêtes sans résultats.
 *
 * DEPENDANCES :
 *   - HelpArticle     (InjectRepository)
 *   - HelpCategoryService (pour incrementArticleCount)
 *   - DataSource      (requête raw pour tsvector + analytics)
 *   - ArticleNotFoundException, ArticleSlugConflictException
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import {
  HelpArticle,
  HelpArticleStatus,
} from '../../../database/entities/help/help-article.entity';
import { HelpCategoryService } from './help-category.service';
import { CreateHelpArticleDto, UpdateHelpArticleDto } from '../dto/help.dto';

import {
  ArticleNotFoundException,
  ArticleSlugConflictException,
  ArticleCannotPublishException,
} from '../../../common/exceptions/help-center.exceptions';

@Injectable()
export class HelpArticleService {
  private readonly logger = new Logger(HelpArticleService.name);

  constructor(
    @InjectRepository(HelpArticle)
    private readonly artRepo: Repository<HelpArticle>,
    private readonly catService: HelpCategoryService,
    private readonly dataSource: DataSource,
  ) {}

  /* ── Côté public ─────────────────────────────────────────── */

  async findPublished(page = 1, limit = 20, audience?: string) {
    const qb = this.artRepo.createQueryBuilder('a')
      .leftJoinAndSelect('a.category', 'c')
      .where('a.status = :status', { status: HelpArticleStatus.PUBLISHED })
      .select(['a.id', 'a.slug', 'a.title', 'a.excerpt', 'a.viewCount', 'a.publishedAt', 'a.categoryId'])
      .addSelect(['c.name', 'c.slug', 'c.icon'])
      .orderBy('a.publishedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (audience && audience !== 'all') {
      qb.andWhere(
        `(a.audience IS NULL OR a.audience LIKE :all OR a.audience LIKE :aud)`,
        { all: '%all%', aud: `%${audience}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findBySlug(slug: string) {
    const article = await this.artRepo.findOne({
      where: { slug, status: HelpArticleStatus.PUBLISHED },
      relations: ['category'],
    });
    if (!article) throw new ArticleNotFoundException(slug);

    /* Incrément async : ne bloque pas la réponse, silencieux si erreur. */
    this.artRepo.increment({ id: article.id }, 'viewCount', 1).catch(() => {});
    return article;
  }

  async findPopular(limit = 10) {
    return this.artRepo.find({
      where: { status: HelpArticleStatus.PUBLISHED },
      select: ['id', 'slug', 'title', 'excerpt', 'viewCount', 'categoryId'],
      order: { viewCount: 'DESC' },
      take: limit,
    });
  }

  async submitFeedback(slug: string, helpful: boolean) {
    const article = await this.artRepo.findOne({ where: { slug } });
    if (!article) throw new ArticleNotFoundException(slug);

    const field = helpful ? 'helpfulCount' : 'notHelpfulCount';
    await this.artRepo.increment({ id: article.id }, field, 1);
    return { ok: true };
  }

  /* ── Côté admin ──────────────────────────────────────────── */

  /*
   * Filtres optionnels ajoutés pour supporter une vraie pagination côté
   * admin (HelpCenterSection.tsx) : sans ça, activer la pagination tout
   * en gardant le filtrage recherche/statut/catégorie côté frontend
   * aurait limité silencieusement ces filtres à la seule page chargée
   * (un article correspondant à la recherche mais situé page 3 restait
   * introuvable en étant sur la page 1).
   */
  async findAllAdmin(
    page = 1, limit = 30,
    search?: string, status?: HelpArticleStatus, categoryId?: string,
  ) {
    const qb = this.artRepo.createQueryBuilder('a')
      .select([
        'a.id', 'a.slug', 'a.title', 'a.status', 'a.categoryId', 'a.viewCount',
        'a.publishedAt', 'a.createdAt', 'a.helpfulCount', 'a.notHelpfulCount',
      ])
      .orderBy('a.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search)     qb.andWhere('a.title ILIKE :search', { search: `%${search}%` });
    if (status)     qb.andWhere('a.status = :status', { status });
    if (categoryId) qb.andWhere('a.categoryId = :categoryId', { categoryId });

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  /*
   * BUG CORRIGÉ — le formulaire d'édition admin (HelpCenterSection.tsx
   * openEdit) chargeait le contenu complet via GET /help/articles/:slug
   * (route PUBLIQUE, findBySlug ci-dessus), qui filtre status:PUBLISHED.
   * Un article vient toujours de naître en DRAFT (voir create()) : tenter
   * de le modifier avant sa première publication renvoyait 404
   * (ArticleNotFoundException), rendant tout brouillon non éditable. Cette
   * méthode (contenu complet, tous statuts) est réservée à l'admin —
   * findByIdOrFail() existait déjà mais n'était jamais exposée. */
  async findByIdAdmin(id: string): Promise<HelpArticle> {
    return this.findByIdOrFail(id);
  }

  async create(dto: CreateHelpArticleDto, authorId: string) {
    const existing = await this.artRepo.findOne({ where: { slug: dto.slug } });
    if (existing) throw new ArticleSlugConflictException(dto.slug);

    const article = this.artRepo.create({
      ...dto,
      authorId,
      audience: dto.audience ?? null,
      status:   HelpArticleStatus.DRAFT,
    });
    const saved = await this.artRepo.save(article);
    await this.updateSearchVector(saved.id, saved.title, saved.content);
    return saved;
  }

  async update(id: string, dto: UpdateHelpArticleDto) {
    const article = await this.findByIdOrFail(id);

    if (dto.slug && dto.slug !== article.slug) {
      const conflict = await this.artRepo.findOne({ where: { slug: dto.slug } });
      if (conflict) throw new ArticleSlugConflictException(dto.slug);
    }

    Object.assign(article, dto);
    const saved = await this.artRepo.save(article);
    await this.updateSearchVector(saved.id, saved.title, saved.content);
    return saved;
  }

  async publish(id: string) {
    const article = await this.findByIdOrFail(id);

    if (!article.title || !article.content) {
      throw new ArticleCannotPublishException('le titre et le contenu sont obligatoires.');
    }

    const wasPublished = article.status === HelpArticleStatus.PUBLISHED;
    article.status      = HelpArticleStatus.PUBLISHED;
    article.publishedAt = article.publishedAt ?? new Date();
    await this.artRepo.save(article);

    if (!wasPublished && article.categoryId) {
      await this.catService.incrementArticleCount(article.categoryId, 1);
    }

    return article;
  }

  async archive(id: string) {
    const article = await this.findByIdOrFail(id);
    const wasPublished = article.status === HelpArticleStatus.PUBLISHED;

    article.status = HelpArticleStatus.ARCHIVED;
    await this.artRepo.save(article);

    if (wasPublished && article.categoryId) {
      await this.catService.incrementArticleCount(article.categoryId, -1);
    }

    return article;
  }

  /* Soft delete — l'article reste en base.
   * Les liens partagés (email, bookmarks) reçoivent 410 Gone côté client
   * plutôt que 404 — différence importante pour l'UX. */
  async remove(id: string, deletedBy: string) {
    const article = await this.findByIdOrFail(id);

    if (article.status === HelpArticleStatus.PUBLISHED && article.categoryId) {
      await this.catService.incrementArticleCount(article.categoryId, -1);
    }

    await this.artRepo.update(id, { deletedBy });
    await this.artRepo.softDelete(id);
    this.logger.log(`[ARTICLE] ${article.slug} supprimé (soft) par ${deletedBy}`);
  }

  async getAnalytics() {
    const [total, published, noResults, satisfaction] = await Promise.all([
      this.artRepo.count(),
      this.artRepo.count({ where: { status: HelpArticleStatus.PUBLISHED } }),
      this.dataSource.query(
        `SELECT query, COUNT(*) as count
         FROM help_search_queries
         WHERE "hasResults" = false
         GROUP BY query
         ORDER BY count DESC
         LIMIT 20`,
      ),
      /* Totaux "utile / pas utile" tous articles confondus — permet un
       * taux de satisfaction global affiché en Analytiques, plutôt que
       * ces retours ne restant visibles que par article. */
      this.artRepo
        .createQueryBuilder('a')
        .select('SUM(a.helpfulCount)', 'helpful')
        .addSelect('SUM(a.notHelpfulCount)', 'notHelpful')
        .getRawOne<{ helpful: string | null; notHelpful: string | null }>(),
    ]);

    const topViewed = await this.artRepo.find({
      where: { status: HelpArticleStatus.PUBLISHED },
      select: ['id', 'slug', 'title', 'viewCount', 'helpfulCount', 'notHelpfulCount'],
      order: { viewCount: 'DESC' },
      take: 10,
    });

    const helpfulTotal    = parseInt(satisfaction?.helpful ?? '0', 10) || 0;
    const notHelpfulTotal = parseInt(satisfaction?.notHelpful ?? '0', 10) || 0;
    const feedbackTotal   = helpfulTotal + notHelpfulTotal;

    return {
      total,
      published,
      draft: total - published,
      topArticles:       topViewed,
      zeroResultQueries: noResults,
      satisfaction: {
        helpfulTotal,
        notHelpfulTotal,
        /* null si aucun retour n'a encore été soumis — distingue "0%" de
         * "pas de données", important pour l'affichage admin. */
        rate: feedbackTotal > 0 ? Math.round((helpfulTotal / feedbackTotal) * 100) : null,
      },
    };
  }

  /* ── Helpers privés ──────────────────────────────────────── */

  private async findByIdOrFail(id: string): Promise<HelpArticle> {
    const article = await this.artRepo.findOne({ where: { id } });
    if (!article) throw new ArticleNotFoundException(id);
    return article;
  }

  /* Mise à jour du tsvector PostgreSQL pour la recherche FTS.
   * Appelé après create() et update() pour maintenir l'index cohérent. */
  private async updateSearchVector(id: string, title: string, content: string) {
    try {
      await this.dataSource.query(
        `UPDATE help_articles
         SET "searchVector" = to_tsvector('french', $1 || ' ' || $2)
         WHERE id = $3`,
        [title, content.slice(0, 10_000), id],
      );
    } catch (err) {
      this.logger.warn(`[ARTICLE] tsvector update failed for ${id}: ${err.message}`);
    }
  }
}
