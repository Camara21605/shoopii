/* ============================================================
 * FICHIER : src/shared/i18n/resources.ts
 *
 * RÔLE : Point d'entrée UNIQUE des fichiers de traduction.
 *        Chaque langue réellement traduite doit être importée
 *        et ajoutée ici — c'est cet objet qui sert de source de
 *        vérité pour déterminer les langues supportées
 *        (voir supportedLangs.ts), donc pour griser ou non une
 *        langue dans le sélecteur (SecLangue.tsx).
 *
 *        Les fichiers de traduction sont découpés par domaine
 *        (layout, overview, commandes, produits, reseau,
 *        finances, clients, parametres, messagerie, public) puis
 *        fusionnés dans le namespace UNIQUE "common". Aucun
 *        changement de code n'est requis dans les composants :
 *        ceux-ci utilisent toujours t('clé') → namespace common.
 * ============================================================ */

// ── Français ────────────────────────────────────────────────
import frLayout        from './locales/fr/layout.json';
import frOverview      from './locales/fr/overview.json';
import frCommandes     from './locales/fr/commandes.json';
import frProduits      from './locales/fr/produits.json';
import frReseau        from './locales/fr/reseau.json';
import frFinances      from './locales/fr/finances.json';
import frClients       from './locales/fr/clients.json';
import frParametres    from './locales/fr/parametres.json';
import frMessagerie    from './locales/fr/messagerie.json';
import frPublic        from './locales/fr/public.json';

// ── Anglais ─────────────────────────────────────────────────
import enLayout        from './locales/en/layout.json';
import enOverview      from './locales/en/overview.json';
import enCommandes     from './locales/en/commandes.json';
import enProduits      from './locales/en/produits.json';
import enReseau        from './locales/en/reseau.json';
import enFinances      from './locales/en/finances.json';
import enClients       from './locales/en/clients.json';
import enParametres    from './locales/en/parametres.json';
import enMessagerie    from './locales/en/messagerie.json';
import enPublic        from './locales/en/public.json';

// ── Arabe ───────────────────────────────────────────────────
import arLayout        from './locales/ar/layout.json';
import arOverview      from './locales/ar/overview.json';
import arCommandes     from './locales/ar/commandes.json';
import arProduits      from './locales/ar/produits.json';
import arReseau        from './locales/ar/reseau.json';
import arFinances      from './locales/ar/finances.json';
import arClients       from './locales/ar/clients.json';
import arParametres    from './locales/ar/parametres.json';
import arMessagerie    from './locales/ar/messagerie.json';
import arPublic        from './locales/ar/public.json';

// ── Chinois ─────────────────────────────────────────────────
import zhLayout        from './locales/zh/layout.json';
import zhOverview      from './locales/zh/overview.json';
import zhCommandes     from './locales/zh/commandes.json';
import zhProduits      from './locales/zh/produits.json';
import zhReseau        from './locales/zh/reseau.json';
import zhFinances      from './locales/zh/finances.json';
import zhClients       from './locales/zh/clients.json';
import zhParametres    from './locales/zh/parametres.json';
import zhMessagerie    from './locales/zh/messagerie.json';
import zhPublic        from './locales/zh/public.json';

// ── Portugais ───────────────────────────────────────────────
import ptLayout        from './locales/pt/layout.json';
import ptOverview      from './locales/pt/overview.json';
import ptCommandes     from './locales/pt/commandes.json';
import ptProduits      from './locales/pt/produits.json';
import ptReseau        from './locales/pt/reseau.json';
import ptFinances      from './locales/pt/finances.json';
import ptClients       from './locales/pt/clients.json';
import ptParametres    from './locales/pt/parametres.json';
import ptMessagerie    from './locales/pt/messagerie.json';
import ptPublic        from './locales/pt/public.json';

const fr = {
  ...frLayout,
  ...frOverview,
  ...frCommandes,
  ...frProduits,
  ...frReseau,
  ...frFinances,
  ...frClients,
  ...frParametres,
  ...frMessagerie,
  ...frPublic,
};

const en = {
  ...enLayout,
  ...enOverview,
  ...enCommandes,
  ...enProduits,
  ...enReseau,
  ...enFinances,
  ...enClients,
  ...enParametres,
  ...enMessagerie,
  ...enPublic,
};

const ar = {
  ...arLayout,
  ...arOverview,
  ...arCommandes,
  ...arProduits,
  ...arReseau,
  ...arFinances,
  ...arClients,
  ...arParametres,
  ...arMessagerie,
  ...arPublic,
};

const zh = {
  ...zhLayout,
  ...zhOverview,
  ...zhCommandes,
  ...zhProduits,
  ...zhReseau,
  ...zhFinances,
  ...zhClients,
  ...zhParametres,
  ...zhMessagerie,
  ...zhPublic,
};

const pt = {
  ...ptLayout,
  ...ptOverview,
  ...ptCommandes,
  ...ptProduits,
  ...ptReseau,
  ...ptFinances,
  ...ptClients,
  ...ptParametres,
  ...ptMessagerie,
  ...ptPublic,
};

export const resources = {
  fr: { common: fr },
  en: { common: en },
  ar: { common: ar },
  zh: { common: zh },
  pt: { common: pt },
} as const;
