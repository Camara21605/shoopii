/* ============================================================
 * MIGRATION : 1721000000000-paiement-system-complete.ts
 *
 * OBJECTIF
 * ─────────────────────────────────────────────────────────────
 * Crée l'ensemble des tables du moteur financier Shopi (Phase 3).
 *
 * TABLES CRÉÉES
 * ─────────────────────────────────────────────────────────────
 *  1. commission_rules        → versionnage des taux de commission
 *  2. financial_audit_logs    → piste d'audit financier immuable
 *  3. disputes                → litiges financiers clients
 *  4. dispute_evidences       → pièces justificatives des litiges
 *  5. retraits                → demandes de retrait vers mobile money
 *  6. settlement_batches      → lots de virements groupés
 *  7. webhook_events          → journal des webhooks entrants
 *
 * COLONNES AJOUTÉES AUX TABLES EXISTANTES
 * ─────────────────────────────────────────────────────────────
 *  paiement_distributions :
 *    + partenaire_user_id    → hiérarchie commission
 *    + admin_user_id         → hiérarchie commission
 *    + commission_rule_id    → référence vers commission_rules
 *    + snapshot_taux         → JSON snapshot des taux appliqués
 *
 *  platform_settings :
 *    + daily_withdrawal_limit, taux_commission_produit,
 *      plan_multiplier_pro, plan_multiplier_premium,
 *      ratio_shopi_produit, ratio_partenaire_produit, ratio_admin_produit,
 *      taux_commission_livraison, ratio_shopi_livraison,
 *      ratio_partenaire_livraison, ratio_admin_livraison,
 *      max_payment_delay_hours, session_ttl_minutes,
 *      max_enterprise_validation_hours, dispute_window_days,
 *      dispute_resolution_hours, refund_processing_days,
 *      withdrawal_processing_hours, data_retention_years,
 *      wallet_inactivity_days, max_daily_payment_attempts
 *
 * COMPATIBILITÉ
 * ─────────────────────────────────────────────────────────────
 *  ✅ PostgreSQL (Supabase)
 *  ✅ Toutes les nouvelles colonnes ont DEFAULT ou NOT NULL+DEFAULT
 *  ✅ Méthode down() complète et réversible
 *  ✅ Idempotente : vérifie l'existence avant CREATE/ALTER
 *
 * AUTEUR    : Système de paiement Shopi – Phase 3
 * DATE      : 2026-07-17
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaiementSystemComplete1721000000000 implements MigrationInterface {
  name = 'PaiementSystemComplete1721000000000';

  /* ============================================================
   * UP — Création
   * ============================================================ */

  public async up(queryRunner: QueryRunner): Promise<void> {

    /* ----------------------------------------------------------
     * 1. TYPES ENUM POSTGRESQL
     * Utilise DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL
     * pour ne pas échouer si la migration est rejouée.
     * ---------------------------------------------------------- */

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE financial_event_type_enum AS ENUM(
          'payment_initiated','payment_confirmed','payment_failed','payment_expired',
          'escrow_locked','escrow_released','escrow_cancelled',
          'refund_initiated','refund_confirmed','refund_failed',
          'withdrawal_requested','withdrawal_processing','withdrawal_completed','withdrawal_failed',
          'dispute_opened','dispute_resolved','dispute_closed',
          'commission_rule_changed','platform_settings_changed',
          'webhook_signature_invalid','wallet_frozen','wallet_unfrozen',
          'double_payment_blocked','amount_mismatch_detected'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE financial_audit_severity_enum AS ENUM('critical','high','normal');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE dispute_status_enum AS ENUM(
          'open','under_review','resolved_client','resolved_seller','closed'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE dispute_motif_enum AS ENUM(
          'article_non_recu','article_endommage','mauvaise_qualite',
          'mauvais_article','retard_excessif','paiement_indu','autre'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE dispute_decision_enum AS ENUM(
          'remboursement_total','remboursement_partiel','rejet','re_livraison','avoir_wallet'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE evidence_type_enum AS ENUM('photo','video','document','screenshot','audio');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE evidence_submitted_by_enum AS ENUM('client','entreprise','livreur','admin');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE retrait_status_enum AS ENUM('pending','processing','completed','failed','cancelled');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE retrait_methode_enum AS ENUM('orange_money','mtn_money','wave','virement_bancaire','moov_money');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE settlement_batch_status_enum AS ENUM('pending','processing','completed','partial','failed');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE settlement_frequence_enum AS ENUM('manuel','quotidien','hebdomadaire');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE webhook_event_status_enum AS ENUM('received','processed','failed','skipped');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    /* ----------------------------------------------------------
     * 2. TABLE : commission_rules
     *
     * Snapshot versionné des taux de commission.
     * INSERT ONLY — jamais modifiée après création.
     * ---------------------------------------------------------- */

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "commission_rules" (
        "id"                       UUID          NOT NULL DEFAULT gen_random_uuid(),
        "version"                  INT           NOT NULL DEFAULT 1,
        "label"                    VARCHAR(200),
        "isActive"                 BOOLEAN       NOT NULL DEFAULT false,
        "note"                     TEXT,

        -- Commission produit
        "tauxCommissionProduit"    DECIMAL(5,2)  NOT NULL,
        "planMultiplierStandard"   DECIMAL(4,3)  NOT NULL DEFAULT 1,
        "planMultiplierPro"        DECIMAL(4,3)  NOT NULL,
        "planMultiplierPremium"    DECIMAL(4,3)  NOT NULL,
        "ratioShopiProduit"        DECIMAL(5,2)  NOT NULL,
        "ratioPartenaireProduit"   DECIMAL(5,2)  NOT NULL,
        "ratioAdminProduit"        DECIMAL(5,2)  NOT NULL,

        -- Commission livraison
        "tauxCommissionLivraison"  DECIMAL(5,2)  NOT NULL,
        "ratioShopiLivraison"      DECIMAL(5,2)  NOT NULL,
        "ratioPartenaireLivraison" DECIMAL(5,2)  NOT NULL,
        "ratioAdminLivraison"      DECIMAL(5,2)  NOT NULL,

        -- Audit
        "createdByUserId"          UUID,
        "activatedAt"              TIMESTAMP,
        "deactivatedAt"            TIMESTAMP,
        "createdAt"                TIMESTAMP     NOT NULL DEFAULT now(),

        CONSTRAINT "PK_commission_rules" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_commission_rule_active"
        ON "commission_rules" ("isActive")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_commission_rule_version"
        ON "commission_rules" ("version")
    `);

    /* ----------------------------------------------------------
     * 3. TABLE : financial_audit_logs
     *
     * Journal d'audit financier immuable.
     * Jamais UPDATE ni DELETE après INSERT.
     * ---------------------------------------------------------- */

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "financial_audit_logs" (
        "id"             UUID                          NOT NULL DEFAULT gen_random_uuid(),
        "eventType"      financial_event_type_enum     NOT NULL,
        "severity"       financial_audit_severity_enum NOT NULL DEFAULT 'normal',
        "actorUserId"    UUID,
        "actorRole"      VARCHAR(50),
        "commandeId"     UUID,
        "walletId"       UUID,
        "sessionId"      UUID,
        "distributionId" UUID,
        "montant"        DECIMAL(15,2),
        "devise"         VARCHAR(5)                    NOT NULL DEFAULT 'GNF',
        "entityType"     VARCHAR(100),
        "entityId"       UUID,
        "before"         JSON,
        "after"          JSON,
        "metadata"       JSON,
        "ipAddress"      VARCHAR(45),
        "userAgent"      VARCHAR(500),
        "createdAt"      TIMESTAMP                     NOT NULL DEFAULT now(),

        CONSTRAINT "PK_financial_audit_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_fin_audit_event_type" ON "financial_audit_logs" ("eventType")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_fin_audit_actor"      ON "financial_audit_logs" ("actorUserId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_fin_audit_commande"   ON "financial_audit_logs" ("commandeId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_fin_audit_wallet"     ON "financial_audit_logs" ("walletId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_fin_audit_severity"   ON "financial_audit_logs" ("severity")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_fin_audit_created_at" ON "financial_audit_logs" ("createdAt")`);

    /* ----------------------------------------------------------
     * 4. TABLE : disputes
     *
     * Litiges financiers ouverts par les clients.
     * Crée avant dispute_evidences (FK parent).
     * ---------------------------------------------------------- */

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "disputes" (
        "id"               UUID                  NOT NULL DEFAULT gen_random_uuid(),
        "reference"        VARCHAR(25)           NOT NULL,
        "commandeId"       UUID                  NOT NULL,
        "commandeNumero"   VARCHAR(30)           NOT NULL,
        "clientUserId"     UUID                  NOT NULL,
        "adminUserId"      UUID,
        "savTicketId"      UUID,
        "motif"            dispute_motif_enum    NOT NULL,
        "description"      TEXT                  NOT NULL,
        "montantConteste"  DECIMAL(15,2)         NOT NULL,
        "status"           dispute_status_enum   NOT NULL DEFAULT 'open',
        "decision"         dispute_decision_enum,
        "decisionMotif"    TEXT,
        "montantRembourse" DECIMAL(15,2),
        "openedAt"         TIMESTAMP             NOT NULL DEFAULT now(),
        "resolvedAt"       TIMESTAMP,
        "closedAt"         TIMESTAMP,
        "createdAt"        TIMESTAMP             NOT NULL DEFAULT now(),
        "updatedAt"        TIMESTAMP             NOT NULL DEFAULT now(),

        CONSTRAINT "PK_disputes"          PRIMARY KEY ("id"),
        CONSTRAINT "UQ_dispute_reference" UNIQUE     ("reference")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_dispute_commande"   ON "disputes" ("commandeId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_dispute_client"     ON "disputes" ("clientUserId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_dispute_status"     ON "disputes" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_dispute_created_at" ON "disputes" ("createdAt")`);

    /* ----------------------------------------------------------
     * 5. TABLE : dispute_evidences
     *
     * Pièces justificatives associées à un litige.
     * FK obligatoire vers disputes(id) avec CASCADE.
     * ---------------------------------------------------------- */

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dispute_evidences" (
        "id"               UUID                       NOT NULL DEFAULT gen_random_uuid(),
        "disputeId"        UUID                       NOT NULL,
        "uploadedByUserId" UUID                       NOT NULL,
        "submittedBy"      evidence_submitted_by_enum NOT NULL,
        "type"             evidence_type_enum         NOT NULL,
        "url"              VARCHAR(1000)              NOT NULL,
        "originalFileName" VARCHAR(255),
        "fileSizeBytes"    INT,
        "description"      TEXT,
        "createdAt"        TIMESTAMP                  NOT NULL DEFAULT now(),

        CONSTRAINT "PK_dispute_evidences" PRIMARY KEY ("id"),
        CONSTRAINT "FK_evidence_dispute"  FOREIGN KEY ("disputeId")
          REFERENCES "disputes" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_evidence_dispute"      ON "dispute_evidences" ("disputeId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_evidence_submitted_by" ON "dispute_evidences" ("submittedBy")`);

    /* ----------------------------------------------------------
     * 6. TABLE : retraits
     *
     * Demandes de retrait vers mobile money.
     * ---------------------------------------------------------- */

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "retraits" (
        "id"                  UUID                NOT NULL DEFAULT gen_random_uuid(),
        "reference"           VARCHAR(25)         NOT NULL,
        "walletId"            UUID                NOT NULL,
        "userId"              UUID                NOT NULL,
        "montant"             DECIMAL(15,2)       NOT NULL,
        "frais"               DECIMAL(15,2)       NOT NULL DEFAULT 0,
        "montantNet"          DECIMAL(15,2)       NOT NULL,
        "methode"             retrait_methode_enum NOT NULL,
        "numeroDestinataire"  VARCHAR(100)        NOT NULL,
        "nomDestinataire"     VARCHAR(200),
        "status"              retrait_status_enum NOT NULL DEFAULT 'pending',
        "providerReference"   VARCHAR(255),
        "failureReason"       VARCHAR(500),
        "attempts"            INT                 NOT NULL DEFAULT 1,
        "batchId"             UUID,
        "processedByUserId"   UUID,
        "notes"               TEXT,
        "walletTransactionId" UUID,
        "requestedAt"         TIMESTAMP           NOT NULL DEFAULT now(),
        "processedAt"         TIMESTAMP,
        "completedAt"         TIMESTAMP,
        "createdAt"           TIMESTAMP           NOT NULL DEFAULT now(),
        "updatedAt"           TIMESTAMP           NOT NULL DEFAULT now(),

        CONSTRAINT "PK_retraits"          PRIMARY KEY ("id"),
        CONSTRAINT "UQ_retrait_reference" UNIQUE     ("reference")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_retrait_wallet"     ON "retraits" ("walletId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_retrait_user"       ON "retraits" ("userId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_retrait_status"     ON "retraits" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_retrait_batch"      ON "retraits" ("batchId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_retrait_created_at" ON "retraits" ("createdAt")`);

    /* ----------------------------------------------------------
     * 7. TABLE : settlement_batches
     *
     * Lots de virements groupés (traitement quotidien/hebdomadaire).
     * ---------------------------------------------------------- */

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "settlement_batches" (
        "id"               UUID                          NOT NULL DEFAULT gen_random_uuid(),
        "reference"        VARCHAR(30)                   NOT NULL,
        "frequence"        settlement_frequence_enum     NOT NULL DEFAULT 'quotidien',
        "provider"         VARCHAR(50),
        "montantTotal"     DECIMAL(18,2)                 NOT NULL DEFAULT 0,
        "fraisTotal"       DECIMAL(15,2)                 NOT NULL DEFAULT 0,
        "nbRetraits"       INT                           NOT NULL DEFAULT 0,
        "nbCompleted"      INT                           NOT NULL DEFAULT 0,
        "nbFailed"         INT                           NOT NULL DEFAULT 0,
        "status"           settlement_batch_status_enum  NOT NULL DEFAULT 'pending',
        "triggeredByUserId" UUID,
        "executionReport"  JSON,
        "errorMessage"     TEXT,
        "startedAt"        TIMESTAMP,
        "completedAt"      TIMESTAMP,
        "createdAt"        TIMESTAMP                     NOT NULL DEFAULT now(),
        "updatedAt"        TIMESTAMP                     NOT NULL DEFAULT now(),

        CONSTRAINT "PK_settlement_batches"  PRIMARY KEY ("id"),
        CONSTRAINT "UQ_settlement_reference" UNIQUE    ("reference")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_settlement_status"     ON "settlement_batches" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_settlement_created_at" ON "settlement_batches" ("createdAt")`);

    /* ----------------------------------------------------------
     * 8. TABLE : webhook_events
     *
     * Journal de tous les webhooks entrants.
     * Contrainte unique (provider, eventId) = déduplication.
     * ---------------------------------------------------------- */

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "webhook_events" (
        "id"             UUID                       NOT NULL DEFAULT gen_random_uuid(),
        "provider"       VARCHAR(50)                NOT NULL,
        "eventId"        VARCHAR(255)               NOT NULL,
        "eventType"      VARCHAR(100),
        "sessionId"      UUID,
        "payload"        JSON                       NOT NULL,
        "headers"        JSON,
        "signature"      VARCHAR(500),
        "signatureValid" BOOLEAN                    NOT NULL DEFAULT false,
        "status"         webhook_event_status_enum  NOT NULL DEFAULT 'received',
        "attempts"       INT                        NOT NULL DEFAULT 1,
        "errorMessage"   TEXT,
        "errorStack"     TEXT,
        "sourceIp"       VARCHAR(45),
        "received_at"    TIMESTAMP                  NOT NULL DEFAULT now(),
        "processedAt"    TIMESTAMP,
        "createdAt"      TIMESTAMP                  NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP                  NOT NULL DEFAULT now(),

        CONSTRAINT "PK_webhook_events"           PRIMARY KEY ("id"),
        CONSTRAINT "UQ_webhook_provider_event"   UNIQUE     ("provider", "eventId")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_webhook_provider"    ON "webhook_events" ("provider")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_webhook_status"      ON "webhook_events" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_webhook_received_at" ON "webhook_events" ("received_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_webhook_session"     ON "webhook_events" ("sessionId")`);

    /* ----------------------------------------------------------
     * 9. COLONNES AJOUTÉES : paiement_distributions
     *
     * Hiérarchie de commissions + snapshot de taux.
     * Toutes nullable pour compatibilité avec les lignes existantes.
     * ---------------------------------------------------------- */

    const distTable = 'paiement_distributions';

    const distCols: Array<{ name: string; sql: string }> = [
      { name: 'partenaireUserId',  sql: `UUID` },
      { name: 'adminUserId',       sql: `UUID` },
      { name: 'commissionRuleId',  sql: `UUID` },
      { name: 'snapshotTaux',      sql: `JSON` },
    ];

    for (const col of distCols) {
      const exists = await queryRunner.hasColumn(distTable, col.name);
      if (!exists) {
        await queryRunner.query(
          `ALTER TABLE "${distTable}" ADD COLUMN "${col.name}" ${col.sql}`
        );
      }
    }

    /* ----------------------------------------------------------
     * 10. COLONNES AJOUTÉES : platform_settings
     *
     * Nouveaux champs de commission (cascade Shopi/Partenaire/Admin)
     * et délais métier configurables.
     * Toutes avec DEFAULT pour ne pas casser le singleton existant.
     * ---------------------------------------------------------- */

    const psTable = 'platform_settings';

    const psCols: Array<{ name: string; sql: string }> = [
      /* Commission produit */
      { name: 'dailyWithdrawalLimit',         sql: `DECIMAL(15,2) NOT NULL DEFAULT 5000000` },
      { name: 'tauxCommissionProduit',         sql: `DECIMAL(5,2)  NOT NULL DEFAULT 6`       },
      { name: 'planMultiplierPro',             sql: `DECIMAL(4,3)  NOT NULL DEFAULT 0.75`    },
      { name: 'planMultiplierPremium',         sql: `DECIMAL(4,3)  NOT NULL DEFAULT 0.50`    },
      { name: 'ratioShopiProduit',             sql: `DECIMAL(5,2)  NOT NULL DEFAULT 70`      },
      { name: 'ratioPartenaireProduit',        sql: `DECIMAL(5,2)  NOT NULL DEFAULT 20`      },
      { name: 'ratioAdminProduit',             sql: `DECIMAL(5,2)  NOT NULL DEFAULT 10`      },
      /* Commission livraison */
      { name: 'tauxCommissionLivraison',       sql: `DECIMAL(5,2)  NOT NULL DEFAULT 10`      },
      { name: 'ratioShopiLivraison',           sql: `DECIMAL(5,2)  NOT NULL DEFAULT 60`      },
      { name: 'ratioPartenaireLivraison',      sql: `DECIMAL(5,2)  NOT NULL DEFAULT 25`      },
      { name: 'ratioAdminLivraison',           sql: `DECIMAL(5,2)  NOT NULL DEFAULT 15`      },
      /* Délais métier */
      { name: 'maxPaymentDelayHours',          sql: `INT           NOT NULL DEFAULT 24`       },
      { name: 'sessionTtlMinutes',             sql: `INT           NOT NULL DEFAULT 60`       },
      { name: 'maxEnterpriseValidationHours',  sql: `INT           NOT NULL DEFAULT 48`       },
      { name: 'disputeWindowDays',             sql: `INT           NOT NULL DEFAULT 7`        },
      { name: 'disputeResolutionHours',        sql: `INT           NOT NULL DEFAULT 48`       },
      { name: 'refundProcessingDays',          sql: `INT           NOT NULL DEFAULT 3`        },
      { name: 'withdrawalProcessingHours',     sql: `INT           NOT NULL DEFAULT 24`       },
      { name: 'dataRetentionYears',            sql: `INT           NOT NULL DEFAULT 5`        },
      { name: 'walletInactivityDays',          sql: `INT           NOT NULL DEFAULT 365`      },
      { name: 'maxDailyPaymentAttempts',       sql: `INT           NOT NULL DEFAULT 5`        },
    ];

    for (const col of psCols) {
      const exists = await queryRunner.hasColumn(psTable, col.name);
      if (!exists) {
        await queryRunner.query(
          `ALTER TABLE "${psTable}" ADD COLUMN "${col.name}" ${col.sql}`
        );
      }
    }
  }

  /* ============================================================
   * DOWN — Rollback complet et ordonné
   *
   * Ordre inverse du UP :
   *   1. Retirer colonnes ajoutées aux tables existantes
   *   2. Supprimer les tables dans l'ordre inverse (child first)
   *   3. Supprimer les types ENUM
   * ============================================================ */

  public async down(queryRunner: QueryRunner): Promise<void> {

    /* -- 1. Colonnes de platform_settings -------------------- */

    const psColsToRemove = [
      'dailyWithdrawalLimit','tauxCommissionProduit',
      'planMultiplierPro','planMultiplierPremium',
      'ratioShopiProduit','ratioPartenaireProduit','ratioAdminProduit',
      'tauxCommissionLivraison','ratioShopiLivraison',
      'ratioPartenaireLivraison','ratioAdminLivraison',
      'maxPaymentDelayHours','sessionTtlMinutes','maxEnterpriseValidationHours',
      'disputeWindowDays','disputeResolutionHours','refundProcessingDays',
      'withdrawalProcessingHours','dataRetentionYears',
      'walletInactivityDays','maxDailyPaymentAttempts',
    ];

    for (const col of psColsToRemove) {
      const exists = await queryRunner.hasColumn('platform_settings', col);
      if (exists) {
        await queryRunner.query(`ALTER TABLE "platform_settings" DROP COLUMN "${col}"`);
      }
    }

    /* -- 2. Colonnes de paiement_distributions --------------- */

    const distColsToRemove = [
      'partenaireUserId','adminUserId','commissionRuleId','snapshotTaux',
    ];

    for (const col of distColsToRemove) {
      const exists = await queryRunner.hasColumn('paiement_distributions', col);
      if (exists) {
        await queryRunner.query(`ALTER TABLE "paiement_distributions" DROP COLUMN "${col}"`);
      }
    }

    /* -- 3. Tables (child before parent) --------------------- */

    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "settlement_batches"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "retraits"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dispute_evidences"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "disputes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "financial_audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "commission_rules"`);

    /* -- 4. Types ENUM --------------------------------------- */

    await queryRunner.query(`DROP TYPE IF EXISTS webhook_event_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS settlement_frequence_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS settlement_batch_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS retrait_methode_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS retrait_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS evidence_submitted_by_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS evidence_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS dispute_decision_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS dispute_motif_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS dispute_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS financial_audit_severity_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS financial_event_type_enum`);
  }
}
