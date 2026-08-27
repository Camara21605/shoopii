/* ============================================================
 * FICHIER      : src/database/migrations/1721400000008-call-history-per-user-delete.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Permet à chaque participant d'un appel de retirer une entrée de
 * SON PROPRE historique (onglet "Appels" de la messagerie) sans
 * affecter la ligne pour l'autre participant — `call_history` est
 * une ligne unique partagée entre appelant/appelé.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-08-27
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CallHistoryPerUserDelete1721400000008 implements MigrationInterface {
  name = 'CallHistoryPerUserDelete1721400000008';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "call_history"
        ADD COLUMN IF NOT EXISTS "hiddenByCaller" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "hiddenByCallee" boolean NOT NULL DEFAULT false
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "call_history" DROP COLUMN IF EXISTS "hiddenByCaller"`);
    await queryRunner.query(`ALTER TABLE "call_history" DROP COLUMN IF EXISTS "hiddenByCallee"`);
  }
}
