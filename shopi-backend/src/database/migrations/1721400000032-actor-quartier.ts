/* ============================================================
 * FICHIER : src/database/migrations/1721400000032-actor-quartier.ts
 *
 * RÔLE : la ville ET le quartier des livreurs et correspondants.
 *   - livreurs.commune / livreurs.quartier   (n'avaient que ville + zone libre)
 *   - correspondants.depotQuartier           (depotCommune servait aussi de quartier)
 * Reprise des données existantes : pour un livreur, une `zone` texte différente de
 * la ville devient sa commune de base. Rien n'est inventé : les quartiers restent
 * NULL tant que l'acteur ne les a pas renseignés.
 * down() : retire les colonnes.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActorQuartier1721400000032 implements MigrationInterface {
  name = 'ActorQuartier1721400000032';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "livreurs" ADD COLUMN IF NOT EXISTS "commune" character varying(100) NULL`);
    await queryRunner.query(`ALTER TABLE "livreurs" ADD COLUMN IF NOT EXISTS "quartier" character varying(100) NULL`);
    await queryRunner.query(`ALTER TABLE "correspondants" ADD COLUMN IF NOT EXISTS "depotQuartier" character varying(100) NULL`);
    await queryRunner.query(`
      UPDATE "livreurs" SET "commune" = "zone"
      WHERE "commune" IS NULL AND "zone" IS NOT NULL AND TRIM("zone") <> ''
        AND LOWER(TRIM("zone")) <> LOWER(TRIM(COALESCE("ville", '')))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "livreurs" DROP COLUMN IF EXISTS "commune"`);
    await queryRunner.query(`ALTER TABLE "livreurs" DROP COLUMN IF EXISTS "quartier"`);
    await queryRunner.query(`ALTER TABLE "correspondants" DROP COLUMN IF EXISTS "depotQuartier"`);
  }
}
