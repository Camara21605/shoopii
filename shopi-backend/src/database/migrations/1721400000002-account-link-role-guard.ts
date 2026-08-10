/* ============================================================
 * FICHIER : src/database/migrations/1721400000002-account-link-role-guard.ts
 *
 * RÔLE : Garde-fou DB (défense en profondeur) pour account_links — garantit
 * que "proUserId" référence toujours une ligne "users" avec un rôle pro
 * (company/delivery/correspondent/partner/admin) et que "clientUserId"
 * référence toujours une ligne "users" avec role='client'.
 *
 * POURQUOI UN TRIGGER ET PAS UN CHECK CONSTRAINT : un CHECK constraint
 * Postgres ne peut pas référencer une AUTRE table (ici "users") — seule
 * une contrainte d'exclusion via trigger BEFORE INSERT/UPDATE le permet.
 *
 * Aujourd'hui cette invariante n'est garantie que côté applicatif
 * (AccountLinkService.PRO_ROLES) — ce trigger protège contre un futur bug
 * applicatif, un script admin direct, ou une migration de données mal
 * écrite qui insérerait une ligne account_links incohérente.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

const PRO_ROLES_SQL = `'company', 'delivery', 'correspondent', 'partner', 'admin'`;

export class AccountLinkRoleGuard1721400000002 implements MigrationInterface {
  name = 'AccountLinkRoleGuard1721400000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION check_account_link_roles() RETURNS TRIGGER AS $$
      DECLARE
        pro_role    text;
        client_role text;
      BEGIN
        SELECT role INTO pro_role    FROM users WHERE id = NEW."proUserId";
        SELECT role INTO client_role FROM users WHERE id = NEW."clientUserId";

        IF pro_role IS NULL THEN
          RAISE EXCEPTION 'account_links.proUserId (%) ne référence aucun utilisateur', NEW."proUserId";
        END IF;
        IF client_role IS NULL THEN
          RAISE EXCEPTION 'account_links.clientUserId (%) ne référence aucun utilisateur', NEW."clientUserId";
        END IF;
        IF pro_role NOT IN (${PRO_ROLES_SQL}) THEN
          RAISE EXCEPTION 'account_links.proUserId doit référencer un compte pro (rôle actuel: %)', pro_role;
        END IF;
        IF client_role <> 'client' THEN
          RAISE EXCEPTION 'account_links.clientUserId doit référencer un compte client (rôle actuel: %)', client_role;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_check_account_link_roles ON "account_links"`);
    await queryRunner.query(`
      CREATE TRIGGER trg_check_account_link_roles
      BEFORE INSERT OR UPDATE ON "account_links"
      FOR EACH ROW EXECUTE FUNCTION check_account_link_roles();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_check_account_link_roles ON "account_links"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS check_account_link_roles()`);
  }
}
