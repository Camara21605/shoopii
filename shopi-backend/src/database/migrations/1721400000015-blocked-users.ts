/* ============================================================
 * FICHIER : src/database/migrations/1721400000015-blocked-users.ts
 *
 * RÔLE : Crée la table blocked_users — voir blocked-user.entity.ts pour
 * le détail du correctif ("Bloquer le contact" était un bouton factice).
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class BlockedUsers1721400000015 implements MigrationInterface {
  name = 'BlockedUsers1721400000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('blocked_users');
    if (!hasTable) {
      await queryRunner.query(`
        CREATE TABLE "blocked_users" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "blockerUserId" uuid NOT NULL,
          "blockedUserId" uuid NOT NULL,
          "createdAt" timestamp NOT NULL DEFAULT now(),
          CONSTRAINT "UQ_blocked_pair" UNIQUE ("blockerUserId", "blockedUserId")
        )
      `);
      await queryRunner.query(`CREATE INDEX "IDX_blocked_blocker" ON "blocked_users" ("blockerUserId")`);
      await queryRunner.query(`CREATE INDEX "IDX_blocked_blocked" ON "blocked_users" ("blockedUserId")`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "blocked_users"`);
  }
}
