/* ============================================================
 * MIGRATION : 1721000000008-call-system.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Crée les tables du système d'appels audio/vidéo :
 *   - `calls`        : appels ACTIFS uniquement (ringing/connecting/connected)
 *   - `call_history` : archive permanente, une ligne par appel terminé
 *
 * IDEMPOTENCE : IF NOT EXISTS / DO $$ BEGIN ... EXCEPTION WHEN duplicate_object.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CallSystem1721000000008 implements MigrationInterface {
  name = 'CallSystem1721000000008';

  async up(qr: QueryRunner): Promise<void> {

    /* ── ENUMS ── */

    await qr.query(`
      DO $$ BEGIN
        CREATE TYPE call_type_enum AS ENUM ('audio', 'video');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await qr.query(`
      DO $$ BEGIN
        CREATE TYPE call_status_enum AS ENUM ('ringing', 'connecting', 'connected');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await qr.query(`
      DO $$ BEGIN
        CREATE TYPE call_history_status_enum AS ENUM ('completed', 'missed', 'rejected', 'busy');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    /* ── TABLE calls (appels actifs) ── */

    await qr.query(`
      CREATE TABLE IF NOT EXISTS calls (
        "id"             UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
        "callerId"       UUID              NOT NULL,
        "calleeId"       UUID              NOT NULL,
        "conversationId" UUID              NULL,
        "callType"       call_type_enum    NOT NULL DEFAULT 'audio',
        "status"         call_status_enum  NOT NULL DEFAULT 'ringing',
        "startedAt"      TIMESTAMP         NOT NULL,
        "answeredAt"     TIMESTAMP         NULL,
        "createdAt"      TIMESTAMP         NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP         NOT NULL DEFAULT now()
      );
    `);

    await qr.query(`CREATE INDEX IF NOT EXISTS "IDX_calls_callerId" ON calls ("callerId");`);
    await qr.query(`CREATE INDEX IF NOT EXISTS "IDX_calls_calleeId" ON calls ("calleeId");`);

    /* ── TABLE call_history (archive permanente) ── */

    await qr.query(`
      CREATE TABLE IF NOT EXISTS call_history (
        "id"             UUID                      PRIMARY KEY DEFAULT gen_random_uuid(),
        "callId"         UUID                      NOT NULL,
        "callerId"       UUID                      NOT NULL,
        "calleeId"       UUID                      NOT NULL,
        "conversationId" UUID                      NULL,
        "callType"       call_type_enum            NOT NULL DEFAULT 'audio',
        "status"         call_history_status_enum  NOT NULL,
        "startedAt"      TIMESTAMP                 NOT NULL,
        "answeredAt"     TIMESTAMP                 NULL,
        "endedAt"        TIMESTAMP                 NOT NULL,
        "duration"       INT                       NOT NULL DEFAULT 0,
        "createdAt"      TIMESTAMP                 NOT NULL DEFAULT now()
      );
    `);

    await qr.query(`CREATE INDEX IF NOT EXISTS "IDX_call_history_callerId" ON call_history ("callerId");`);
    await qr.query(`CREATE INDEX IF NOT EXISTS "IDX_call_history_calleeId" ON call_history ("calleeId");`);
    await qr.query(`CREATE INDEX IF NOT EXISTS "IDX_call_history_endedAt" ON call_history ("endedAt");`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS call_history;`);
    await qr.query(`DROP TABLE IF EXISTS calls;`);
    await qr.query(`DROP TYPE IF EXISTS call_history_status_enum;`);
    await qr.query(`DROP TYPE IF EXISTS call_status_enum;`);
    await qr.query(`DROP TYPE IF EXISTS call_type_enum;`);
  }
}
