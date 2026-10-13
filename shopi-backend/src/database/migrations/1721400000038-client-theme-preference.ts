/* ============================================================
 * FICHIER : src/database/migrations/1721400000038-client-theme-preference.ts
 *
 * RÔLE : clients.themePreference — thème choisi par le client dans
 *        Paramètres → Apparence ('clair' | 'sombre' | 'auto').
 *        NULL = jamais choisi (le site reste en sombre).
 *        Aussi appliqué au démarrage par schema-patches.ts.
 * down() : retire la colonne.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClientThemePreference1721400000038 implements MigrationInterface {
  name = 'ClientThemePreference1721400000038';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "themePreference" character varying(10) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN IF EXISTS "themePreference"`);
  }
}
