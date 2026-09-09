/* ============================================================
 * FICHIER : src/database/migrations/1721400000016-custom-groups.ts
 *
 * RÔLE : Permet à delivery_groups d'héberger aussi des groupes "libres"
 * (créés manuellement, sans commande) — voir DeliveryGroupKind.CUSTOM
 * et DeliveryGroupService.createCustomGroup(). Élargit les colonnes
 * commandeId/commandeNumero/companyName (obligatoires avant, maintenant
 * null pour un groupe CUSTOM) et ajoute kind/name/createdByUserId.
 * Ajoute aussi 'partner' à l'enum delivery_group_members_actorType_enum.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomGroups1721400000016 implements MigrationInterface {
  name = 'CustomGroups1721400000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── delivery_groups : kind / name / createdByUserId + colonnes nullable ──
    const hasKind = await queryRunner.hasColumn('delivery_groups', 'kind');
    if (!hasKind) {
      const existingEnum = await queryRunner.query(
        `SELECT 1 FROM pg_type WHERE typname = 'delivery_groups_kind_enum'`,
      );
      if (existingEnum.length === 0) {
        await queryRunner.query(`CREATE TYPE "delivery_groups_kind_enum" AS ENUM ('order', 'custom')`);
      }
      await queryRunner.query(
        `ALTER TABLE "delivery_groups" ADD COLUMN "kind" "delivery_groups_kind_enum" NOT NULL DEFAULT 'order'`,
      );
    }

    const hasName = await queryRunner.hasColumn('delivery_groups', 'name');
    if (!hasName) {
      await queryRunner.query(`ALTER TABLE "delivery_groups" ADD COLUMN "name" varchar(255) NULL`);
    }

    const hasCreatedBy = await queryRunner.hasColumn('delivery_groups', 'createdByUserId');
    if (!hasCreatedBy) {
      await queryRunner.query(`ALTER TABLE "delivery_groups" ADD COLUMN "createdByUserId" uuid NULL`);
    }

    // commandeId/commandeNumero/companyName doivent devenir nullable pour
    // accueillir un groupe CUSTOM (aucune commande associée).
    await queryRunner.query(`ALTER TABLE "delivery_groups" ALTER COLUMN "commandeId" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "delivery_groups" ALTER COLUMN "commandeNumero" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "delivery_groups" ALTER COLUMN "companyName" DROP NOT NULL`);

    // ── delivery_group_members : 'partner' dans l'enum actorType ──
    const existingLabel = await queryRunner.query(
      `SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
       WHERE t.typname = 'delivery_group_members_actortype_enum' AND e.enumlabel = 'partner'`,
    );
    if (existingLabel.length === 0) {
      await queryRunner.query(`ALTER TYPE "delivery_group_members_actortype_enum" ADD VALUE 'partner'`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "delivery_groups" DROP COLUMN IF EXISTS "createdByUserId"`);
    await queryRunner.query(`ALTER TABLE "delivery_groups" DROP COLUMN IF EXISTS "name"`);
    await queryRunner.query(`ALTER TABLE "delivery_groups" DROP COLUMN IF EXISTS "kind"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "delivery_groups_kind_enum"`);
    // commandeId/commandeNumero/companyName restent nullable (redescendre
    // NOT NULL casserait sur toute ligne CUSTOM déjà créée) ; 'partner' dans
    // l'enum n'est, comme d'habitude, pas retirable proprement en Postgres.
  }
}
