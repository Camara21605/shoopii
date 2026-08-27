/* ============================================================
 * FICHIER : src/modules/explore/explore.scheduler.ts
 *
 * RÔLE : Recalcule périodiquement les tables de cache de l'onglet
 *        Explorer — JAMAIS calculé à la volée dans une requête HTTP
 *        (le projet a déjà des lenteurs connues côté admin/messagerie
 *        liées à des calculs faits en direct dans le chemin de requête).
 *
 *   recomputeTrending()     — toutes les heures, écrit trending_products
 *   recomputeCooccurrence() — toutes les heures, écrit product_cooccurrence
 *
 * Chaque recalcul remplace intégralement le contenu de sa table
 * (TRUNCATE + INSERT dans une transaction) — les deux tables sont des
 * caches dérivés, pas une source de vérité, donc pas de risque à les
 * reconstruire entièrement à chaque passage. Volumes attendus modestes
 * (nombre de produits ayant une vente/like récent, top N paires par
 * produit) — voir explore.constants.ts pour les bornes.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { CommandeItem } from 'src/database/entities/commande/commande-item.entity';
import { CommandeStatus } from 'src/database/entities/commande/commande.entity';
import { ProductLike } from 'src/database/entities/entreprise.table/product-like.entity';
import { TrendingProduct } from 'src/database/entities/entreprise.table/trending-product.entity';
import { ProductCooccurrence } from 'src/database/entities/entreprise.table/product-cooccurrence.entity';
import { TRENDING_WINDOW_DAYS, TRENDING_WEIGHTS, COOCCURRENCE_TOP_N } from './explore.constants';

/** Statuts qui NE comptent PAS comme un signal de vente valide (paiement non confirmé ou annulé). */
const SALE_EXCLUDED_STATUSES = [CommandeStatus.PENDING, CommandeStatus.CANCELLED, CommandeStatus.REFUNDED];

@Injectable()
export class ExploreScheduler {
  private readonly logger = new Logger(ExploreScheduler.name);

  constructor(
    @InjectRepository(TrendingProduct)
    private readonly trendingRepo: Repository<TrendingProduct>,
    @InjectRepository(ProductCooccurrence)
    private readonly coocRepo: Repository<ProductCooccurrence>,
    @InjectRepository(CommandeItem)
    private readonly itemRepo: Repository<CommandeItem>,
    @InjectRepository(ProductLike)
    private readonly likeRepo: Repository<ProductLike>,
    private readonly dataSource: DataSource,
  ) {}

  /* ════════════════════════════════════════════════════════
   * Toutes les heures — recalcul des deux caches Explorer
   ════════════════════════════════════════════════════════ */
  @Cron('0 * * * *')
  async recomputeAll(): Promise<void> {
    await Promise.allSettled([
      this.recomputeTrending(),
      this.recomputeCooccurrence(),
    ]);
  }

  // ── Tendances : ventes + likes sur la fenêtre glissante ────────

  private async recomputeTrending(): Promise<void> {
    try {
      const since = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

      const salesRows: { productId: string; qty: string }[] = await this.itemRepo
        .createQueryBuilder('ci')
        .innerJoin('ci.commande', 'c')
        .select('ci.productId', 'productId')
        .addSelect('SUM(ci.quantite)', 'qty')
        .where('c.createdAt >= :since', { since })
        .andWhere('c.status NOT IN (:...excluded)', { excluded: SALE_EXCLUDED_STATUSES })
        .andWhere('ci.productId IS NOT NULL')
        .groupBy('ci.productId')
        .getRawMany();

      const likeRows: { productId: string; cnt: string }[] = await this.likeRepo
        .createQueryBuilder('l')
        .select('l.productId', 'productId')
        .addSelect('COUNT(*)', 'cnt')
        .where('l.createdAt >= :since', { since })
        .groupBy('l.productId')
        .getRawMany();

      const salesMap = new Map(salesRows.map(r => [r.productId, Number(r.qty)]));
      const likesMap = new Map(likeRows.map(r => [r.productId, Number(r.cnt)]));
      const productIds = new Set([...salesMap.keys(), ...likesMap.keys()]);

      const rows = Array.from(productIds).map(productId => {
        const salesCount = salesMap.get(productId) ?? 0;
        const likesCount = likesMap.get(productId) ?? 0;
        return {
          productId,
          salesCount,
          likesCount,
          score: salesCount * TRENDING_WEIGHTS.sales + likesCount * TRENDING_WEIGHTS.likes,
          windowDays: TRENDING_WINDOW_DAYS,
        };
      });

      await this.dataSource.transaction(async manager => {
        await manager.clear(TrendingProduct);
        if (rows.length > 0) await manager.insert(TrendingProduct, rows);
      });

      this.logger.log(`[Explore] Tendances recalculées : ${rows.length} produit(s) sur ${TRENDING_WINDOW_DAYS}j`);
    } catch (err) {
      this.logger.error('[Explore] Échec recomputeTrending', err as Error);
    }
  }

  // ── Souvent acheté avec : self-join market-basket, top N par produit ──

  private async recomputeCooccurrence(): Promise<void> {
    try {
      const pairs: { productId: string; relatedProductId: string; cnt: string }[] =
        await this.dataSource.query(
          `
          WITH pair_counts AS (
            SELECT a."productId" AS "productId", b."productId" AS "relatedProductId",
                   COUNT(DISTINCT a."commandeId")::int AS cnt
            FROM commande_items a
            JOIN commande_items b
              ON a."commandeId" = b."commandeId"
             AND a."productId" <> b."productId"
            JOIN commandes c ON c.id = a."commandeId"
            WHERE a."productId" IS NOT NULL AND b."productId" IS NOT NULL
              AND c.status NOT IN ('cancelled', 'refunded')
            GROUP BY a."productId", b."productId"
          ),
          ranked AS (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY "productId" ORDER BY cnt DESC) AS rn
            FROM pair_counts
          )
          SELECT "productId", "relatedProductId", cnt FROM ranked WHERE rn <= $1
          `,
          [COOCCURRENCE_TOP_N],
        );

      const rows = pairs.map(p => ({
        productId: p.productId,
        relatedProductId: p.relatedProductId,
        coOccurrenceCount: Number(p.cnt),
      }));

      await this.dataSource.transaction(async manager => {
        await manager.clear(ProductCooccurrence);
        if (rows.length > 0) await manager.insert(ProductCooccurrence, rows);
      });

      this.logger.log(`[Explore] Co-occurrences recalculées : ${rows.length} paire(s)`);
    } catch (err) {
      this.logger.error('[Explore] Échec recomputeCooccurrence', err as Error);
    }
  }
}
