/* ================================================================
 * FICHIER : sections/params/SecPreferences.tsx
 * Section "Préférences" — langue du dashboard.
 *
 * BUG CORRIGÉ (langue) — la carte "Langue" listait Pular/Malinké/Soussou
 * en plus du français, mais les stockait seulement dans un state local
 * puis dans localStorage['shopi_lang'] SANS jamais appeler
 * i18n.changeLanguage() : ces 3 langues ne sont pas dans resources.ts
 * (seuls fr/en/ar/zh/pt sont de vraies locales i18next), donc les
 * sélectionner ne changeait strictement rien, y compris pour "Français"
 * (qui ne redéclenchait pas i18next non plus). Remplacé par le composant
 * partagé <SecLangue> — déjà branché sur i18n.changeLanguage() +
 * localStorage['shopi_lang'] via l'écouteur central dans
 * shared/i18n/i18n.ts — utilisé à l'identique par les dashboards
 * entreprise/livreur/correspondant (voir leurs ParametresPage.tsx
 * respectifs).
 *
 * CARTE "APPARENCE" RETIRÉE — le choix clair/sombre ne pouvait jamais
 * avoir le moindre effet : /dashboard/partenaire fait partie de
 * DARK_FORCED_PREFIXES dans app/router.tsx (ThemeRouteSync), qui impose
 * le thème sombre sur CE dashboard à chaque navigation, quelle que soit
 * la préférence enregistrée. Choisir "Clair" ici sauvegardait une valeur
 * qui était systématiquement écrasée à la navigation suivante — un choix
 * qui ne pouvait jamais se réaliser plutôt qu'un bug ponctuel.
 * ================================================================ */

import SecLangue from '../../../../shared/components/params/SecLangue';

interface Props {
  onToast: (msg: string, type?: 's' | 'i' | 'w') => void;
}

export default function SecPreferences({ onToast }: Props) {
  return (
    /* Langue — composant partagé, réellement branché sur i18next.
     * SecLangue n'appelle onPop qu'avec type 's' (succès) — adaptateur
     * pour matcher la signature onToast(msg, 's'|'i'|'w') du dashboard. */
    <SecLangue onPop={(m, ty) => onToast(m, (ty as 's' | 'i' | 'w') ?? 's')} />
  );
}
