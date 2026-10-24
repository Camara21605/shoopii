/* ============================================================
 * FICHIER : src/database/migrations/1721400000043-zone-distance.ts
 *
 * RÔLE : distance d'une zone de livraison tracée entre deux lieux
 *        (calculée automatiquement : route ou vol d'oiseau). Aussi
 *        appliqué au démarrage par schema-patches.ts.
 * down() : retire les deux colonnes.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class ZoneDistance1721400000043 implements MigrationInterface {
  name = 'ZoneDistance1721400000043';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "geo_zones" ADD COLUMN IF NOT EXISTS "distance_km" numeric(10,2) NULL, ADD COLUMN IF NOT EXISTS "distance_source" character varying(20) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "geo_zones" DROP COLUMN IF EXISTS "distance_km", DROP COLUMN IF EXISTS "distance_source"`);
  }
}
