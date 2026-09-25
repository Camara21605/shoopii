/* ============================================================
 * FICHIER : src/database/migrations/1721400000034-auto-publish-default.ts
 *
 * RÔLE : la publication automatique devient le comportement PAR DÉFAUT.
 *
 * POURQUOI : entreprises.autoPublish valait false par défaut, ce qui forçait en
 * BROUILLON tout produit ou service ajouté — même quand le vendeur cliquait sur
 * « Publier ». Un premier ajout n'apparaissait donc jamais dans la boutique et
 * le vendeur ne comprenait pas pourquoi.
 *
 * up() : défaut de la colonne = true ; toutes les entreprises actuellement à false
 *        passent à true — false était la valeur par défaut, pas un choix (en
 *        base : 5 entreprises sur 5 à false). Le vendeur peut le désactiver
 *        dans Paramètres > Catalogue > « Publication automatique ».
 * down(): remet le défaut à false (les valeurs déjà écrites ne sont pas modifiées).
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutoPublishDefault1721400000034 implements MigrationInterface {
  name = 'AutoPublishDefault1721400000034';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "entreprises" ALTER COLUMN "autoPublish" SET DEFAULT true`);
    await queryRunner.query(`UPDATE "entreprises" SET "autoPublish" = true WHERE "autoPublish" = false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "entreprises" ALTER COLUMN "autoPublish" SET DEFAULT false`);
  }
}
