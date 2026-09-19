/* ============================================================
 * FICHIER : src/database/migrations/1721400000030-admin-profile-fields.ts
 *
 * RÔLE : deux corrections du profil administrateur.
 *  1. admins.jobTitle — le champ "Poste / Titre" du profil écrivait dans
 *     admins.zone, qui sert aussi de NOM DE ZONE dans la sidebar et la vue
 *     d'ensemble : saisir un poste renommait la zone. Colonne dédiée.
 *  2. admins.status — le compte était créé 'pending' et plus rien ne le
 *     passait à 'active' : tous les admins s'affichaient "En attente" et
 *     étaient absents de la liste des agents de support (filtrée sur
 *     status = 'active'). Les admins dont le compte utilisateur est actif
 *     sont remis à 'active'.
 * down() : retire la colonne ; le statut n'est pas restauré.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminProfileFields1721400000030 implements MigrationInterface {
  name = 'AdminProfileFields1721400000030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('admins', 'jobTitle'))) {
      await queryRunner.query(`ALTER TABLE "admins" ADD COLUMN "jobTitle" character varying(100) NULL`);
    }
    await queryRunner.query(`
      UPDATE "admins" a SET "status" = 'active'
      FROM "users" u
      WHERE u."id" = a."userId" AND a."status" = 'pending' AND u."status" = 'active'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "admins" DROP COLUMN IF EXISTS "jobTitle"`);
  }
}
