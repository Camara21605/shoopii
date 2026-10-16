/* ============================================================
 * FICHIER : src/database/migrations/1721400000041-commande-adresse-gps.ts
 *
 * RÔLE : adresse de livraison complète dans la commande — quartier
 *        (référentiel du super admin) et position GPS exacte du client,
 *        pour guider le livreur. Aussi appliqué au démarrage par
 *        schema-patches.ts.
 * down() : retire les trois colonnes.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommandeAdresseGps1721400000041 implements MigrationInterface {
  name = 'CommandeAdresseGps1721400000041';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "commandes" ADD COLUMN IF NOT EXISTS "quartierLivraison" character varying(100) NULL, ADD COLUMN IF NOT EXISTS "latitudeLivraison" numeric(9,6) NULL, ADD COLUMN IF NOT EXISTS "longitudeLivraison" numeric(9,6) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "commandes" DROP COLUMN IF EXISTS "quartierLivraison", DROP COLUMN IF EXISTS "latitudeLivraison", DROP COLUMN IF EXISTS "longitudeLivraison"`);
  }
}
