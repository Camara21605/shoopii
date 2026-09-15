/* ============================================================
 * FICHIER : src/database/migrations/1721400000023-company-business-model.ts
 *
 * RÔLE : Distinction produits/services au niveau compte entreprise —
 * entreprises.businessModel (exclusif, fixé à l'inscription, voir
 * Company.businessModel) + company_types.nature (tag admin pour filtrer
 * le sélecteur de type d'entreprise à l'inscription selon le
 * businessModel choisi, voir CompanyType.nature et RegisterDto
 * .businessModel).
 *
 * entreprises.businessModel est ajoutée nullable, backfillée à
 * 'products' (seul modèle qui existait avant cette migration — voir
 * commentaire ci-dessous), puis passée NOT NULL : aucune ligne
 * existante ne doit se retrouver sans valeur.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyBusinessModel1721400000023 implements MigrationInterface {
  name = 'CompanyBusinessModel1721400000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    /* ── entreprises.businessModel ── */
    const hasBusinessModel = await queryRunner.hasColumn('entreprises', 'businessModel');
    if (!hasBusinessModel) {
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "entreprises_businessmodel_enum" AS ENUM('products','services');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `);
      await queryRunner.query(`
        ALTER TABLE "entreprises" ADD COLUMN "businessModel" "entreprises_businessmodel_enum"
      `);
      /* Backfill : avant cette migration, la plateforme ne connaissait que
       * les entreprises "produits" — aucune entreprise "services" n'a
       * jamais pu exister (rien ne le permettait côté inscription). */
      await queryRunner.query(`
        UPDATE "entreprises" SET "businessModel" = 'products' WHERE "businessModel" IS NULL
      `);
      await queryRunner.query(`
        ALTER TABLE "entreprises" ALTER COLUMN "businessModel" SET NOT NULL
      `);
      await queryRunner.query(`
        CREATE INDEX "IDX_entreprises_businessModel" ON "entreprises" ("businessModel")
      `);
    }

    /* ── company_types.nature ── */
    const hasNature = await queryRunner.hasColumn('company_types', 'nature');
    if (!hasNature) {
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "company_types_nature_enum" AS ENUM('products','services','neutral');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `);
      await queryRunner.query(`
        ALTER TABLE "company_types"
        ADD COLUMN "nature" "company_types_nature_enum" NOT NULL DEFAULT 'neutral'
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "company_types" DROP COLUMN IF EXISTS "nature"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "company_types_nature_enum"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_entreprises_businessModel"`);
    await queryRunner.query(`ALTER TABLE "entreprises" DROP COLUMN IF EXISTS "businessModel"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "entreprises_businessmodel_enum"`);
  }
}
