/* ============================================================
 * FICHIER : src/database/migrations/1721400000037-signup-code-delivery-partner.ts
 *
 * RÔLE : deux nouveaux réglages super-admin (Paramètres > Inscriptions),
 *        sur le modèle de codeRequiredForCompany :
 *   - platform_settings.codeRequiredForDelivery
 *   - platform_settings.codeRequiredForPartner
 *   true  = inscription uniquement par invitation (code / lien) ;
 *   false = inscription libre.
 * Défaut true : rien ne change tant que le super-admin ne décoche pas.
 * down() : retire les colonnes.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class SignupCodeDeliveryPartner1721400000037 implements MigrationInterface {
  name = 'SignupCodeDeliveryPartner1721400000037';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform_settings"
        ADD COLUMN IF NOT EXISTS "codeRequiredForDelivery" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "codeRequiredForPartner"  boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform_settings"
        DROP COLUMN IF EXISTS "codeRequiredForDelivery",
        DROP COLUMN IF EXISTS "codeRequiredForPartner"
    `);
  }
}
