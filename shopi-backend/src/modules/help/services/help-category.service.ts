/* ============================================================
 * FICHIER  : src/modules/help/services/help-category.service.ts
 * ROLE     : Gestion des catégories du Centre d'aide.
 *
 * RESPONSABILITES :
 *   - Lister les catégories actives avec filtres d'audience.
 *   - Récupérer une catégorie par slug avec ses articles publiés.
 *   - CRUD admin : créer, modifier, désactiver une catégorie.
 *   - Maintenir le compteur articleCount (dénormalisé).
 *
 * DEPENDANCES :
 *   - HelpCategory (InjectRepository)
 *   - HelpArticle  (InjectRepository — lecture articles par catégorie)
 *   - CategoryNotFoundException, CategorySlugConflictException
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import { HelpCategory }   from '../../../database/entities/help/help-category.entity';
import { HelpArticle, HelpArticleStatus } from '../../../database/entities/help/help-article.entity';
import { CreateHelpCategoryDto, UpdateHelpCategoryDto } from '../dto/help.dto';

import {
  CategoryNotFoundException,
  CategorySlugConflictException,
} from '../../../common/exceptions/help-center.exceptions';

@Injectable()
export class HelpCategoryService {

  constructor(
    @InjectRepository(HelpCategory)
    private readonly catRepo: Repository<HelpCategory>,
    @InjectRepository(HelpArticle)
    private readonly artRepo: Repository<HelpArticle>,
  ) {}

  /* ── Côté public ─────────────────────────────────────────── */

  async findAll(audience?: string) {
    const qb = this.catRepo.createQueryBuilder('c')
      .where('c.isActive = true')
      .orderBy('c.displayOrder', 'ASC')
      .addOrderBy('c.name', 'ASC');

    if (audience && audience !== 'all') {
      qb.andWhere(
        `(c.audience IS NULL OR c.audience LIKE :all OR c.audience LIKE :aud)`,
        { all: '%all%', aud: `%${audience}%` },
      );
    }

    return qb.getMany();
  }

  async findBySlug(slug: string, audience?: string) {
    const cat = await this.catRepo.findOne({ where: { slug, isActive: true } });
    if (!cat) throw new CategoryNotFoundException(slug);

    const qb = this.artRepo.createQueryBuilder('a')
      .where('a.categoryId = :catId', { catId: cat.id })
      .andWhere('a.status = :status', { status: HelpArticleStatus.PUBLISHED })
      .select(['a.id', 'a.slug', 'a.title', 'a.excerpt', 'a.viewCount', 'a.publishedAt'])
      .orderBy('a.publishedAt', 'DESC');

    if (audience && audience !== 'all') {
      qb.andWhere(
        `(a.audience IS NULL OR a.audience LIKE :all OR a.audience LIKE :aud)`,
        { all: '%all%', aud: `%${audience}%` },
      );
    }

    const articles = await qb.getMany();
    return { ...cat, articles };
  }

  /* ── Côté admin ──────────────────────────────────────────── */

  async findAllAdmin() {
    return this.catRepo.find({ order: { displayOrder: 'ASC', name: 'ASC' } });
  }

  async create(dto: CreateHelpCategoryDto) {
    const existing = await this.catRepo.findOne({ where: { slug: dto.slug } });
    if (existing) throw new CategorySlugConflictException(dto.slug);

    const cat = this.catRepo.create({
      ...dto,
      icon:         dto.icon         ?? 'fa-circle-question',
      displayOrder: dto.displayOrder ?? 0,
      audience:     dto.audience     ?? null,
    });
    return this.catRepo.save(cat);
  }

  async update(id: string, dto: UpdateHelpCategoryDto) {
    const cat = await this.catRepo.findOne({ where: { id } });
    if (!cat) throw new CategoryNotFoundException(id);
    Object.assign(cat, dto);
    return this.catRepo.save(cat);
  }

  async deactivate(id: string) {
    const cat = await this.catRepo.findOne({ where: { id } });
    if (!cat) throw new CategoryNotFoundException(id);
    cat.isActive = false;
    await this.catRepo.save(cat);
  }

  /* Appelé par HelpArticleService lors du publish/archive/remove
   * pour garder articleCount cohérent sans COUNT(*) à chaque requête. */
  async incrementArticleCount(categoryId: string, delta: 1 | -1) {
    await this.catRepo.increment({ id: categoryId }, 'articleCount', delta);
  }
}
