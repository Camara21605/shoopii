/* ============================================================
 * FICHIER : src/database/migrations/1721400000027-correspondant-avis.ts
 *
 * RÔLE : Crée la table correspondant_avis — avis clients sur un
 * correspondant, miroir de company_avis/livreur_avis pour l'acteur
 * CORRESPONDENT (voir CorrespondantAvis entity + CommandeFeedbackService
 * .envoyerNotations). Ajoute aussi correspondants.totalRatings, absent
 * jusqu'ici (seul averageRating existait, sans dénominateur dédié).
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CorrespondantAvis1721400000027 implements MigrationInterface {
  name = 'CorrespondantAvis1721400000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('correspondants', 'totalRatings');
    if (!hasColumn) {
      await queryRunner.query(`
        ALTER TABLE "correspondants" ADD COLUMN "totalRatings" integer NOT NULL DEFAULT 0
      `);
    }

    const hasTable = await queryRunner.hasTable('correspondant_avis');
    if (!hasTable) {
      await queryRunner.query(`
        CREATE TABLE "correspondant_avis" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "correspondantId" uuid NOT NULL,
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
        CREATE INDEX "IDX_avis_correspondant" ON "correspondant_avis" ("correspondantId")
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX "IDX_avis_correspondant_commandeId" ON "correspondant_avis" ("commandeId")
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "correspondant_avis"`);
    await queryRunner.query(`ALTER TABLE "correspondants" DROP COLUMN IF EXISTS "totalRatings"`);
  }
}
