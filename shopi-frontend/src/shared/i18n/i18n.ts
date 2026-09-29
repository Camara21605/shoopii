/* ============================================================
 * FICHIER : src/shared/i18n/i18n.ts
 *
 * RÔLE : Initialisation d'i18next pour toute l'application.
 *        Import à effet de bord (une seule fois, dans App.tsx) —
 *        `initReactI18next` enregistre l'instance par défaut que
 *        `useTranslation()` utilisera partout ensuite.
 *
 * Persistance : même clé localStorage que SecLangue.tsx
 * (`LANG_KEY = 'shopi_lang'`) pour rester cohérent avec la
 * sélection déjà enregistrée par les utilisateurs actuels.
 * À unifier dans un seul endroit partagé quand SecLangue.tsx
 * sera câblé (étape suivante).
 * ============================================================ */

import i18n from 'i18next';
import type { BackendModule } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { chargeursLangues, resourcesEmbarquees, LANGUE_PAR_DEFAUT } from './resources';
import { isSupportedLangCode } from './supportedLangs';

const LANG_STORAGE_KEY = 'shopi_lang';

const savedLang = localStorage.getItem(LANG_STORAGE_KEY);

/* Téléchargement à la demande des langues autres que le français (voir resources.ts) : i18next
 * appelle read() au démarrage pour la langue enregistrée, et à chaque changeLanguage() vers une
 * langue pas encore chargée — le changement n'est appliqué qu'une fois les traductions arrivées. */
const chargementALaDemande: BackendModule = {
  type: 'backend',
  init: () => { /* rien à configurer */ },
  read: (langue, _namespace, callback) => {
    const code = langue.slice(0, 2);
    if (!isSupportedLangCode(code)) { callback(null, {}); return; }
    chargeursLangues[code]()
      .then((m) => callback(null, m.default))
      .catch((err: unknown) => callback(err instanceof Error ? err : new Error(String(err)), false));
  },
};

i18n
  .use(chargementALaDemande)
  .use(initReactI18next)
  .init({
    resources: resourcesEmbarquees,
    /* Les langues absentes de `resources` passent par le chargement à la demande ci-dessus. */
    partialBundledLanguages: true,
    lng: savedLang ?? LANGUE_PAR_DEFAUT,
    fallbackLng: LANGUE_PAR_DEFAUT,
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    /* Pas de suspension de toute l'application le temps de télécharger une autre langue : le
     * français (secours) s'affiche aussitôt, puis la page passe dans la langue choisie. */
    react: { useSuspense: false },
  });

/* Persiste chaque changement de langue (appelé via i18n.changeLanguage). */
i18n.on('languageChanged', (lng) => {
  localStorage.setItem(LANG_STORAGE_KEY, lng);
});

export default i18n;
