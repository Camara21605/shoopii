/* ============================================================
 * FICHIER : src/database/migrations/1721400000013-user-name-changed-at.ts
 *
 * RÔLE : Ajoute users.nameChangedAt — trace la date du dernier changement
 * de prénom/nom pour limiter cette modification à une fois tous les 3
 * mois (demande explicite : le numéro de téléphone devient définitivement
 * non modifiable, le nom ne l'est qu'après un délai de carence).
 * Voir ProfilPartenaireService.updateProfil().
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserNameChangedAt1721400000013 implements MigrationInterface {
  name = 'UserNameChangedAt1721400000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasCol = await queryRunner.hasColumn('users', 'nameChangedAt');
    if (!hasCol) {
      await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "nameChangedAt" timestamp NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "nameChangedAt"`);
  }
}
