/**
 * @file   utils.ts
 * @module settings
 *
 * Fonctions utilitaires pures (sans effets de bord) utilisées dans
 * le module Settings.
 */

/**
 * Convertit un nom lisible en slug technique.
 *
 * Étapes :
 *   1. Minuscules
 *   2. Suppression des accents (NFD → supprime les diacritiques)
 *   3. Remplacement des caractères non alphanumériques par "-"
 *   4. Suppression des tirets en début / fin
 *   5. Troncature à 100 caractères
 *
 * @example
 *   toSlug("Épicerie Fine")  → "epicerie-fine"
 *   toSlug("Café & Snacks")  → "cafe-snacks"
 */
export function toSlug(nom: string): string {
  return nom
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // supprime les diacritiques
    .replace(/[^a-z0-9]+/g, '-')     // remplace tout sauf a-z0-9 par -
    .replace(/^-+|-+$/g, '')         // supprime tirets en tête et queue
    .slice(0, 100);
}

/**
 * Formate un nombre avec séparateur de milliers en français.
 *
 * @example
 *   fmtNumber(10000)    → "10 000"
 *   fmtNumber(5000000)  → "5 000 000"
 */
export function fmtNumber(n: number): string {
  return n.toLocaleString('fr-FR');
}
