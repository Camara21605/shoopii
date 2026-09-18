/* ============================================================
 * FICHIER : src/common/utils/catalogue-case.util.ts
 *
 * Règle typographique du catalogue, appliquée à l'écriture (création /
 * modification par le super-admin) pour que l'affichage soit uniforme
 * partout, quelle que soit la casse saisie :
 *   • type d'entreprise → TOUT EN MAJUSCULES
 *   • catégorie         → première lettre en majuscule, reste inchangé
 *   • sous-catégorie    → tout en minuscules
 * `toLocale*Case('fr')` gère les accents et ligatures (é→É, œ→Œ).
 * ============================================================ */

const LOCALE = 'fr';

export function formatTypeName(nom: string): string {
  return nom.trim().toLocaleUpperCase(LOCALE);
}

export function formatCategoryName(nom: string): string {
  const s = nom.trim();
  if (!s) return s;
  // Première lettre (code point complet) en majuscule, le reste tel que saisi.
  const [first, ...rest] = Array.from(s);
  return first.toLocaleUpperCase(LOCALE) + rest.join('');
}

export function formatSubCategoryName(nom: string): string {
  return nom.trim().toLocaleLowerCase(LOCALE);
}
