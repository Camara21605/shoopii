/* ============================================================
 * FICHIER : src/database/migrations/1721300000000-partner-twofa-secret.ts
 *
 * Ajoute la colonne "twoFaSecret" à la table "partenaires".
 * Les 5 autres profils (admins, clients, correspondants,
 * entreprises, livreurs) ont déjà cette colonne — seul le
 * profil Partenaire ne l'avait pas encore, ce qui empêchait
 * l'activation d'une 2FA TOTP réelle pour ce rôle.
 * ============================================================ */

import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class PartnerTwoFaSecret1721300000000 implements MigrationInterface {
  name = 'PartnerTwoFaSecret1721300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('partenaires', 'twoFaSecret');
    if (!hasColumn) {
      await queryRunner.addColumn(
        'partenaires',
        new TableColumn({
          name: 'twoFaSecret',
          type: 'varchar',
          length: '64',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('partenaires', 'twoFaSecret');
    if (hasColumn) {
      await queryRunner.dropColumn('partenaires', 'twoFaSecret');
    }
  }
}
