/* ============================================================
 * FICHIER : src/database/migrations/1721400000014-totp-secret-encryption.ts
 *
 * RÔLE : Les secrets TOTP (2FA) étaient stockés en clair en base sur les
 * 6 tables de profils — voir totp-crypto.util.ts pour le détail du
 * correctif (AES-256-GCM, préfixe "v1:"). Cette migration :
 *   1. Élargit "partenaires"."twoFaSecret" (64 → 255) — le format chiffré
 *      ne tenait pas dans l'ancienne limite (~83 caractères nécessaires).
 *   2. Re-chiffre en place tout secret déjà présent en clair, sur les
 *      6 tables, pour ne laisser aucun secret existant en clair en base.
 *
 * Requiert TOTP_ENCRYPTION_KEY (même variable que TwoFaService en
 * exécution normale) — échoue explicitement si absente plutôt que de
 * laisser des secrets non migrés silencieusement.
 *
 * Idempotente : ignore toute valeur déjà préfixée "v1:" (déjà chiffrée).
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';
import * as crypto from 'crypto';

const ALGO      = 'aes-256-gcm';
const IV_LENGTH = 12;
const PREFIX    = 'v1:';

function getKey(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      '[Migration TotpSecretEncryption] TOTP_ENCRYPTION_KEY est absente — ' +
      'impossible de chiffrer les secrets TOTP existants. Configurez-la avant de relancer cette migration.',
    );
  }
  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) {
    throw new Error('[Migration TotpSecretEncryption] TOTP_ENCRYPTION_KEY doit faire 64 caractères hexadécimaux.');
  }
  return key;
}

function encrypt(plain: string): string {
  const iv     = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

/* Tables portant un twoFaSecret — voir TwoFaService.loadProfile(). */
const TABLES = ['partenaires', 'admins', 'clients', 'entreprises', 'livreurs', 'correspondants'];

export class TotpSecretEncryption1721400000014 implements MigrationInterface {
  name = 'TotpSecretEncryption1721400000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const partnerCol = await queryRunner.query(
      `SELECT character_maximum_length FROM information_schema.columns
       WHERE table_name = 'partenaires' AND column_name = 'twoFaSecret'`,
    );
    if (partnerCol[0]?.character_maximum_length && partnerCol[0].character_maximum_length < 255) {
      await queryRunner.query(`ALTER TABLE "partenaires" ALTER COLUMN "twoFaSecret" TYPE varchar(255)`);
    }

    for (const table of TABLES) {
      const rows: Array<{ id: string; twoFaSecret: string }> = await queryRunner.query(
        `SELECT id, "twoFaSecret" FROM "${table}" WHERE "twoFaSecret" IS NOT NULL AND "twoFaSecret" NOT LIKE 'v1:%'`,
      );
      for (const row of rows) {
        const encrypted = encrypt(row.twoFaSecret);
        await queryRunner.query(
          `UPDATE "${table}" SET "twoFaSecret" = $1 WHERE id = $2`,
          [encrypted, row.id],
        );
      }
      if (rows.length) {
        console.log(`[Migration TotpSecretEncryption] ${table} : ${rows.length} secret(s) chiffré(s).`);
      }
    }
  }

  public async down(): Promise<void> {
    /* Irréversible par design : redescendre en clair réintroduirait
     * exactement la faille corrigée par cette migration. */
  }
}
