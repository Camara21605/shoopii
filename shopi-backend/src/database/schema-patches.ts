/* ============================================================
 * FICHIER : src/database/schema-patches.ts
 *
 * RÔLE : correctifs de schéma IDEMPOTENTS appliqués automatiquement
 *        au démarrage du serveur (voir database.module.ts), juste
 *        après la connexion et AVANT toute requête applicative.
 *
 * POURQUOI :
 *   En production (Render), ni `synchronize` ni `migrationsRun` ne
 *   sont actifs : une migration qui n'a pas été lancée à la main
 *   laisse l'entité TypeORM réclamer une colonne absente de la base.
 *   Exemple réel : platform_settings.codeRequiredForDelivery — chaque
 *   lecture des paramètres plateforme échouait (connexion, inscription,
 *   Paramètres super-admin : le toggle « se recochait » avec une erreur).
 *
 * RÈGLES POUR AJOUTER UN CORRECTIF :
 *   - uniquement du DDL sans risque et rejouable à l'infini :
 *     ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS… ;
 *   - JAMAIS de DROP, de modification de type ni de mise à jour de
 *     données (celles-ci restent dans de vraies migrations) ;
 *   - garder la migration correspondante dans src/database/migrations/.
 * ============================================================ */

import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';

interface SchemaPatch {
  /** Migration d'origine (traçabilité) */
  name: string;
  sql:  string;
}

const SCHEMA_PATCHES: SchemaPatch[] = [
  {
    name: '1721400000036-partner-quartier',
    sql:  `ALTER TABLE "partenaires" ADD COLUMN IF NOT EXISTS "quartier" character varying(100) NULL`,
  },
  {
    name: '1721400000037-signup-code-delivery-partner',
    sql:  `ALTER TABLE "platform_settings"
             ADD COLUMN IF NOT EXISTS "codeRequiredForDelivery" boolean NOT NULL DEFAULT true,
             ADD COLUMN IF NOT EXISTS "codeRequiredForPartner"  boolean NOT NULL DEFAULT true`,
  },
  {
    name: '1721400000038-client-theme-preference',
    sql:  `ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "themePreference" character varying(10) NULL`,
  },
  {
    name: '1721400000039-user-theme-preference',
    sql:  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "themePreference" character varying(10) NULL`,
  },
  {
    name: '1721400000040-product-views-count',
    sql:  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "viewsCount" integer NOT NULL DEFAULT 0`,
  },
  {
    name: '1721400000040-product-views-count (index)',
    sql:  `CREATE INDEX IF NOT EXISTS "IDX_products_viewsCount" ON "products" ("viewsCount")`,
  },
  {
    name: '1721400000041-commande-adresse-gps',
    sql:  `ALTER TABLE "commandes" ADD COLUMN IF NOT EXISTS "quartierLivraison" character varying(100) NULL, ADD COLUMN IF NOT EXISTS "latitudeLivraison" numeric(9,6) NULL, ADD COLUMN IF NOT EXISTS "longitudeLivraison" numeric(9,6) NULL`,
  },
  /* Contacts du répertoire : la table existe là où le schéma a été créé par
   * synchronize ; on la garantit ailleurs (structure = UserContact, colonnes
   * camelCase comme toute la base). Sans elle, la synchro des contacts et
   * l'onglet Contacts de la messagerie échouaient. */
  {
    name: '1721400000042-user-contacts (table)',
    sql:  `CREATE TABLE IF NOT EXISTS "user_contacts" (
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
           )`,
  },
  {
    name: '1721400000042-user-contacts (index propriétaire)',
    sql:  `CREATE INDEX IF NOT EXISTS "IDX_contact_owner" ON "user_contacts" ("ownerUserId")`,
  },
  {
    name: '1721400000042-user-contacts (index correspondance)',
    sql:  `CREATE INDEX IF NOT EXISTS "IDX_contact_matched" ON "user_contacts" ("matchedUserId")`,
  },
  /* Recherche « qui m'a dans son répertoire ? » à l'inscription d'un numéro
   * (notification « X a rejoint Shoneya ») : index sur l'empreinte seule. */
  {
    name: '1721400000042-user-contacts (index empreinte)',
    sql:  `CREATE INDEX IF NOT EXISTS "IDX_contact_phoneHash" ON "user_contacts" ("phoneHash")`,
  },
  /* Nouveau type de notification. ADD VALUE IF NOT EXISTS est rejouable
   * (PostgreSQL ≥ 12, hors transaction : chaque correctif est une requête seule). */
  {
    name: '1721400000042-notification-contact-joined',
    sql:  `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'contact.joined'`,
  },
];

/**
 * Applique chaque correctif indépendamment : un échec est journalisé mais
 * n'empêche ni les suivants ni le démarrage du serveur (une table absente
 * sur une base neuve sera créée par synchronize / les migrations).
 */
export async function applySchemaPatches(dataSource: DataSource): Promise<void> {
  const logger = new Logger('SchemaPatches');
  for (const patch of SCHEMA_PATCHES) {
    try {
      await dataSource.query(patch.sql);
    } catch (err) {
      logger.error(`[${patch.name}] échec : ${(err as Error).message}`);
    }
  }
  logger.log(`${SCHEMA_PATCHES.length} correctif(s) de schéma vérifié(s).`);
}
