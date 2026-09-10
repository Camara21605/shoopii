/* ============================================================
 * FICHIER : src/database/migrations/1721400000019-partner-referral-link.ts
 *
 * RÔLE : Ajoute partenaires.referralSlug + partenaires.referralClicks —
 * lien de parrainage réellement traçable (voir partenaire-profile.entity.ts
 * pour le détail du mécanisme). Slug nullable (généré paresseusement),
 * unique uniquement parmi les valeurs non nulles.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class PartnerReferralLink1721400000019 implements MigrationInterface {
  name = 'PartnerReferralLink1721400000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasSlug = await queryRunner.hasColumn('partenaires', 'referralSlug');
    if (!hasSlug) {
      await queryRunner.query(
        `ALTER TABLE "partenaires" ADD COLUMN "referralSlug" character varying(64)`,
      );
    }

    const hasClicks = await queryRunner.hasColumn('partenaires', 'referralClicks');
    if (!hasClicks) {
      await queryRunner.query(
        `ALTER TABLE "partenaires" ADD COLUMN "referralClicks" integer NOT NULL DEFAULT 0`,
      );
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_partenaires_referralSlug"
      ON "partenaires" ("referralSlug")
      WHERE "referralSlug" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_partenaires_referralSlug"`);
    await queryRunner.query(`ALTER TABLE "partenaires" DROP COLUMN IF EXISTS "referralClicks"`);
    await queryRunner.query(`ALTER TABLE "partenaires" DROP COLUMN IF EXISTS "referralSlug"`);
  }
}
