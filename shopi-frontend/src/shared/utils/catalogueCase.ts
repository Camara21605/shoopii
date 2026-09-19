/* ================================================================
 * FICHIER : src/shared/utils/catalogueCase.ts
 *
 * Règle typographique du catalogue à l'AFFICHAGE, quelle que soit la casse
 * stockée en base (miroir de shopi-backend common/utils/catalogue-case.util.ts,
 * qui l'applique à l'écriture) :
 *   • type d'entreprise → TOUT EN MAJUSCULES
 *   • catégorie         → première lettre en majuscule, reste inchangé
 *   • sous-catégorie    → tout en minuscules
 * Sert de filet : des noms saisis avant la règle, importés ou seedés ne
 * doivent jamais s'afficher avec une autre casse.
 * ================================================================ */

const LOCALE = 'fr';

export function typeName(nom: string | null | undefined): string {
  return (nom ?? '').trim().toLocaleUpperCase(LOCALE);
}

export function categoryName(nom: string | null | undefined): string {
  const s = (nom ?? '').trim();
  if (!s) return s;
  const [first, ...rest] = Array.from(s);
  return first.toLocaleUpperCase(LOCALE) + rest.join('');
}

export function subCategoryName(nom: string | null | undefined): string {
  return (nom ?? '').trim().toLocaleLowerCase(LOCALE);
}
