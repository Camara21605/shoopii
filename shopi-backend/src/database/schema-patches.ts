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
