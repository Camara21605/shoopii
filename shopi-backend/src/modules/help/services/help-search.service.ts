import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HelpSearchQuery } from '../../../database/entities/help/help-search-query.entity';

@Injectable()
export class HelpSearchService {

  private readonly logger = new Logger(HelpSearchService.name);

  constructor(
    @InjectRepository(HelpSearchQuery)
    private readonly queryRepo: Repository<HelpSearchQuery>,
    private readonly dataSource: DataSource,
  ) {}

  async search(q: string, categoryId?: string, audience?: string, page = 1, limit = 20) {
    if (!q?.trim()) return { data: [], total: 0, page, pages: 0 };

    const sanitized = q.trim().slice(0, 200);
    const offset    = (page - 1) * limit;

    const audienceFilter = audience && audience !== 'all'
      ? `AND (a.audience IS NULL OR a.audience LIKE '%all%' OR a.audience LIKE '%${audience.replace(/'/g, "''")}%')`
      : '';

    const categoryFilter = categoryId
      ? `AND a."categoryId" = '${categoryId}'`
      : '';

    const rows = await this.dataSource.query<any[]>(
      `SELECT
         a.id, a.slug, a.title, a.excerpt, a."viewCount", a."categoryId",
         c.name AS "categoryName", c.slug AS "categorySlug",
         ts_rank("searchVector", query) AS rank
       FROM help_articles a
       LEFT JOIN help_categories c ON c.id = a."categoryId"
       , to_tsquery('french', $1) query
       WHERE a.status = 'published'
         AND "searchVector" @@ query
         ${audienceFilter}
         ${categoryFilter}
       ORDER BY rank DESC
       LIMIT $2 OFFSET $3`,
      [this.toTsQuery(sanitized), limit, offset],
    );

    const countRow = await this.dataSource.query<any[]>(
      `SELECT COUNT(*) AS total
       FROM help_articles a
       , to_tsquery('french', $1) query
       WHERE a.status = 'published'
         AND "searchVector" @@ query
         ${audienceFilter}
         ${categoryFilter}`,
      [this.toTsQuery(sanitized)],
    );

    const total   = parseInt(countRow[0]?.total ?? '0', 10);
    const hasResults = total > 0;

    /* Log asynchrone — ne bloque pas la réponse */
    this.logQuery(sanitized, null, total, hasResults).catch(() => {});

    return {
      data: rows,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  async logQuery(query: string, userId: string | null, resultsCount: number, hasResults: boolean) {
    try {
      const entry = this.queryRepo.create({ query: query.toLowerCase(), userId, resultsCount, hasResults });
      await this.queryRepo.save(entry);
    } catch {
      /* non bloquant */
    }
  }

  /* Convertit la saisie en requête tsvector-compatible */
  private toTsQuery(input: string): string {
    return input
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w.replace(/[^a-zA-Z0-9àâäéèêëîïôùûüç-]/gi, ''))
      .filter(w => w.length > 1)
      .join(' & ') || 'shopi';
  }
}
