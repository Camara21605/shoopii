/* ============================================================
 * FICHIER : src/database/migrations/1721400000021-admin-communication-settings.ts
 *
 * RÔLE : Crée la table admin_communication_settings — message
 * personnalisé + signature d'invitation et modèles de notification
 * par admin (voir AdminCommunicationService + CommunicationSection.tsx).
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminCommunicationSettings1721400000021 implements MigrationInterface {
  name = 'AdminCommunicationSettings1721400000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('admin_communication_settings');
    if (!hasTable) {
      await queryRunner.query(`
        CREATE TABLE "admin_communication_settings" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "userId" uuid NOT NULL,
          "invitationMessage" text NULL,
          "signature" character varying(300) NULL,
          "notifTemplates" json NULL,
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX "IDX_admin_comm_userId" ON "admin_communication_settings" ("userId")
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_communication_settings"`);
  }
}
