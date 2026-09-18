/* ============================================================
 * FICHIER : src/database/migrations/1721400000029-catalogue-name-case.ts
 *
 * RÔLE : Met les noms EXISTANTS du catalogue en conformité avec la règle
 * appliquée désormais à l'écriture (voir common/utils/catalogue-case.util.ts) :
 * types d'entreprise en MAJUSCULES, catégories avec majuscule initiale,
 * sous-catégories en minuscules. Calcul en JS (et non UPPER()/LOWER() SQL,
 * qui ne gèrent pas les accents selon la locale de la base).
 * Une ligne dont le nouveau nom entrerait en collision (contrainte
 * d'unicité) est laissée telle quelle.
 * down() : sans effet — la casse d'origine n'est pas conservée.
 * ============================================================ */

import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  formatTypeName, formatCategoryName, formatSubCategoryName,
} from '../../common/utils/catalogue-case.util';

const TARGETS: { table: string; format: (nom: string) => string }[] = [
  { table: 'company_types',  format: formatTypeName },
  { table: 'categories',     format: formatCategoryName },
  { table: 'sub_categories', format: formatSubCategoryName },
];

export class CatalogueNameCase1721400000029 implements MigrationInterface {
  name = 'CatalogueNameCase1721400000029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { table, format } of TARGETS) {
      const rows: { id: string; nom: string }[] = await queryRunner.query(`SELECT "id", "nom" FROM "${table}"`);
      for (const row of rows) {
        const next = format(row.nom);
        if (next === row.nom) continue;
        try {
          await queryRunner.query('SAVEPOINT name_case');
          await queryRunner.query(`UPDATE "${table}" SET "nom" = $1 WHERE "id" = $2`, [next, row.id]);
          await queryRunner.query('RELEASE SAVEPOINT name_case');
        } catch {
          await queryRunner.query('ROLLBACK TO SAVEPOINT name_case');
        }
      }
    }
  }

  public async down(): Promise<void> { /* irréversible : casse d'origine non conservée */ }
}
