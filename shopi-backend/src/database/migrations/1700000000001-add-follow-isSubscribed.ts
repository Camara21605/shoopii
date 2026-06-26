/* ============================================================
 * MIGRATION : ajoute isSubscribed + unfollowedAt à la table follows
 * Fichier : src/database/migrations/[timestamp]-add-follow-isSubscribed.ts
 *
 * ✅ PostgreSQL : backticks MySQL → guillemets doubles,
 *    DROP INDEX syntaxe sans ON <table>, ADD COLUMN sans backticks
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFollowIsSubscribed1700000000001 implements MigrationInterface {
  name = 'AddFollowIsSubscribed1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {

    /* ✅ Ajouter isSubscribed — default true (toutes les lignes existantes = abonnées) */
    const hasIsSubscribed = await queryRunner.hasColumn('follows', 'isSubscribed');
    if (!hasIsSubscribed) {
      await queryRunner.query(`
        ALTER TABLE "follows"
        ADD COLUMN "isSubscribed" BOOLEAN NOT NULL DEFAULT TRUE
      `);
      await queryRunner.query(`
        CREATE INDEX "IDX_follow_subscribed" ON "follows" ("isSubscribed")
      `);
    }

    /* ✅ Ajouter unfollowedAt pour traçabilité */
    const hasUnfollowedAt = await queryRunner.hasColumn('follows', 'unfollowedAt');
    if (!hasUnfollowedAt) {
      await queryRunner.query(`
        ALTER TABLE "follows"
        ADD COLUMN "unfollowedAt" TIMESTAMP NULL DEFAULT NULL
      `);
    }

    /* ✅ Mettre isSubscribed = false pour les lignes status = 'inactive' */
    await queryRunner.query(`
      UPDATE "follows"
      SET "isSubscribed" = FALSE
      WHERE "status" = 'inactive'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    /* PostgreSQL : DROP INDEX sans ON <table> */
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_follow_subscribed"`);

    const hasIsSubscribed = await queryRunner.hasColumn('follows', 'isSubscribed');
    if (hasIsSubscribed) {
      await queryRunner.query(`ALTER TABLE "follows" DROP COLUMN "isSubscribed"`);
    }

    const hasUnfollowedAt = await queryRunner.hasColumn('follows', 'unfollowedAt');
    if (hasUnfollowedAt) {
      await queryRunner.query(`ALTER TABLE "follows" DROP COLUMN "unfollowedAt"`);
    }
  }
}
