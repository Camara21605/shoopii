/* ============================================================
 * FICHIER : src/database/migrations/1721400000011-report-founded.ts
 *
 * RÔLE : Active PlatformSettings.reportsBeforeSuspend — jusqu'ici ce
 * réglage se sauvegardait en base sans jamais être appliqué (le
 * compteur "suspendus" était même codé en dur à 0, voir
 * AdminSignalementsService.getSignalements()).
 *
 * Ajoute "founded"/"foundedAt" sur "reports" — voir report.entity.ts
 * et AdminSignalementsService.warnSignalement() pour le nouveau flux
 * d'auto-suspension.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportFounded1721400000011 implements MigrationInterface {
  name = 'ReportFounded1721400000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasFounded = await queryRunner.hasColumn('reports', 'founded');
    if (!hasFounded) {
      await queryRunner.query(`ALTER TABLE "reports" ADD COLUMN "founded" boolean NOT NULL DEFAULT false`);
    }
    const hasFoundedAt = await queryRunner.hasColumn('reports', 'foundedAt');
    if (!hasFoundedAt) {
      await queryRunner.query(`ALTER TABLE "reports" ADD COLUMN "foundedAt" timestamp NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN IF EXISTS "founded"`);
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN IF EXISTS "foundedAt"`);
  }
}
