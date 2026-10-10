/* ============================================================
 * FICHIER : src/shared/i18n/supportedLangs.ts
 *
 * RÔLE : Liste centrale des langues supportées — dérivée
 *        automatiquement de `chargeursLangues` (donc des fichiers
 *        de traduction réellement présents dans langues/).
 *        AUCUNE langue ne doit être codée en dur ailleurs :
 *        ajouter une traduction ici (resources.ts) suffit à la
 *        rendre disponible/cliquable dans le sélecteur.
 * ============================================================ */

import { chargeursLangues } from './resources';

export type SupportedLangCode = keyof typeof chargeursLangues;

export const SUPPORTED_LANG_CODES = Object.keys(chargeursLangues) as SupportedLangCode[];

export function isSupportedLangCode(code: string): code is SupportedLangCode {
  return (SUPPORTED_LANG_CODES as string[]).includes(code);
}
