/* ============================================================
 * FICHIER      : src/database/migrations/1721400000006-explore-trending-cooccurrence.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Support de l'onglet "Explorer" (home client) :
 *
 *   1. trending_products     — cache des scores de tendance,
 *      recalculé par ExploreScheduler (@Cron horaire), jamais
 *      calculé à la volée dans une requête HTTP.
 *
 *   2. product_cooccurrence  — cache "souvent acheté avec"
 *      (market-basket), même logique de pré-calcul.
 *
 *   3. Index manquants sur products.categoryId et
 *      products.createdAt — utilisés par tous les filtres/tris
 *      de l'endpoint /public/explore, aucun index existant à ce
 *      jour (seuls companyId et urlSlug le sont).
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-08-26
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExploreTrendingCooccurrence1721400000006 implements MigrationInterface {
  name = 'ExploreTrendingCooccurrence1721400000006';

  async up(queryRunner: QueryRunner): Promise<void> {

    /* ==========================================================
     * 1. TRENDING_PRODUCTS
     * ========================================================== */
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "trending_products" (
        "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "productId"   uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
        "salesCount"  integer NOT NULL DEFAULT 0,
        "likesCount"  integer NOT NULL DEFAULT 0,
        "score"       double precision NOT NULL DEFAULT 0,
        "windowDays"  integer NOT NULL,
        "computedAt"  TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_trending_product_product"
        ON "trending_products" ("productId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_trending_product_score"
        ON "trending_products" ("score" DESC)
    `);

    /* ==========================================================
     * 2. PRODUCT_COOCCURRENCE
     * ========================================================== */
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_cooccurrence" (
        "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "productId"         uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
        "relatedProductId"  uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
        "coOccurrenceCount" integer NOT NULL DEFAULT 0,
        "computedAt"        TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_cooccurrence_pair" UNIQUE ("productId", "relatedProductId")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cooccurrence_product"
        ON "product_cooccurrence" ("productId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cooccurrence_related"
        ON "product_cooccurrence" ("relatedProductId")
    `);

    /* ==========================================================
     * 3. INDEX MANQUANTS SUR PRODUCTS
     *
     * categoryId : filtre principal de /public/explore et de
     *              PublicService.listProduits() — jamais indexé.
     * createdAt  : tri "Nouveautés" (ORDER BY createdAt DESC),
     *              déjà utilisé ailleurs (getSimilaires, listProduits)
     *              sans index.
     * ========================================================== */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_category"
        ON "products" ("categoryId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_created_at"
        ON "products" ("createdAt" DESC)
    `);
    /* Composite pour le filtre catalogue le plus fréquent : produits
     * publics d'une catégorie triés par date. */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_visibilite_category_created"
        ON "products" ("visibilite", "categoryId", "createdAt" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_visibilite_category_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_category"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cooccurrence_related"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cooccurrence_product"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_cooccurrence"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trending_product_score"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trending_product_product"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trending_products"`);
  }
}
