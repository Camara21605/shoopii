/* ============================================================
 * MIGRATION    : 1721000000007-financial-config-engine.ts
 * MODULE       : FinancialConfigEngine
 * ROLE         : Crée la table configuration_snapshots pour
 *                stocker l'historique versionné des modifications
 *                des paramètres financiers.
 * OPÉRATIONS (toutes idempotentes) :
 *   1. Crée la table configuration_snapshots
 *   2. Crée les index de recherche
 * NOTE         :
 *   ConfigSection enum est créé directement comme varchar(20)
 *   pour éviter la gestion des ALTER TYPE PostgreSQL.
 *   PlatformSettings n'est PAS modifiée ici (DB_SYNC=true en dev).
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinancialConfigEngine1721000000007 implements MigrationInterface {
  name = 'FinancialConfigEngine1721000000007';

  async up(queryRunner: QueryRunner): Promise<void> {

    /* ══════════════════════════════════════════════════════
     * 1. TABLE configuration_snapshots
     * ══════════════════════════════════════════════════════ */

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "configuration_snapshots" (
        "id"                    uuid          NOT NULL DEFAULT gen_random_uuid(),
        "section"               varchar(20)   NOT NULL,
        "version"               integer       NOT NULL DEFAULT 1,
        "label"                 varchar(200),
        "changedFields"         text          NOT NULL,
        "before"                jsonb,
        "after"                 jsonb         NOT NULL,
        "justification"         text          NOT NULL,
        "performedByUserId"     uuid,
        "performedByRole"       varchar(50),
        "ipAddress"             varchar(45),
        "isRollback"            boolean       NOT NULL DEFAULT false,
        "rolledBackToVersion"   integer,
        "createdAt"             timestamp     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_configuration_snapshots" PRIMARY KEY ("id")
      )
    `);

    /* ══════════════════════════════════════════════════════
     * 2. INDEX pour requêtes courantes
     * ══════════════════════════════════════════════════════ */

    /* Recherche rapide par section (pour le filtrage historique) */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_config_snapshot_section_version"
      ON "configuration_snapshots" ("section", "version")
    `);

    /* Recherche par auteur (audit d'un admin spécifique) */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_config_snapshot_performed_by"
      ON "configuration_snapshots" ("performedByUserId")
    `);

    /* Recherche par date (rapports chronologiques) */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_config_snapshot_created_at"
      ON "configuration_snapshots" ("createdAt")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_config_snapshot_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_config_snapshot_performed_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_config_snapshot_section_version"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "configuration_snapshots"`);
  }
}
