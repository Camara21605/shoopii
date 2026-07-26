/* ============================================================
 * MIGRATION : 1721000000002-wallet-engine-extension.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Étend le schéma existant pour le Wallet Engine de Shopi.
 *
 * OPÉRATIONS
 * ------------------------------------------------------------
 * 1. Nouveaux types ENUM PostgreSQL (idempotent)
 *    - wallet_operation_type_enum
 *    - balance_type_enum
 *    - wallet_type_enum
 *    - ledger_entry_direction_enum
 *    - ledger_currency_enum
 *
 * 2. Nouvelles colonnes sur `wallets`
 *    - wallet_type, blocked_balance, reserved_balance,
 *      withdrawing_balance, version, last_transaction_at
 *
 * 3. Nouvelles colonnes sur `wallet_transactions`
 *    - operation_type, balance_type, idempotency_key,
 *      performed_by_role, note, ip_address, metadata
 *
 * 4. Nouvelle table `wallet_ledger_entries`
 *
 * IDEMPOTENCE
 * ------------------------------------------------------------
 * Toutes les opérations utilisent IF NOT EXISTS / DO $$ BEGIN
 * pour être ré-exécutables sans erreur.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class WalletEngineExtension1721000000002 implements MigrationInterface {
  name = 'WalletEngineExtension1721000000002';

  /* ==========================================================
   * UP
   * ========================================================== */

  async up(qr: QueryRunner): Promise<void> {

    /* ── 1. ENUMS ── */

    await qr.query(`
      DO $$ BEGIN
        CREATE TYPE wallet_operation_type_enum AS ENUM (
          'escrow_credit', 'escrow_release', 'escrow_cancel',
          'withdrawal_init', 'withdrawal_confirm', 'withdrawal_fail',
          'deposit', 'commission', 'refund',
          'block', 'unblock', 'reserve', 'release',
          'transfer_in', 'transfer_out',
          'adjustment', 'correction', 'creation'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await qr.query(`
      DO $$ BEGIN
        CREATE TYPE balance_type_enum AS ENUM (
          'balance', 'pending', 'blocked', 'reserved', 'withdrawing'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await qr.query(`
      DO $$ BEGIN
        CREATE TYPE wallet_type_enum AS ENUM (
          'client', 'entreprise', 'livreur', 'correspondant',
          'partenaire', 'administrateur', 'plateforme', 'system'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await qr.query(`
      DO $$ BEGIN
        CREATE TYPE ledger_entry_direction_enum AS ENUM ('debit', 'credit');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await qr.query(`
      DO $$ BEGIN
        CREATE TYPE ledger_currency_enum AS ENUM ('GNF', 'USD', 'EUR');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    /* ── 2. COLONNES wallets ── */

    await qr.query(`
      ALTER TABLE wallets
        ADD COLUMN IF NOT EXISTS wallet_type      wallet_type_enum NOT NULL DEFAULT 'client',
        ADD COLUMN IF NOT EXISTS blocked_balance  DECIMAL(15,2)    NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS reserved_balance DECIMAL(15,2)    NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS withdrawing_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS version          INTEGER          NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS last_transaction_at TIMESTAMP     NULL;
    `);

    /* ── 3. COLONNES wallet_transactions ── */

    await qr.query(`
      ALTER TABLE wallet_transactions
        ADD COLUMN IF NOT EXISTS operation_type   wallet_operation_type_enum NULL,
        ADD COLUMN IF NOT EXISTS balance_type     balance_type_enum          NULL,
        ADD COLUMN IF NOT EXISTS idempotency_key  VARCHAR(255)               NULL,
        ADD COLUMN IF NOT EXISTS performed_by_role VARCHAR(50)               NULL,
        ADD COLUMN IF NOT EXISTS note             TEXT                       NULL,
        ADD COLUMN IF NOT EXISTS ip_address       VARCHAR(45)                NULL,
        ADD COLUMN IF NOT EXISTS metadata         JSON                       NULL;
    `);

    /* Contrainte UNIQUE idempotency_key (NULL ignoré par PostgreSQL) */
    await qr.query(`
      DO $$ BEGIN
        ALTER TABLE wallet_transactions
          ADD CONSTRAINT UQ_wallet_transaction_idempotency
          UNIQUE (idempotency_key);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    /* Index operation_type */
    await qr.query(`
      CREATE INDEX IF NOT EXISTS IDX_wallet_transaction_operation_type
        ON wallet_transactions (operation_type);
    `);

    /* ── 4. TABLE wallet_ledger_entries ── */

    await qr.query(`
      CREATE TABLE IF NOT EXISTS wallet_ledger_entries (
        id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
        reference           VARCHAR(100)   NULL,
        wallet_id           UUID           NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
        transaction_id      UUID           NULL     REFERENCES wallet_transactions(id) ON DELETE RESTRICT,
        operation_type      wallet_operation_type_enum NULL,
        direction           ledger_entry_direction_enum NOT NULL,
        debit               DECIMAL(15,2)  NOT NULL DEFAULT 0,
        credit              DECIMAL(15,2)  NOT NULL DEFAULT 0,
        currency            ledger_currency_enum NOT NULL DEFAULT 'GNF',
        balance_type        balance_type_enum NULL,
        balance_before      DECIMAL(15,2)  NOT NULL,
        balance_after       DECIMAL(15,2)  NOT NULL,
        description         TEXT           NULL,
        reference_type      VARCHAR(50)    NULL,
        reference_id        VARCHAR(255)   NULL,
        performed_by_user_id UUID          NULL,
        performed_by_role   VARCHAR(50)    NULL,
        ip_address          VARCHAR(45)    NULL,
        is_reversed         BOOLEAN        NOT NULL DEFAULT FALSE,
        reversed_by_entry_id UUID          NULL,
        metadata            JSON           NULL,
        created_at          TIMESTAMP      NOT NULL DEFAULT NOW()
      );
    `);

    /* Index ledger */
    await qr.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS IDX_ledger_reference_code
        ON wallet_ledger_entries (reference) WHERE reference IS NOT NULL;
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS IDX_ledger_wallet_id       ON wallet_ledger_entries (wallet_id);
      CREATE INDEX IF NOT EXISTS IDX_ledger_transaction_id  ON wallet_ledger_entries (transaction_id);
      CREATE INDEX IF NOT EXISTS IDX_ledger_operation_type  ON wallet_ledger_entries (operation_type);
      CREATE INDEX IF NOT EXISTS IDX_ledger_balance_type    ON wallet_ledger_entries (balance_type);
      CREATE INDEX IF NOT EXISTS IDX_ledger_created_at      ON wallet_ledger_entries (created_at);
      CREATE INDEX IF NOT EXISTS IDX_ledger_wallet_created  ON wallet_ledger_entries (wallet_id, created_at);
      CREATE INDEX IF NOT EXISTS IDX_ledger_reference       ON wallet_ledger_entries (reference_type, reference_id);
    `);
  }

  /* ==========================================================
   * DOWN
   * ========================================================== */

  async down(qr: QueryRunner): Promise<void> {
    /* Tables */
    await qr.query(`DROP TABLE IF EXISTS wallet_ledger_entries;`);

    /* Colonnes wallet_transactions */
    await qr.query(`
      ALTER TABLE wallet_transactions
        DROP COLUMN IF EXISTS operation_type,
        DROP COLUMN IF EXISTS balance_type,
        DROP COLUMN IF EXISTS idempotency_key,
        DROP COLUMN IF EXISTS performed_by_role,
        DROP COLUMN IF EXISTS note,
        DROP COLUMN IF EXISTS ip_address,
        DROP COLUMN IF EXISTS metadata;
    `);

    /* Colonnes wallets */
    await qr.query(`
      ALTER TABLE wallets
        DROP COLUMN IF EXISTS wallet_type,
        DROP COLUMN IF EXISTS blocked_balance,
        DROP COLUMN IF EXISTS reserved_balance,
        DROP COLUMN IF EXISTS withdrawing_balance,
        DROP COLUMN IF EXISTS version,
        DROP COLUMN IF EXISTS last_transaction_at;
    `);

    /* Enums */
    await qr.query(`DROP TYPE IF EXISTS ledger_currency_enum;`);
    await qr.query(`DROP TYPE IF EXISTS ledger_entry_direction_enum;`);
    await qr.query(`DROP TYPE IF EXISTS wallet_type_enum;`);
    await qr.query(`DROP TYPE IF EXISTS balance_type_enum;`);
    await qr.query(`DROP TYPE IF EXISTS wallet_operation_type_enum;`);
  }
}
