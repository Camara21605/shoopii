/* ============================================================
 * FICHIER : src/database/migrations/1721400000039-user-theme-preference.ts
 *
 * RÔLE : users.themePreference — thème d'affichage choisi par
 *        l'utilisateur ('clair' | 'sombre' | 'auto'), pour les espaces
 *        pros (entreprise…). NULL = jamais choisi → sombre.
 *        Aussi appliqué au démarrage par schema-patches.ts.
 * down() : retire la colonne.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserThemePreference1721400000039 implements MigrationInterface {
  name = 'UserThemePreference1721400000039';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "themePreference" character varying(10) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "themePreference"`);
  }
}
