/* ============================================================
 * MIGRATION : 1721000000005-resolution-engine.ts
 *
 * RÔLE    : Étend le schéma pour le Resolution Engine.
 *
 * OPÉRATIONS (toutes idempotentes) :
 *   1. Étend l'enum dispute_status_enum (+6 nouvelles valeurs)
 *   2. Ajoute les colonnes dispute : session_id, deadline_at, escalated_at
 *   3. Ajoute les colonnes dispute_evidences : validated_at, validated_by_user_id
 *   4. Crée la table dispute_history
 *   5. Ajoute les colonnes platform_settings : dispute_window_days,
 *      max_evidences_per_dispute, dispute_instruction_sla_hours
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResolutionEngine1721000000005 implements MigrationInterface {
  name = 'ResolutionEngine1721000000005';

  async up(queryRunner: QueryRunner): Promise<void> {

    /* ══════════════════════════════════════════════════════
     * 1. ÉTENDRE dispute_status_enum
     * ══════════════════════════════════════════════════════ */

    const newStatuses = [
      'waiting_for_evidence',
      'decision_pending',
      'approved',
      'rejected',
      'refund_pending',
      'refunded',
    ];

    for (const val of newStatuses) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = '${val}'
              AND enumtypid = (
                SELECT oid FROM pg_type WHERE typname = 'dispute_status_enum'
              )
          ) THEN
            ALTER TYPE "dispute_status_enum" ADD VALUE '${val}';
          END IF;
        END;
        $$;
      `);
    }

    /* ══════════════════════════════════════════════════════
     * 2. COLONNES DISPUTE
     * ══════════════════════════════════════════════════════ */

    await queryRunner.query(`
      ALTER TABLE "disputes"
        ADD COLUMN IF NOT EXISTS "session_id"    uuid         DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "deadline_at"   timestamp    DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "escalated_at"  timestamp    DEFAULT NULL;
    `);

    /* ══════════════════════════════════════════════════════
     * 3. COLONNES DISPUTE_EVIDENCES
     * ══════════════════════════════════════════════════════ */

    await queryRunner.query(`
      ALTER TABLE "dispute_evidences"
        ADD COLUMN IF NOT EXISTS "validated_at"          timestamp DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "validated_by_user_id"  uuid      DEFAULT NULL;
    `);

    /* ══════════════════════════════════════════════════════
     * 4. TABLE DISPUTE_HISTORY
     * ══════════════════════════════════════════════════════ */

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dispute_history" (
        "id"           uuid              NOT NULL DEFAULT gen_random_uuid(),
        "dispute_id"   uuid              NOT NULL,
        "from_status"  varchar(50)       DEFAULT NULL,
        "to_status"    varchar(50)       NOT NULL,
        "actor_user_id" uuid             DEFAULT NULL,
        "actor_role"   varchar(20)       DEFAULT NULL,
        "note"         text              DEFAULT NULL,
        "metadata"     json              DEFAULT NULL,
        "created_at"   timestamp         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dispute_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_dispute_history_dispute"
          FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dispute_history_dispute"
        ON "dispute_history" ("dispute_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dispute_history_created_at"
        ON "dispute_history" ("created_at");
    `);

    /* ══════════════════════════════════════════════════════
     * 5. COLONNES PLATFORM_SETTINGS
     * ══════════════════════════════════════════════════════ */

    await queryRunner.query(`
      ALTER TABLE "platform_settings"
        ADD COLUMN IF NOT EXISTS "dispute_window_days"           int  DEFAULT 7,
        ADD COLUMN IF NOT EXISTS "max_evidences_per_dispute"     int  DEFAULT 10,
        ADD COLUMN IF NOT EXISTS "dispute_instruction_sla_hours" int  DEFAULT 48;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    /* ── Supprimer colonnes platform_settings ── */
    await queryRunner.query(`
      ALTER TABLE "platform_settings"
        DROP COLUMN IF EXISTS "dispute_instruction_sla_hours",
        DROP COLUMN IF EXISTS "max_evidences_per_dispute",
        DROP COLUMN IF EXISTS "dispute_window_days";
    `);

    /* ── Supprimer table dispute_history ── */
    await queryRunner.query(`DROP TABLE IF EXISTS "dispute_history";`);

    /* ── Supprimer colonnes dispute_evidences ── */
    await queryRunner.query(`
      ALTER TABLE "dispute_evidences"
        DROP COLUMN IF EXISTS "validated_by_user_id",
        DROP COLUMN IF EXISTS "validated_at";
    `);

    /* ── Supprimer colonnes disputes ── */
    await queryRunner.query(`
      ALTER TABLE "disputes"
        DROP COLUMN IF EXISTS "escalated_at",
        DROP COLUMN IF EXISTS "deadline_at",
        DROP COLUMN IF EXISTS "session_id";
    `);

    /* Note : les valeurs ajoutées à l'enum ne peuvent pas être retirées en PostgreSQL < 16. */
  }
}
