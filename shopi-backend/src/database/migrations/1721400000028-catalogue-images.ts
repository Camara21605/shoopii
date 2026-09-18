/* ============================================================
 * FICHIER : src/database/migrations/1721400000028-catalogue-images.ts
 *
 * RÔLE : Ajoute la colonne "imageUrl" (nullable) aux types d'entreprise,
 * catégories et sous-catégories — image téléversée par le super-admin,
 * qui remplace l'ancien pictogramme (emoji "icone", conservé comme repli
 * d'affichage tant qu'aucune image n'est fournie).
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLES = ['company_types', 'categories', 'sub_categories'] as const;

export class CatalogueImages1721400000028 implements MigrationInterface {
  name = 'CatalogueImages1721400000028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      if (!(await queryRunner.hasColumn(table, 'imageUrl'))) {
        await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN "imageUrl" varchar(500)`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      if (await queryRunner.hasColumn(table, 'imageUrl')) {
        await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "imageUrl"`);
      }
    }
  }
}
