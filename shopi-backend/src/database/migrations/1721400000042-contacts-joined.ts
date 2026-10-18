/* ============================================================
 * FICHIER : src/database/migrations/1721400000042-contacts-joined.ts
 *
 * RÔLE : répertoire téléphonique de la messagerie.
 *   - garantit la table user_contacts (créée par synchronize sur les bases
 *     existantes) et ses index, dont celui sur l'empreinte seule : à
 *     l'inscription d'un numéro, on cherche « qui l'a dans son répertoire »
 *     pour envoyer « X a rejoint Shoneya » ;
 *   - ajoute le type de notification 'contact.joined'.
 *   Aussi appliqué au démarrage par schema-patches.ts.
 * down() : retire l'index sur l'empreinte (la table et la valeur d'énumération
 *          sont conservées : PostgreSQL ne sait pas retirer une valeur
 *          d'enum, et la table existait avant cette migration).
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContactsJoined1721400000042 implements MigrationInterface {
  name = 'ContactsJoined1721400000042';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "user_contacts" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      "ownerUserId" uuid NOT NULL,
      "phoneHash" character varying(64) NOT NULL,
      "displayName" character varying(255) NULL,
      "matchedUserId" uuid NULL,
      "matchedAt" timestamp NULL,
      "isBlocked" boolean NOT NULL DEFAULT false,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_contact_owner_hash" UNIQUE ("ownerUserId", "phoneHash")
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_contact_owner" ON "user_contacts" ("ownerUserId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_contact_matched" ON "user_contacts" ("matchedUserId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_contact_phoneHash" ON "user_contacts" ("phoneHash")`);
    await queryRunner.query(`ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'contact.joined'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contact_phoneHash"`);
  }
}
