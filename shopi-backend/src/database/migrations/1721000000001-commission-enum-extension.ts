/* ============================================================
 * MIGRATION : 1721000000001-commission-enum-extension
 * ─────────────────────────────────────────────────────────────
 * Étend l'enum distribution_acteur_type_enum avec les 6 nouvelles
 * valeurs du moteur de commissions 7-acteurs.
 *
 * NOUVELLES VALEURS
 * ─────────────────────────────────────────────────────────────
 *  plateforme_produit    — Commission Shopi sur produits
 *  plateforme_livraison  — Commission Shopi sur livraisons
 *  partenaire_produit    — Commission Partenaire sur produits
 *  partenaire_livraison  — Commission Partenaire sur livraisons
 *  admin_produit         — Commission Admin sur produits
 *  admin_livraison       — Commission Admin sur livraisons
 *
 * COMPATIBILITÉ
 * ─────────────────────────────────────────────────────────────
 *  Les anciennes valeurs (entreprise, livreur, correspondant,
 *  partenaire, plateforme) sont conservées.
 *  Les lignes existantes ne sont PAS modifiées.
 *
 * IDEMPOTENCE
 * ─────────────────────────────────────────────────────────────
 *  Chaque ajout est protégé par un IF NOT EXISTS sur le label.
 *  La migration peut être relancée sans erreur.
 *
 * DOWN
 * ─────────────────────────────────────────────────────────────
 *  Les nouvelles valeurs sont supprimées de l'enum.
 *  Requiert qu'aucune ligne n'utilise ces valeurs.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommissionEnumExtension1721000000001 implements MigrationInterface {

  name = 'CommissionEnumExtension1721000000001';

  /* ── UP ──────────────────────────────────────────────────── */

  async up(queryRunner: QueryRunner): Promise<void> {

    /*
     * PostgreSQL ne supporte pas ALTER TYPE ... ADD VALUE IF NOT EXISTS
     * avant la version 14. On utilise une approche idempotente
     * qui vérifie l'existence avant d'insérer.
     *
     * Alternative compatible v12+ : insérer directement dans pg_enum.
     * On préfère ALTER TYPE qui est la méthode officielle (v12+).
     */

    const newValues = [
      'plateforme_produit',
      'plateforme_livraison',
      'partenaire_produit',
      'partenaire_livraison',
      'admin_produit',
      'admin_livraison',
    ];

    for (const value of newValues) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = '${value}'
              AND enumtypid = (
                SELECT oid FROM pg_type
                WHERE typname = 'distribution_acteur_type_enum'
              )
          ) THEN
            ALTER TYPE distribution_acteur_type_enum ADD VALUE '${value}';
          END IF;
        END $$;
      `);
    }
  }

  /* ── DOWN ────────────────────────────────────────────────── */

  async down(queryRunner: QueryRunner): Promise<void> {
    /*
     * PostgreSQL ne permet pas de supprimer des valeurs d'enum directement.
     * La seule méthode propre est de recréer le type.
     *
     * Cette migration est irréversible si des données utilisent les nouvelles valeurs.
     * Si besoin de rollback : supprimer les lignes avec les nouvelles valeurs d'abord.
     */

    /* Recréer l'enum sans les nouvelles valeurs */
    await queryRunner.query(`
      ALTER TABLE paiement_distributions
        ALTER COLUMN "acteurType"
          TYPE varchar(100);
    `);

    await queryRunner.query(`DROP TYPE IF EXISTS distribution_acteur_type_enum_new;`);

    await queryRunner.query(`
      CREATE TYPE distribution_acteur_type_enum_new AS ENUM (
        'entreprise',
        'livreur',
        'correspondant',
        'partenaire',
        'plateforme'
      );
    `);

    /* Supprimer les lignes avec les nouvelles valeurs (protection) */
    await queryRunner.query(`
      DELETE FROM paiement_distributions
      WHERE "acteurType" IN (
        'plateforme_produit', 'plateforme_livraison',
        'partenaire_produit', 'partenaire_livraison',
        'admin_produit', 'admin_livraison'
      );
    `);

    await queryRunner.query(`
      ALTER TABLE paiement_distributions
        ALTER COLUMN "acteurType"
          TYPE distribution_acteur_type_enum_new
          USING "acteurType"::distribution_acteur_type_enum_new;
    `);

    await queryRunner.query(`DROP TYPE IF EXISTS distribution_acteur_type_enum;`);

    await queryRunner.query(`
      ALTER TYPE distribution_acteur_type_enum_new
        RENAME TO distribution_acteur_type_enum;
    `);
  }
}
