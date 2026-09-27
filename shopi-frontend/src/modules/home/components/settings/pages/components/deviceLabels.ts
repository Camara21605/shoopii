/* ================================================================
 * src/modules/home/components/settings/pages/components/deviceLabels.ts
 *
 * Traduit les libellés d'appareil et de pays renvoyés par l'API
 * (Appareils connectés, Journal d'activité). Le serveur les produit en
 * français (« Ordinateur », « Navigateur inconnu », « Guinée ») : ils
 * restaient en français quelle que soit la langue de l'interface.
 * Les noms propres (Windows, Chrome, Android…) sont laissés tels quels.
 * ================================================================ */

import type { TFunction } from 'i18next';

const GENERIQUES: Record<string, string> = {
  'Ordinateur':         'ordinateur',
  'Navigateur':         'navigateur',
  'Appareil inconnu':   'appareilInconnu',
  'Navigateur inconnu': 'navigateurInconnu',
};

/** « Ordinateur — Navigateur » → « Computer — Browser » ; les noms propres ne changent pas. */
export function libelleAppareil(t: TFunction, label: string | null | undefined): string {
  if (!label) return '';
  return label
    .split(' — ')
    .map(part => (GENERIQUES[part] ? String(t(`settingsPage.appareils.${GENERIQUES[part]}`)) : part))
    .join(' — ');
}

/** Nom du pays dans la langue de l'interface (repli : libellé fourni par le serveur). */
export function nomPays(code: string | null | undefined, fallback: string, lang: string): string {
  if (!code) return fallback;
  try { return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? fallback; }
  catch { return fallback; }
}
