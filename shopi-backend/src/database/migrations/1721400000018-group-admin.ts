/* ============================================================
 * FICHIER : src/database/migrations/1721400000018-group-admin.ts
 *
 * RÔLE : Ajoute delivery_group_members.isAdmin — administrateur du
 * groupe (uniquement significatif pour un groupe CUSTOM, voir
 * DeliveryGroupService.setMemberAdmin/assertGroupAdmin), qui peut
 * changer la photo du groupe et nommer/retirer d'autres administrateurs
 * (comme WhatsApp/Telegram). Backfill : le créateur de chaque groupe
 * CUSTOM existant devient admin (sinon aucun groupe libre créé avant ce
 * correctif n'aurait eu d'administrateur).
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class GroupAdmin1721400000018 implements MigrationInterface {
  name = 'GroupAdmin1721400000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasIsAdmin = await queryRunner.hasColumn('delivery_group_members', 'isAdmin');
    if (!hasIsAdmin) {
      await queryRunner.query(
        `ALTER TABLE "delivery_group_members" ADD COLUMN "isAdmin" boolean NOT NULL DEFAULT false`,
      );
    }

    // Backfill — le créateur de chaque groupe CUSTOM existant devient admin.
    await queryRunner.query(`
      UPDATE "delivery_group_members" m
      SET "isAdmin" = true
      FROM "delivery_groups" g
      WHERE m."groupId" = g.id
        AND g.kind = 'custom'
        AND g."createdByUserId" IS NOT NULL
        AND m."userId" = g."createdByUserId"
        AND m."isActive" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "delivery_group_members" DROP COLUMN IF EXISTS "isAdmin"`);
  }
}
