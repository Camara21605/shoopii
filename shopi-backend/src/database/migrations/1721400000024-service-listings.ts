/* ============================================================
 * FICHIER : src/database/migrations/1721400000024-service-listings.ts
 *
 * RÔLE : Crée les 4 tables des prestations de service — pendant de
 * products/product_media/product_specs/product_likes, mais réservé aux
 * entreprises dont businessModel='services' (voir service.entity.ts
 * pour le détail des champs et ce qui est volontairement absent :
 * stock, dimensions, livraison, vente en gros, variantes, stories).
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class ServiceListings1721400000024 implements MigrationInterface {
  name = 'ServiceListings1721400000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    /* ── services ── */
    const hasServices = await queryRunner.hasTable('services');
    if (!hasServices) {
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "services_visibilite_enum" AS ENUM('public','draft','private');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `);
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "services_pricingtype_enum" AS ENUM('fixe','horaire','sur_devis');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `);
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "services_delaireponse_enum" AS ENUM('immediate','24h','48h','7j');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `);
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "services_politiqueannulation_enum" AS ENUM('flexible','moderee','stricte','non_remboursable');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `);

      await queryRunner.query(`
        CREATE TABLE "services" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "companyId" uuid NOT NULL,
          "categoryId" uuid NOT NULL,
          "subCategoryId" uuid NULL,
          "nom" character varying(255) NOT NULL,
          "description" text NULL,
          "tags" character varying(500) NULL,
          "visibilite" "services_visibilite_enum" NOT NULL DEFAULT 'draft',
          "langue" character varying(5) NOT NULL DEFAULT 'fr',
          "pricingType" "services_pricingtype_enum" NOT NULL DEFAULT 'fixe',
          "prix" bigint NULL,
          "prixAncien" bigint NULL,
          "dureeMinMinutes" integer NULL,
          "dureeMaxMinutes" integer NULL,
          "capaciteMax" integer NULL,
          "surPlaceEntreprise" boolean NOT NULL DEFAULT true,
          "aDomicile" boolean NOT NULL DEFAULT false,
          "aDistance" boolean NOT NULL DEFAULT false,
          "zoneCouverture" character varying(500) NULL,
          "fraisDeplacement" integer NULL,
          "reservationRequise" boolean NOT NULL DEFAULT true,
          "delaiReponse" "services_delaireponse_enum" NOT NULL DEFAULT '24h',
          "politiqueAnnulation" "services_politiqueannulation_enum" NOT NULL DEFAULT 'moderee',
          "garantiePaiement" boolean NOT NULL DEFAULT true,
          "garantieSatisfaction" boolean NOT NULL DEFAULT true,
          "titreSeo" character varying(70) NULL,
          "descriptionSeo" character varying(160) NULL,
          "urlSlug" character varying(255) NULL,
          "likesCount" integer NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "FK_services_company" FOREIGN KEY ("companyId") REFERENCES "entreprises"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_services_category" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT,
          CONSTRAINT "FK_services_subCategory" FOREIGN KEY ("subCategoryId") REFERENCES "sub_categories"("id") ON DELETE SET NULL
        )
      `);
      await queryRunner.query(`CREATE INDEX "IDX_services_companyId" ON "services" ("companyId")`);
      await queryRunner.query(`CREATE INDEX "IDX_services_categoryId" ON "services" ("categoryId")`);
      await queryRunner.query(`CREATE INDEX "IDX_services_createdAt" ON "services" ("createdAt")`);
      await queryRunner.query(`CREATE UNIQUE INDEX "IDX_services_urlSlug" ON "services" ("urlSlug")`);
    }

    /* ── service_media ── */
    const hasMedia = await queryRunner.hasTable('service_media');
    if (!hasMedia) {
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "service_media_type_enum" AS ENUM('image','video');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `);
      await queryRunner.query(`
        CREATE TABLE "service_media" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "type" "service_media_type_enum" NOT NULL DEFAULT 'image',
          "url" character varying(500) NOT NULL,
          "originalName" character varying(255) NULL,
          "mimeType" character varying(100) NULL,
          "size" bigint NULL,
          "duration" integer NULL,
          "ordre" integer NOT NULL DEFAULT 0,
          "alt" character varying(255) NULL,
          "serviceId" uuid NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "FK_service_media_service" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE
        )
      `);
      await queryRunner.query(`CREATE INDEX "IDX_service_media_serviceId" ON "service_media" ("serviceId")`);
    }

    /* ── service_specs ── */
    const hasSpecs = await queryRunner.hasTable('service_specs');
    if (!hasSpecs) {
      await queryRunner.query(`
        CREATE TABLE "service_specs" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "cle" character varying(150) NOT NULL,
          "valeur" character varying(500) NOT NULL,
          "ordre" integer NOT NULL DEFAULT 0,
          "serviceId" uuid NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "FK_service_specs_service" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE
        )
      `);
      await queryRunner.query(`CREATE INDEX "IDX_service_specs_serviceId" ON "service_specs" ("serviceId")`);
    }

    /* ── service_likes ── */
    const hasLikes = await queryRunner.hasTable('service_likes');
    if (!hasLikes) {
      await queryRunner.query(`
        CREATE TABLE "service_likes" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "clientId" uuid NOT NULL,
          "serviceId" uuid NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "FK_service_likes_client" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_service_likes_service" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE,
          CONSTRAINT "UQ_service_likes_client_service" UNIQUE ("clientId", "serviceId")
        )
      `);
      await queryRunner.query(`CREATE INDEX "IDX_service_likes_clientId" ON "service_likes" ("clientId")`);
      await queryRunner.query(`CREATE INDEX "IDX_service_likes_serviceId" ON "service_likes" ("serviceId")`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "service_likes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "service_specs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "service_media"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "service_media_type_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "services"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "services_politiqueannulation_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "services_delaireponse_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "services_pricingtype_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "services_visibilite_enum"`);
  }
}
