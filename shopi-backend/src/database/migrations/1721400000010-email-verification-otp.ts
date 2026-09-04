/* ============================================================
 * FICHIER : src/database/migrations/1721400000010-email-verification-otp.ts
 *
 * RÔLE : Active PlatformSettings.emailVerifRequired — jusqu'ici ce
 * réglage se sauvegardait en base sans jamais être appliqué (voir
 * AuthService.register()/verifyEmail() pour le nouveau flux).
 *
 * 1. Ajoute les 5 colonnes emailVerify* sur "users" (OTP dédié,
 *    séparé de resetOtp* — voir user.entity.ts).
 * 2. GRANDFATHERING : marque tous les comptes EXISTANTS comme déjà
 *    vérifiés. Sans ça, chaque compte inscrit avant ce correctif (la
 *    colonne "emailVerified" a toujours eu default:false, jamais
 *    appliqué avant aujourd'hui) se retrouverait bloqué à la
 *    prochaine connexion dès l'activation du réglage — une régression
 *    massive et immédiate pour des utilisateurs réels. Seuls les
 *    comptes créés APRÈS cette migration suivent le vrai flux OTP.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailVerificationOtp1721400000010 implements MigrationInterface {
  name = 'EmailVerificationOtp1721400000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns: [string, string][] = [
      ['emailVerifyOtpHash',       'varchar(255) NULL'],
      ['emailVerifyOtpExpiry',     'timestamp NULL'],
      ['emailVerifyOtpAttempts',   'int NOT NULL DEFAULT 0'],
      ['emailVerifyRequestedAt',   'timestamp NULL'],
      ['emailVerifyRequestCount',  'int NOT NULL DEFAULT 0'],
    ];

    for (const [name, def] of columns) {
      const has = await queryRunner.hasColumn('users', name);
      if (!has) {
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "${name}" ${def}`);
      }
    }

    // Grandfathering — voir en-tête du fichier.
    await queryRunner.query(`UPDATE "users" SET "emailVerified" = true WHERE "emailVerified" = false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const columns = [
      'emailVerifyOtpHash', 'emailVerifyOtpExpiry', 'emailVerifyOtpAttempts',
      'emailVerifyRequestedAt', 'emailVerifyRequestCount',
    ];
    for (const name of columns) {
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "${name}"`);
    }
    // Le grandfathering (UPDATE emailVerified=true) n'est volontairement pas
    // annulé — impossible de distinguer après coup les comptes qui étaient
    // déjà à true naturellement de ceux backfillés par cette migration.
  }
}
