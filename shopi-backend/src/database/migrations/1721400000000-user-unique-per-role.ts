/* ============================================================
 * FICHIER : src/database/migrations/1721400000000-user-unique-per-role.ts
 *
 * Remplace l'unicité GLOBALE de "users".email/phone/phoneHash par une
 * unicité PAR RÔLE — nécessaire pour permettre à un compte pro (entreprise,
 * livreur, correspondant, admin, partenaire) de posséder un compte client
 * lié utilisant le même email/téléphone (voir account-link.entity.ts).
 *
 * Aucune perte de données possible : l'ancienne contrainte étant plus
 * stricte (unique tous rôles confondus), toutes les lignes existantes
 * satisfont déjà automatiquement la nouvelle contrainte composite.
 *
 * Les anciens index/contraintes unique sur "email"/"phone"/"phoneHash" ont
 * été créés par TypeORM synchronize() avec des noms auto-générés (sauf
 * "UNIQ_user_email", nommé explicitement) — on les retrouve dynamiquement
 * via pg_indexes plutôt que de deviner leur nom.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserUniquePerRole1721400000000 implements MigrationInterface {
  name = 'UserUniquePerRole1721400000000';

  private async dropUniqueIndexesOn(queryRunner: QueryRunner, column: string): Promise<void> {
    const rows: { indexname: string }[] = await queryRunner.query(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'users'
         AND indexdef ILIKE '%UNIQUE%'
         AND indexdef ILIKE '%(' || $1 || ')%'`,
      [column],
    );
    for (const { indexname } of rows) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${indexname}"`);
    }
  }

  /**
   * Vérifie qu'aucun doublon (colonne, role) n'existe déjà avant de poser la
   * nouvelle contrainte composite — en théorie impossible tant que l'ancienne
   * contrainte UNIQUE(colonne) globale (plus stricte) a toujours été active,
   * mais DB_SYNC=true est utilisé en dev sur ce projet et peut avoir laissé
   * la base dans un état incohérent si le schéma a divergé entre-temps.
   * Se contente de LOGGUER : si des doublons existent malgré tout, le
   * CREATE UNIQUE INDEX qui suit échouera de toute façon (garde-fou réel),
   * mais avec ce log on sait exactement QUELLES lignes nettoyer au lieu de
   * décoder une erreur de contrainte Postgres brute.
   */
  private async logDuplicatesBeforeConstraint(
    queryRunner: QueryRunner, column: string, whereNotNull = false,
  ): Promise<void> {
    const duplicates: { value: string; role: string; count: string }[] = await queryRunner.query(
      `SELECT "${column}" AS value, role, COUNT(*) AS count
       FROM "users"
       ${whereNotNull ? `WHERE "${column}" IS NOT NULL` : ''}
       GROUP BY "${column}", role
       HAVING COUNT(*) > 1`,
    );
    if (duplicates.length > 0) {
      console.warn(
        `[Migration UserUniquePerRole] ⚠️ ${duplicates.length} doublon(s) (${column}, role) trouvé(s) — ` +
        `la contrainte UNIQUE("${column}", role) va échouer tant qu'ils ne sont pas nettoyés :`,
        JSON.stringify(duplicates),
      );
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.logDuplicatesBeforeConstraint(queryRunner, 'email');
    await this.logDuplicatesBeforeConstraint(queryRunner, 'phone', true);
    await this.logDuplicatesBeforeConstraint(queryRunner, 'phoneHash', true);

    // Contrainte nommée explicitement par l'ancienne entité — celle-ci a un nom connu.
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "UNIQ_user_email"`);

    // Index unique auto-nommés (email seul, phone seul, phoneHash seul).
    await this.dropUniqueIndexesOn(queryRunner, 'email');
    await this.dropUniqueIndexesOn(queryRunner, 'phone');
    await this.dropUniqueIndexesOn(queryRunner, '"phoneHash"');

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UNIQ_user_email_role" ON "users" ("email", "role")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UNIQ_user_phone_role" ON "users" ("phone", "role")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UNIQ_user_phoneHash_role" ON "users" ("phoneHash", "role") WHERE "phoneHash" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UNIQ_user_email_role"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UNIQ_user_phone_role"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UNIQ_user_phoneHash_role"`);

    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UNIQ_user_email" UNIQUE ("email")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_phone" ON "users" ("phone")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_phoneHash" ON "users" ("phoneHash") WHERE "phoneHash" IS NOT NULL`,
    );
  }
}
