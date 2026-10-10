/* ============================================================
 * FICHIER : src/shared/i18n/resources.ts
 *
 * RÔLE : Point d'entrée UNIQUE des traductions. Chaque langue
 *        réellement traduite a son fichier dans langues/<code>.ts
 *        (qui fusionne ses fichiers locales/<code>/… dans le
 *        namespace unique « common ») et doit être déclarée ici —
 *        c'est cette liste qui sert de source de vérité pour les
 *        langues supportées (voir supportedLangs.ts), donc pour
 *        griser ou non une langue dans le sélecteur (SecLangue.tsx).
 *
 * PREMIER CHARGEMENT : les cinq langues étaient importées ici
 *        d'un bloc — près de 1 Mo de traductions dans le fichier
 *        JavaScript principal, téléchargé à chaque ouverture de
 *        l'application alors qu'une seule langue est affichée.
 *        Désormais seul le français (langue par défaut et de
 *        secours) est embarqué ; les autres sont téléchargées à la
 *        demande (voir i18n.ts).
 * ============================================================ */

import fr from './langues/fr';

/** Langue par défaut, toujours disponible sans téléchargement. */
export const LANGUE_PAR_DEFAUT = 'fr';

/** Traductions embarquées dans le fichier principal. */
export const resourcesEmbarquees = {
  fr: { common: fr },
};

/** Toutes les langues traduites, et comment obtenir leurs traductions. */
export const chargeursLangues = {
  fr: () => Promise.resolve({ default: fr }),
  en: () => import('./langues/en'),
  ar: () => import('./langues/ar'),
  zh: () => import('./langues/zh'),
  pt: () => import('./langues/pt'),
} as const;
