/* ============================================================
 * FICHIER      : src/database/migrations/1721400000005-admin-dashboard-indexes.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Index de performance pour le dashboard Administrateur (zone),
 * identifiés lors de l'audit de performance :
 *
 *   1. partenaires.adminId, entreprises.adminId, livreurs.adminId
 *      — filtrées dans QUASIMENT toutes les requêtes de zone
 *        (adminOf, getActeurs, getValidations, getPartenaires,
 *        getOverview, getStats, getClients...) sans aucun index.
 *
 *   2. creation_codes.adminId
 *      — filtrée dans getCodes()/generateCode() (unicité + liste).
 *
 *   3. audit_logs (actorId, createdAt)
 *      — getAudit() filtre actorId puis trie par createdAt ; seul
 *        createdAt était indexé (IDX_audit_log_createdAt), d'où un
 *        filtre en mémoire après scan de l'index existant.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-08-24
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminDashboardIndexes1721400000005 implements MigrationInterface {
  name = 'AdminDashboardIndexes1721400000005';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_partenaire_admin"
        ON "partenaires" ("adminId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_entreprise_admin"
        ON "entreprises" ("adminId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_livreur_admin"
        ON "livreurs" ("adminId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_creation_code_admin"
        ON "creation_codes" ("adminId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_log_actor_created"
        ON "audit_logs" ("actorId", "createdAt" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_partenaire_admin"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_entreprise_admin"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_livreur_admin"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_creation_code_admin"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_log_actor_created"`);
  }
}
