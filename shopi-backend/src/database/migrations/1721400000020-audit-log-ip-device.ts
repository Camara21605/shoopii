/* ============================================================
 * FICHIER : src/database/migrations/1721400000020-audit-log-ip-device.ts
 *
 * RÔLE : Ajoute audit_logs.ip + audit_logs.device — contexte de
 * connexion de l'action (voir admin.helpers.ts#auditMeta), affiché
 * dans le Journal d'activité admin (JournalSection.tsx). Colonnes
 * nullables : les entrées déjà en base n'ont pas cette information.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditLogIpDevice1721400000020 implements MigrationInterface {
  name = 'AuditLogIpDevice1721400000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasIp = await queryRunner.hasColumn('audit_logs', 'ip');
    if (!hasIp) {
      await queryRunner.query(
        `ALTER TABLE "audit_logs" ADD COLUMN "ip" character varying(45)`,
      );
    }

    const hasDevice = await queryRunner.hasColumn('audit_logs', 'device');
    if (!hasDevice) {
      await queryRunner.query(
        `ALTER TABLE "audit_logs" ADD COLUMN "device" character varying(100)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "device"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "ip"`);
  }
}
