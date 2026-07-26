/* ============================================================
 * MIGRATION : 1721000000004-payment-engine.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Crée les tables et étend les enums nécessaires au Payment Engine.
 *
 * OPÉRATIONS
 * ------------------------------------------------------------
 * 1. Extension de paiement_session_status_enum
 *    → Ajoute: processing, cancelled, partially_refunded, disputed
 *
 * 2. Table `payment_provider_configs`
 *    → Configuration dynamique des providers (clés API, limites)
 *
 * IDEMPOTENCE
 * ------------------------------------------------------------
 * Toutes les opérations utilisent IF NOT EXISTS / DO $$ BEGIN
 * pour être ré-exécutables sans erreur.
 *
 * ORDRE D'EXÉCUTION
 * ------------------------------------------------------------
 * Après :
 *   - 1721000000000-paiement-system-complete.ts
 *   - 1721000000003-escrow-engine.ts
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentEngine1721000000004 implements MigrationInterface {
  name = 'PaymentEngine1721000000004';

  /* ==========================================================
   * UP
   * ========================================================== */

  async up(qr: QueryRunner): Promise<void> {

    /* ── 1. Extension de l'enum paiement_session_status ── */

    await qr.query(`
      DO $$ BEGIN
        ALTER TYPE paiement_session_status_enum ADD VALUE IF NOT EXISTS 'processing';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await qr.query(`
      DO $$ BEGIN
        ALTER TYPE paiement_session_status_enum ADD VALUE IF NOT EXISTS 'cancelled';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await qr.query(`
      DO $$ BEGIN
        ALTER TYPE paiement_session_status_enum ADD VALUE IF NOT EXISTS 'partially_refunded';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await qr.query(`
      DO $$ BEGIN
        ALTER TYPE paiement_session_status_enum ADD VALUE IF NOT EXISTS 'disputed';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    /* ── 2. Enum provider_environment ─────────────────────── */

    await qr.query(`
      DO $$ BEGIN
        CREATE TYPE provider_environment_enum AS ENUM ('test', 'production');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    /* ── 3. Table payment_provider_configs ─────────────────── */

    await qr.query(`
      CREATE TABLE IF NOT EXISTS payment_provider_configs (
        id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Provider
        provider                VARCHAR(50)   NOT NULL,
        is_active               BOOLEAN       NOT NULL DEFAULT false,
        environment             provider_environment_enum NOT NULL DEFAULT 'test',

        -- Clés API production
        api_key                 VARCHAR(500)  NULL,
        api_secret              VARCHAR(500)  NULL,
        webhook_secret          VARCHAR(500)  NULL,

        -- Clés API test / bac à sable
        test_api_key            VARCHAR(500)  NULL,
        test_api_secret         VARCHAR(500)  NULL,
        test_webhook_secret     VARCHAR(500)  NULL,

        -- Limites financières
        min_amount              DECIMAL(15,2) NOT NULL DEFAULT 100,
        max_amount              DECIMAL(15,2) NOT NULL DEFAULT 10000000,
        daily_limit             DECIMAL(15,2) NULL,

        -- Configuration spécifique provider
        config                  JSON          NULL,

        -- Audit activation
        activated_at            TIMESTAMP     NULL,
        activated_by_user_id    UUID          NULL,
        deactivated_at          TIMESTAMP     NULL,
        deactivated_by_user_id  UUID          NULL,

        -- Dates
        created_at              TIMESTAMP     NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMP     NOT NULL DEFAULT NOW(),

        CONSTRAINT UQ_provider_config_provider UNIQUE (provider)
      );
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS IDX_provider_config_active
        ON payment_provider_configs (is_active);
    `);

    /* ── 4. Initialisation des configs par défaut ──────────── */

    await qr.query(`
      INSERT INTO payment_provider_configs (provider, is_active, environment)
      VALUES
        ('internal', true,  'test'),
        ('fedapay',  false, 'test'),
        ('cinetpay', false, 'test'),
        ('paydunya', false, 'test'),
        ('wave',     false, 'test')
      ON CONFLICT (provider) DO NOTHING;
    `);
  }

  /* ==========================================================
   * DOWN
   * ========================================================== */

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS payment_provider_configs;`);
    await qr.query(`DROP TYPE IF EXISTS provider_environment_enum;`);
  }
}
