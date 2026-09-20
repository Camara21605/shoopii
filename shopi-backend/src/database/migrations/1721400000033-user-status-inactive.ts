/* ============================================================
 * FICHIER : src/database/migrations/1721400000033-user-status-inactive.ts
 *
 * RÔLE : ajoute la valeur « inactive » à l'énumération users.status.
 *
 * POURQUOI : « Désactiver mon compte » (Paramètres → Zone de danger) écrivait
 * status = 'inactive' alors que l'énumération PostgreSQL ne contenait que
 * active | pending | suspended | banned : l'action échouait en erreur 500.
 * Un compte désactivé volontairement (≠ suspendu/banni par l'administration)
 * est réactivé automatiquement à la prochaine connexion réussie.
 *
 * up()   : ajout de la valeur (idempotent).
 * down() : PostgreSQL ne sait pas retirer une valeur d'énumération ; on remet
 *          seulement les comptes « inactive » en « active » (la valeur reste
 *          déclarée mais inutilisée — sans conséquence).
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserStatusInactive1721400000033 implements MigrationInterface {
  name = 'UserStatusInactive1721400000033';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "users_status_enum" ADD VALUE IF NOT EXISTS 'inactive'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "users" SET "status" = 'active' WHERE "status"::text = 'inactive'`);
  }
}
