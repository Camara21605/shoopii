/* ============================================================
 * FICHIER      : src/database/migrations/1721400000004-creation-code-length.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * La colonne `creation_codes.code` était limitée à varchar(12),
 * alors que le format généré par randCode() (helpers/admin.helpers.ts)
 * produit "SHOPI-{PREFIX}-{5CHARS}" — jusqu'à 15 caractères
 * (ex. "SHOPI-COR-AB3K9"). Toute génération de code échouait donc
 * en base avec "value too long for type character varying(12)".
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-08-24
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreationCodeLength1721400000004 implements MigrationInterface {
  name = 'CreationCodeLength1721400000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "creation_codes" ALTER COLUMN "code" TYPE varchar(20)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "creation_codes" ALTER COLUMN "code" TYPE varchar(12)
    `);
  }
}
