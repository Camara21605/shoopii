/* ============================================================
 * FICHIER : src/database/migrations/1721400000025-livreur-missions.ts
 *
 * RÔLE : Crée la table livreur_missions — missions de livraison
 * diffusées par une entreprise à ses livreurs disponibles (voir
 * LivreurMission entity + "Diffuser une mission" dans LivreursPage.tsx).
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class LivreurMissions1721400000025 implements MigrationInterface {
  name = 'LivreurMissions1721400000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('livreur_missions');
    if (!hasTable) {
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "livreur_missions_status_enum" AS ENUM('open','accepted','completed','cancelled');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `);
      await queryRunner.query(`
        CREATE TABLE "livreur_missions" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "companyId" uuid NOT NULL,
          "title" character varying(255) NOT NULL,
          "description" text NULL,
          "zone" character varying(255) NULL,
          "reward" numeric(15,2) NULL,
          "urgent" boolean NOT NULL DEFAULT false,
          "status" "livreur_missions_status_enum" NOT NULL DEFAULT 'open',
          "assignedDeliveryId" uuid NULL,
          "acceptedAt" TIMESTAMP NULL,
          "completedAt" TIMESTAMP NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      await queryRunner.query(`
        CREATE INDEX "IDX_livreur_missions_companyId" ON "livreur_missions" ("companyId")
      `);
      await queryRunner.query(`
        CREATE INDEX "IDX_livreur_missions_assignedDeliveryId" ON "livreur_missions" ("assignedDeliveryId")
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "livreur_missions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "livreur_missions_status_enum"`);
  }
}
