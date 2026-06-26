/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/categories/categories.controller.ts
 *
 * Ce fichier ne fait que re-exporter CategoriesController
 * (qui est dans categories.controller.ts du module catalogue)
 * pour ne pas casser les imports existants.
 *
 * Toute la logique est dans :
 *   src/modules/catalogue/categories.controller.ts
 * ============================================================ */

export {
  CatalogueController as CategoriesController,
} from 'src/modules/catalogue/catalogue.controller';  