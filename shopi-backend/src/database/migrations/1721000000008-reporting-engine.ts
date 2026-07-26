/* ============================================================
 * FICHIER      : src/database/migrations/1721000000008-reporting-engine.ts
 * MODULE       : ReportingEngine — Migration
 * ROLE         : Index de performance pour les requêtes du moteur de reporting
 * RESPONSABILITES :
 *   - Ajouter des index composites sur les tables financières existantes
 *   - Aucune modification de structure de table (index seulement)
 *   - Cibler les patterns de requête réels du KpiEngineService
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportingEngine1721000000008 implements MigrationInterface {
  name = 'ReportingEngine1721000000008';

  async up(queryRunner: QueryRunner): Promise<void> {

    /* ==========================================================
     * paiement_sessions
     * Pattern : WHERE status = ? AND createdAt BETWEEN ? AND ?
     * ========================================================== */

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_status_created"
        ON "paiement_sessions" ("status", "createdAt")
    `);

    /* Pattern : WHERE confirmedAt IS NOT NULL AND confirmedAt BETWEEN ? AND ?
     * Utilisé par computePaiementKpi pour les paiements confirmés */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_confirmed_at"
        ON "paiement_sessions" ("confirmedAt")
        WHERE "confirmedAt" IS NOT NULL
    `);

    /* Pattern : GROUP BY provider — répartition par provider */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_provider_status"
        ON "paiement_sessions" ("provider", "status")
    `);

    /* ==========================================================
     * paiement_distributions
     * Pattern : WHERE acteurType = ? AND createdAt BETWEEN ? AND ?
     * ========================================================== */

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_distribution_acteur_type_created"
        ON "paiement_distributions" ("acteurType", "createdAt")
    `);

    /* Pattern : WHERE acteurUserId = ? AND acteurType = ? AND createdAt BETWEEN ?
     * Utilisé par les dashboards entreprise/livreur/correspondant */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_distribution_acteur_user_created"
        ON "paiement_distributions" ("acteurUserId", "acteurType", "createdAt")
    `);

    /* Pattern : WHERE partenaireUserId = ? AND createdAt BETWEEN ?
     * Utilisé par getActeursUnderPartenaire */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_distribution_partenaire_created"
        ON "paiement_distributions" ("partenaireUserId", "createdAt")
    `);

    /* Pattern : WHERE adminUserId = ? AND createdAt BETWEEN ?
     * Utilisé par le dashboard admin */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_distribution_admin_created"
        ON "paiement_distributions" ("adminUserId", "createdAt")
    `);

    /* ==========================================================
     * retraits
     * Pattern : WHERE status = ? AND requestedAt BETWEEN ? AND ?
     * ========================================================== */

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_retrait_status_created"
        ON "retraits" ("status", "requestedAt")
    `);

    /* Pattern : WHERE userId = ? AND requestedAt BETWEEN ?
     * Utilisé par les dashboards acteurs pour leurs propres retraits */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_retrait_user_created"
        ON "retraits" ("userId", "requestedAt")
    `);

    /* ==========================================================
     * disputes
     * Pattern : WHERE status IN (?) AND openedAt BETWEEN ? AND ?
     * ========================================================== */

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dispute_status_opened"
        ON "disputes" ("status", "openedAt")
    `);

    /* Pattern : WHERE clientUserId = ? AND openedAt BETWEEN ?
     * Pour les statistiques de litiges côté client */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dispute_client_opened"
        ON "disputes" ("clientUserId", "openedAt")
    `);

    /* ==========================================================
     * wallet_transactions
     * Pattern : WHERE operationType = ? AND createdAt BETWEEN ?
     * ========================================================== */

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wallet_tx_op_type_created"
        ON "wallet_transactions" ("operationType", "createdAt")
    `);

    /* ==========================================================
     * financial_audit_logs
     * Pattern : WHERE eventType IN (?) AND createdAt BETWEEN ?
     * ========================================================== */

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_event_type_created"
        ON "financial_audit_logs" ("eventType", "createdAt")
    `);

    /* Pattern : WHERE severity = ? AND createdAt BETWEEN ?
     * Utilisé par getSecurityEvents et getAuditSummaryByActor */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_severity_created"
        ON "financial_audit_logs" ("severity", "createdAt")
    `);

    /* Pattern : WHERE actorUserId = ? AND createdAt BETWEEN ?
     * Pour les rapports d'audit par acteur */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_actor_created"
        ON "financial_audit_logs" ("actorUserId", "createdAt")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_session_status_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_session_confirmed_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_session_provider_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_distribution_acteur_type_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_distribution_acteur_user_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_distribution_partenaire_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_distribution_admin_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_retrait_status_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_retrait_user_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dispute_status_opened"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dispute_client_opened"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_wallet_tx_op_type_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_event_type_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_severity_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_actor_created"`);
  }
}
