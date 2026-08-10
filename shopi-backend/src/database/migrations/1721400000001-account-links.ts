/* ============================================================
 * FICHIER : src/database/migrations/1721400000001-account-links.ts
 * Crée la table "account_links" — voir account-link.entity.ts.
 *
 * L'unicité "au plus un lien actif par compte" est un index unique
 * PARTIEL (WHERE status='active'), pas une contrainte simple sur la
 * colonne — les liens révoqués (délier un compte pro d'un compte
 * client) doivent pouvoir coexister avec un nouveau lien actif ultérieur.
 * ============================================================ */

import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AccountLinks1721400000001 implements MigrationInterface {
  name = 'AccountLinks1721400000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('account_links');
    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: 'account_links',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
            { name: 'proUserId', type: 'uuid' },
            { name: 'clientUserId', type: 'uuid' },
            { name: 'linkMethod', type: 'enum', enum: ['quick_create', 'existing_account_verified'] },
            { name: 'verifiedVia', type: 'enum', enum: ['password', 'otp_email', 'otp_sms'], isNullable: true },
            { name: 'status', type: 'enum', enum: ['active', 'revoked'], default: `'active'` },
            { name: 'linkedAt', type: 'timestamp' },
            { name: 'revokedAt', type: 'timestamp', isNullable: true },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          ],
        }),
        true,
      );
    } else {
      // Table déjà créée par une exécution antérieure (ex. DB_SYNC en dev,
      // avant l'ajout de status/revokedAt) — complète le schéma sans recréer.
      const hasStatus = await queryRunner.hasColumn('account_links', 'status');
      if (!hasStatus) {
        await queryRunner.query(
          `ALTER TABLE "account_links" ADD COLUMN "status" account_links_status_enum NOT NULL DEFAULT 'active'`,
        ).catch(async () => {
          // Le type enum n'existe pas encore s'il n'a jamais été créé par synchronize().
          await queryRunner.query(`CREATE TYPE "account_links_status_enum" AS ENUM ('active', 'revoked')`);
          await queryRunner.query(
            `ALTER TABLE "account_links" ADD COLUMN "status" "account_links_status_enum" NOT NULL DEFAULT 'active'`,
          );
        });
      }
      const hasRevokedAt = await queryRunner.hasColumn('account_links', 'revokedAt');
      if (!hasRevokedAt) {
        await queryRunner.query(`ALTER TABLE "account_links" ADD COLUMN "revokedAt" timestamp NULL`);
      }
    }

    // Remplace les éventuels index uniques simples (posés par une exécution
    // antérieure via synchronize()) par les index partiels sur status='active'.
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_account_links_proUserId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_account_links_clientUserId"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UNIQ_account_link_pro_active" ON "account_links" ("proUserId") WHERE "status" = 'active'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UNIQ_account_link_client_active" ON "account_links" ("clientUserId") WHERE "status" = 'active'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('account_links', true);
  }
}
