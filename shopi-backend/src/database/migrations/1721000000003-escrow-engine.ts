/* ============================================================
 * MIGRATION : 1721000000003-escrow-engine.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Crée les tables et enums nécessaires à l'Escrow Engine.
 *
 * OPÉRATIONS
 * ------------------------------------------------------------
 * 1. Nouveaux types ENUM PostgreSQL (idempotent)
 *    - escrow_status_enum
 *    - escrow_trigger_enum
 *
 * 2. Table `escrows` (séquestre maître, une ligne par commande)
 *
 * 3. Table `escrow_histories` (journal immuable des transitions)
 *
 * IDEMPOTENCE
 * ------------------------------------------------------------
 * Toutes les opérations utilisent IF NOT EXISTS / DO $$ BEGIN
 * pour être ré-exécutables sans erreur.
 *
 * ORDRE D'EXÉCUTION
 * ------------------------------------------------------------
 * Cette migration doit s'exécuter APRÈS :
 *   - 1721000000000-paiement-system-complete.ts (wallets, distributions)
 *   - 1721000000002-wallet-engine-extension.ts  (wallet_ledger_entries)
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class EscrowEngine1721000000003 implements MigrationInterface {
  name = 'EscrowEngine1721000000003';

  /* ==========================================================
   * UP
   * ========================================================== */

  async up(qr: QueryRunner): Promise<void> {

    /* ── 1. ENUMS ── */

    await qr.query(`
      DO $$ BEGIN
        CREATE TYPE escrow_status_enum AS ENUM (
          'created',
          'funds_received',
          'locked',
          'waiting_validation',
          'released',
          'refund_pending',
          'refunded',
          'disputed',
          'resolved',
          'failed',
          'expired'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await qr.query(`
      DO $$ BEGIN
        CREATE TYPE escrow_trigger_enum AS ENUM (
          'system',
          'client',
          'auto',
          'admin',
          'webhook',
          'scheduler'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    /* ── 2. TABLE escrows ── */

    await qr.query(`
      CREATE TABLE IF NOT EXISTS escrows (
        id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Références
        commande_id             UUID          NOT NULL,
        commande_numero         VARCHAR(30)   NOT NULL,
        session_id              UUID          NULL,
        client_user_id          UUID          NOT NULL,
        client_wallet_id        UUID          NULL,

        -- Montants
        montant_total           DECIMAL(15,2) NOT NULL,
        montant_distribue       DECIMAL(15,2) NOT NULL DEFAULT 0,
        montant_rembourse       DECIMAL(15,2) NOT NULL DEFAULT 0,
        currency                VARCHAR(5)    NOT NULL DEFAULT 'GNF',

        -- Statut
        status                  escrow_status_enum  NOT NULL DEFAULT 'created',
        last_trigger            escrow_trigger_enum NULL DEFAULT 'system',

        -- Délais
        auto_release_at         TIMESTAMP     NULL,
        dispute_deadline_at     TIMESTAMP     NULL,
        refund_deadline_at      TIMESTAMP     NULL,

        -- Timestamps métier
        funds_received_at       TIMESTAMP     NULL,
        locked_at               TIMESTAMP     NULL,
        waiting_validation_at   TIMESTAMP     NULL,
        released_at             TIMESTAMP     NULL,
        refund_initiated_at     TIMESTAMP     NULL,
        refunded_at             TIMESTAMP     NULL,
        disputed_at             TIMESTAMP     NULL,
        resolved_at             TIMESTAMP     NULL,

        -- Litige
        dispute_id              UUID          NULL,
        dispute_decision        VARCHAR(50)   NULL,

        -- Release
        release_triggered_by    VARCHAR(20)   NULL,
        admin_decision_user_id  UUID          NULL,

        -- Erreur
        failure_reason          TEXT          NULL,

        -- Métadonnées
        metadata                JSON          NULL,

        -- Versionnage optimiste
        version                 INTEGER       NOT NULL DEFAULT 1,

        -- Dates
        created_at              TIMESTAMP     NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMP     NOT NULL DEFAULT NOW()
      );
    `);

    /* Index escrows */
    await qr.query(`CREATE INDEX IF NOT EXISTS IDX_escrow_commande_id   ON escrows (commande_id);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS IDX_escrow_status         ON escrows (status);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS IDX_escrow_session_id     ON escrows (session_id);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS IDX_escrow_created_at     ON escrows (created_at);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS IDX_escrow_auto_release   ON escrows (auto_release_at);`);

    /* Contrainte UNIQUE session_id */
    await qr.query(`
      DO $$ BEGIN
        ALTER TABLE escrows
          ADD CONSTRAINT UQ_escrow_session_id UNIQUE (session_id);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    /* ── 3. TABLE escrow_histories ── */

    await qr.query(`
      CREATE TABLE IF NOT EXISTS escrow_histories (
        id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Références
        escrow_id           UUID          NOT NULL,
        commande_id         VARCHAR(30)   NOT NULL,

        -- Transition
        from_status         escrow_status_enum   NULL,
        to_status           escrow_status_enum   NOT NULL,

        -- Déclencheur
        triggered_by        escrow_trigger_enum  NOT NULL DEFAULT 'system',
        triggered_by_user_id UUID          NULL,
        triggered_by_role   VARCHAR(50)   NULL,

        -- Contexte financier
        montant             DECIMAL(15,2) NULL,
        currency            VARCHAR(5)    NULL,

        -- Note
        note                TEXT          NULL,
        metadata            JSON          NULL,

        -- Date (immuable)
        created_at          TIMESTAMP     NOT NULL DEFAULT NOW()
      );
    `);

    /* Index escrow_histories */
    await qr.query(`CREATE INDEX IF NOT EXISTS IDX_escrow_history_escrow_id   ON escrow_histories (escrow_id);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS IDX_escrow_history_commande_id ON escrow_histories (commande_id);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS IDX_escrow_history_created_at  ON escrow_histories (created_at);`);
  }

  /* ==========================================================
   * DOWN
   * ========================================================== */

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS escrow_histories;`);
    await qr.query(`DROP TABLE IF EXISTS escrows;`);
    await qr.query(`DROP TYPE IF EXISTS escrow_trigger_enum;`);
    await qr.query(`DROP TYPE IF EXISTS escrow_status_enum;`);
  }
}
