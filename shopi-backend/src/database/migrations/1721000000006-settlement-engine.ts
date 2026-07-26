/* ============================================================
 * MIGRATION : 1721000000006-settlement-engine.ts
 *
 * RÔLE    : Étend le schéma pour le Settlement & Payout Engine.
 *
 * OPÉRATIONS (toutes idempotentes) :
 *   1. Étend l'enum retrait_methode_enum (+1 valeur : djomy)
 *   2. Ajoute les colonnes platform_settings :
 *      auto_validation_threshold, max_withdrawal_attempts, djomy_enabled
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class SettlementEngine1721000000006 implements MigrationInterface {
  name = 'SettlementEngine1721000000006';

  async up(queryRunner: QueryRunner): Promise<void> {

    /* ══════════════════════════════════════════════════════
     * 1. ÉTENDRE retrait_methode_enum
     * ══════════════════════════════════════════════════════ */

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'djomy'
            AND enumtypid = (
              SELECT oid FROM pg_type WHERE typname = 'retrait_methode_enum'
            )
        ) THEN
          ALTER TYPE "retrait_methode_enum" ADD VALUE 'djomy';
        END IF;
      END;
      $$;
    `);

    /* ══════════════════════════════════════════════════════
     * 2. COLONNES PLATFORM_SETTINGS (Settlement Engine)
     * ══════════════════════════════════════════════════════ */

    await queryRunner.query(`
      ALTER TABLE "platform_settings"
        ADD COLUMN IF NOT EXISTS "auto_validation_threshold"  decimal(15,2) DEFAULT 500000,
        ADD COLUMN IF NOT EXISTS "max_withdrawal_attempts"    int           DEFAULT 3,
        ADD COLUMN IF NOT EXISTS "djomy_enabled"              boolean       DEFAULT false;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    /* ── Supprimer colonnes platform_settings ── */
    await queryRunner.query(`
      ALTER TABLE "platform_settings"
        DROP COLUMN IF EXISTS "djomy_enabled",
        DROP COLUMN IF EXISTS "max_withdrawal_attempts",
        DROP COLUMN IF EXISTS "auto_validation_threshold";
    `);

    /* Note : les valeurs ajoutées à un enum PostgreSQL < 16 ne peuvent pas être retirées. */
  }
}
