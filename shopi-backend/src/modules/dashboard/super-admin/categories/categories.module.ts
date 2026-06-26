/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/categories/categories.module.ts
 *
 * Ce fichier ne fait que re-exporter CatalogueModule sous le
 * nom CategoriesModule pour ne pas casser les imports existants.
 *
 * Toute la logique est dans :
 *   src/modules/catalogue/catalogue.module.ts
 * ============================================================ */

export { CatalogueModule as CategoriesModule } from 'src/modules/catalogue/catalogue.module';