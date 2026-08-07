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
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';

const LANG_STORAGE_KEY = 'shopi_lang';

const savedLang = localStorage.getItem(LANG_STORAGE_KEY);

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLang ?? 'fr',
    fallbackLng: 'fr',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
  });

/* Persiste chaque changement de langue (appelé via i18n.changeLanguage). */
i18n.on('languageChanged', (lng) => {
  localStorage.setItem(LANG_STORAGE_KEY, lng);
});

export default i18n;
