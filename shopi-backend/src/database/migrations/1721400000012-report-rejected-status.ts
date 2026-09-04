/* ============================================================
 * FICHIER : src/database/migrations/1721400000012-report-rejected-status.ts
 *
 * RÔLE : Ajoute ReportStatus.REJECTED — le frontend (admin et partenaire)
 * affichait déjà ce statut dans son UI, mais rien côté backend ne pouvait
 * jamais le produire ("Classer sans suite" appelait resolveSignalement(),
 * confondant rejet et résolution réelle sous le même statut RESOLVED).
 * Voir AdminSignalementsService.rejectSignalement().
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportRejectedStatus1721400000012 implements MigrationInterface {
  name = 'ReportRejectedStatus1721400000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ALTER TYPE ... ADD VALUE ne peut pas être annulé — vérifie d'abord.
    const existing = await queryRunner.query(
      `SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'reports_status_enum' AND e.enumlabel = 'rejected'`,
    );
    if (existing.length === 0) {
      await queryRunner.query(`ALTER TYPE "reports_status_enum" ADD VALUE 'rejected'`);
    }

    const hasCol = await queryRunner.hasColumn('reports', 'rejectionReason');
    if (!hasCol) {
      await queryRunner.query(`ALTER TABLE "reports" ADD COLUMN "rejectionReason" varchar(500) NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Retirer une valeur d'enum PostgreSQL n'est pas supporté directement —
    // laisser la valeur 'rejected' en place (inoffensif si inutilisée).
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN IF EXISTS "rejectionReason"`);
  }
}
