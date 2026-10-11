/* ============================================================
 * FICHIER : src/database/migrations/1721400000040-product-views-count.ts
 *
 * RÔLE : products.viewsCount — nombre de consultations de la fiche
 *        produit, incrémenté par GET /public/produits/:id. Sert à la
 *        galerie « produit le plus consulté » de l'accueil.
 *        Aussi appliqué au démarrage par schema-patches.ts.
 * down() : retire l'index et la colonne.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductViewsCount1721400000040 implements MigrationInterface {
  name = 'ProductViewsCount1721400000040';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "viewsCount" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_products_viewsCount" ON "products" ("viewsCount")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_viewsCount"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "viewsCount"`);
  }
}
