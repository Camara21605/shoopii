/* ============================================================
 * FICHIER      : src/database/migrations/1721100000000-performance-indexes.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Index de performance complémentaires identifiés lors de l'audit
 * du Performance & Scalability Engine (Prompt 14).
 *
 * CONTEXTE
 * ─────────────────────────────────────────────────────────────
 * La migration 1721000000008-reporting-engine.ts a déjà créé
 * plusieurs index sur paiement_sessions et paiement_distributions.
 * Ce fichier couvre les lacunes restantes, notamment :
 *
 *   1. commandes       — (status, autoValidationAt) manquant
 *                        Le scheduler 15-min fait un seq scan.
 *
 *   2. commandes       — (companyId, status) pour les dashboards
 *                        entreprise qui filtrent par company + statut.
 *
 *   3. commande_items  — (produitId) manquant
 *                        Utilisé dans les JOINs publics et catalogue.
 *
 *   4. retraits        — (userId, status, requestedAt) composite
 *                        Requêtes settlements + dashboard livreur.
 *
 *   5. wallet_transactions — (walletId, type, createdAt) composite
 *                        Pour l'historique filtré par type.
 *
 *   6. paiement_sessions — (methode, status) pour les stats par methode
 *                        Déjà (provider, status) — ajouter methode.
 *
 *   7. disputes        — (status, createdAt) composite
 *                        alert.service.ts : checkDisputeSpike filtre
 *                        sur les 2 colonnes.
 *
 *   8. notifications   — (recipientId, isRead, createdAt) composite
 *                        Pour le calcul des non-lus par acteur.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class PerformanceIndexes1721100000000 implements MigrationInterface {
  name = 'PerformanceIndexes1721100000000';

  async up(queryRunner: QueryRunner): Promise<void> {

    /* ==========================================================
     * 1. COMMANDES
     *
     * Problème : commande.scheduler.ts toutes les 15 min :
     *   WHERE status = 'AWAITING_CLIENT' AND autoValidationAt <= NOW()
     * Sans index composite → seq scan sur toute la table commandes.
     *
     * Impact : élimine le seq scan sur la table critique commandes.
     * ========================================================== */

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_commande_status_auto_validation"
        ON "commandes" ("status", "autoValidationAt")
        WHERE "autoValidationAt" IS NOT NULL
    `);

    /* Dashboard entreprise : filtre par companyId + status */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_commande_company_status"
        ON "commandes" ("companyId", "status")
    `);

    /* Dashboard client : filtre par clientId + status */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_commande_client_status"
        ON "commandes" ("clientId", "status")
    `);

    /* Dashboard livreur : filtre par livreurId + status */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_commande_livreur_status"
        ON "commandes" ("livreurId", "status")
        WHERE "livreurId" IS NOT NULL
    `);

    /* ==========================================================
     * 2. COMMANDE_ITEMS
     *
     * Problème : utilisé en JOIN sur produitId dans le catalogue
     * public et les stats de ventes. Aucun index sur produitId.
     * ========================================================== */

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_commande_item_produit"
        ON "commande_items" ("produitId")
    `);

    /* ==========================================================
     * 3. RETRAITS
     *
     * Problème : settlement-scheduler filtre sur (userId, status)
     * + historique filtre sur (userId, createdAt).
     * ========================================================== */

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_retrait_user_status"
        ON "retraits" ("userId", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_retrait_status_created"
        ON "retraits" ("status", "createdAt")
    `);

    /* ==========================================================
     * 4. WALLET_TRANSACTIONS
     *
     * Problème : l'historique wallet filtre sur (walletId, type)
     * ou (walletId, createdAt). L'index existant IDX_wallet_transaction_wallet
     * couvre walletId seul — ajouter les composites.
     * ========================================================== */

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wallet_tx_wallet_type_created"
        ON "wallet_transactions" ("walletId", "type", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wallet_tx_wallet_status_created"
        ON "wallet_transactions" ("walletId", "status", "createdAt" DESC)
    `);

    /* ==========================================================
     * 5. PAIEMENT_SESSIONS — méthode de paiement
     *
     * Déjà : IDX_session_provider_status (provider, status)
     * Ajout : (methode, status) pour les stats GROUP BY methode
     * dans computePaiementKpi().
     * ========================================================== */

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_methode_status"
        ON "paiement_sessions" ("methode", "status")
    `);

    /* ==========================================================
     * 6. DISPUTES
     *
     * Problème : alert.service.ts checkDisputeSpike() filtre sur
     *   WHERE status IN (...) AND createdAt BETWEEN ? AND ?
     * Index existant IDX_dispute_status seul → seq filter sur date.
     * ========================================================== */

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dispute_status_created"
        ON "disputes" ("status", "createdAt")
    `);

    /* ==========================================================
     * 7. NOTIFICATIONS
     *
     * Problème : notification.scheduler.ts batchUnseen() filtre sur
     *   WHERE recipientId = ? AND isRead = false ORDER BY createdAt
     * Amélioration du composite existant (recipientId, isRead) en
     * ajoutant createdAt pour éviter un sort.
     *
     * Note : PostgreSQL peut utiliser l'index existant + sort séparé ;
     * l'index covering ci-dessous évite le tri additionnel.
     * ========================================================== */

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_recipient_unread_created"
        ON "notifications" ("recipientId", "isRead", "createdAt" DESC)
        WHERE "isRead" = false
    `);

    /* ==========================================================
     * 8. ESCROWS — autoReleaseAt (manquant, cité dans l'audit)
     *
     * Problème : auto-release scheduler filtre sur
     *   WHERE status = 'LOCKED' AND autoReleaseAt <= NOW()
     * Index IDX_escrow_auto_release existe sur autoReleaseAt seul —
     * ajouter le composite avec status pour éviter le filter.
     * ========================================================== */

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_escrow_status_auto_release"
        ON "escrows" ("status", "autoReleaseAt")
        WHERE "autoReleaseAt" IS NOT NULL
    `);

    /* ==========================================================
     * 9. SYSTEM_METRICS (module platform-security)
     *
     * Problème : DeepHealthService et ComplianceService interrogent
     * system_metrics avec WHERE metricName = ? AND collectedAt BETWEEN ?
     * Index existants : (metricName) et (collectedAt) séparément.
     * ========================================================== */

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_system_metric_name_collected"
        ON "system_metrics" ("metricName", "collectedAt" DESC)
    `);
  }

  /* ----------------------------------------------------------
   * DOWN — supprime tous les index ajoutés dans up()
   * ---------------------------------------------------------- */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_commande_status_auto_validation"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_commande_company_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_commande_client_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_commande_livreur_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_commande_item_produit"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_retrait_user_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_retrait_status_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_wallet_tx_wallet_type_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_wallet_tx_wallet_status_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_session_methode_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dispute_status_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_recipient_unread_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_escrow_status_auto_release"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_system_metric_name_collected"`);
  }
}
