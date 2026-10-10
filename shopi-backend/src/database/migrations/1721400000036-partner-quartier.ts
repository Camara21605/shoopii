/* ============================================================
 * FICHIER : src/database/migrations/1721400000036-partner-quartier.ts
 *
 * RÔLE : le quartier du partenaire (partenaires.quartier).
 *   Livreurs, correspondants et entreprises avaient déjà le leur
 *   (voir 1721400000032-actor-quartier) ; le partenaire choisit
 *   désormais aussi son quartier à l'inscription, dans le référentiel
 *   géo du super-admin. Les partenaires existants restent à NULL :
 *   rien n'est inventé.
 * down() : retire la colonne.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class PartnerQuartier1721400000036 implements MigrationInterface {
  name = 'PartnerQuartier1721400000036';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "partenaires" ADD COLUMN IF NOT EXISTS "quartier" character varying(100) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "partenaires" DROP COLUMN IF EXISTS "quartier"`);
  }
}
