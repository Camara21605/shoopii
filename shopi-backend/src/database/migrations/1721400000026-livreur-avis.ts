/* ============================================================
 * FICHIER : src/database/migrations/1721400000026-livreur-avis.ts
 *
 * RÔLE : Crée la table livreur_avis — avis clients sur un livreur,
 * miroir de company_avis pour l'acteur DELIVERY (voir
 * LivreurAvis entity + CommandeFeedbackService.envoyerNotations).
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class LivreurAvis1721400000026 implements MigrationInterface {
  name = 'LivreurAvis1721400000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('livreur_avis');
    if (!hasTable) {
      await queryRunner.query(`
        CREATE TABLE "livreur_avis" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "livreurId" uuid NOT NULL,
          "commandeId" uuid NOT NULL,
          "clientNom" character varying(255) NOT NULL DEFAULT 'Client Shopi',
          "clientInitiales" character varying(3) NOT NULL DEFAULT 'C',
          "note" smallint NOT NULL,
          "commentaire" text NULL,
          "reponse" text NULL,
          "respondedAt" TIMESTAMP NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      await queryRunner.query(`
        CREATE INDEX "IDX_avis_livreur" ON "livreur_avis" ("livreurId")
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX "IDX_avis_livreur_commandeId" ON "livreur_avis" ("commandeId")
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "livreur_avis"`);
  }
}
