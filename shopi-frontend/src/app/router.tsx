/* ================================================================
 * src/app/router.tsx
 *
 * MODIFICATIONS :
 *   ✅ Route /livreurs        → LivreursPage      (publique)
 *   ✅ Route /livreurs/:id    → ProfilLivreurPage (publique, profil complet)
 *   ✅ Route /mon-profil      → ProfilClientPage  (protégée, client connecté)
 *   ✅ Pages profil autonomes → aucune prop à passer
 *   ✅ Guards migrés vers useAppContext() — plus de tokenStorage dans les guards
 * ================================================================ */

import React, { lazy, Suspense, useEffect, useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { GlobalCallProvider } from '../shared/context/GlobalCallContext';
import { GroupCallProvider }  from '../shared/context/GroupCallContext';
import { useAppContext }      from '../shared/context/AppContext';
import { getDashboardPath, getRoleHint } from '../shared/services/authUtils';
import { useForceDarkTheme }  from '../shared/context/ThemeContext';

import LoadingScreen    from '../shared/components/LoadingScreen';
import ClientSpaceGate  from '../shared/components/ClientSpaceGate';
import HelpFab          from '../shared/components/HelpFab';
import CompareFab       from '../shared/components/CompareFab';

/* ── Pages publiques — chargées À LA DEMANDE ──
 * PREMIER CHARGEMENT LENT : importées directement, ces ~27 pages (boutique, produit, aide,
 * support, profils…) étaient TOUTES dans le fichier JavaScript principal (2,1 Mo), téléchargé
 * et exécuté avant le moindre affichage — même pour ouvrir une seule page. Sur un réseau mobile,
 * c'était plusieurs secondes de plus à chaque ouverture de l'application, et un appel reçu
 * application fermée pouvait être perdu (l'appelant raccroche avant que l'application ne soit
 * prête à décrocher). Chaque page devient son propre fichier ; les plus visitées sont
 * préchargées en tâche de fond une fois l'application affichée (voir prechargerPagesPubliques). */
const BoutiquePage      = lazy(() => import('../modules/home/components/boutique/pages/BoutiquePage'));
const ProduitPage       = lazy(() => import('../modules/home/components/produit/pages/ProduitPage'));
const ServiceDetailPage = lazy(() => import('../modules/home/components/service/pages/ServiceDetailPage'));
const CommandePage      = lazy(() => import('../modules/home/components/panier/pages/CommandePage'));
const LivreursPage      = lazy(() => import('../modules/home/components/livreurs/pages/LivreursPage'));
const BoutiquesPage     = lazy(() => import('../modules/home/components/boutiques/pages/BoutiquesPage'));
const CataloguePage = lazy(() => import('../modules/home/components/catalogue/pages/CataloguePage'));
const TypeEntreprisePage = lazy(() => import('../modules/home/components/typeEntreprise/pages/TypeEntreprisePage'));
const ExplorerPage      = lazy(() => import('../modules/home/components/explorer/pages/ExplorerPage'));
const OffresPage        = lazy(() => import('../modules/home/components/offres/pages/OffresPage'));
const ProfilLivreurPage = lazy(() => import('../shared/profils/profil-livreur/ProfilLivreurPage'));
const ProfilClientPage  = lazy(() => import('../shared/profils/profil-client/ProfilClientPage'));
const CorrespondantsPage = lazy(() => import('../modules/home/components/correspondants/pages/CorrespondantsPage'));
const ProfilCorrespondantPage = lazy(() => import('../shared/profils/profil-correspondant/pages/ProfilCorrespondantPage'));
const ProfilPublicClientPage = lazy(() => import('../shared/profils/profil-public-client/ProfilPublicClientPage'));
const ComparerPage      = lazy(() => import('../modules/home/components/compare/pages/ComparerPage'));
/* Diagnostic des notifications (téléphone / ordinateur) — chargé à la demande */
const PushDiagnosticPage = lazy(() => import('../shared/notifications/PushDiagnosticPage'));

/* ── Help Center ── */
const HelpHomePage        = lazy(() => import('../modules/help/pages/HelpHomePage'));
const HelpCategoryPage    = lazy(() => import('../modules/help/pages/HelpCategoryPage'));
const HelpArticlePage     = lazy(() => import('../modules/help/pages/HelpArticlePage'));
const HelpSearchPage      = lazy(() => import('../modules/help/pages/HelpSearchPage'));
const RemboursementsPage  = lazy(() => import('../modules/help/pages/RemboursementsPage'));
const PolitiqueRetourPage = lazy(() => import('../modules/help/pages/PolitiqueRetourPage'));
/* Pages légales exigées par Google Play — publiques, sans connexion */
const ConfidentialitePage = lazy(() => import('../modules/help/pages/ConfidentialitePage'));
const SuppressionComptePage = lazy(() => import('../modules/help/pages/SuppressionComptePage'));
const ContactPage         = lazy(() => import('../modules/help/pages/ContactPage'));

/* ── Support ── */
const SupportPage      = lazy(() => import('../modules/support/pages/SupportPage'));
const NewTicketPage    = lazy(() => import('../modules/support/pages/NewTicketPage'));
const TicketDetailPage = lazy(() => import('../modules/support/pages/TicketDetailPage'));
const SupportStatsPage = lazy(() => import('../modules/support/pages/SupportStatsPage'));

/* ── Pages / apps lazy-loadées ── */
/* Paramètres du compte : chargée À LA DEMANDE. Elle embarque la carte des adresses
 * (Leaflet). Importée directement ici, elle tirait Leaflet dans le bundle principal ;
 * au build de production, le chunk LocationMap s'exécutait alors avant que Leaflet
 * soit prêt → « Cannot read properties of undefined (reading 'divIcon') » et page
 * blanche sur TOUT le site (fonctionne en dev, casse seulement au build). */
const SettingsPage   = lazy(() => import('../modules/home/components/settings/pages/SettingsPage'));
const Login          = lazy(() => import('../modules/auth/pages/Login'));
const ReferralRedirectPage = lazy(() => import('../modules/auth/pages/ReferralRedirectPage'));
const HomePage       = lazy(() => import('../modules/home/pages/HomePage'));
const MessageriePage = lazy(() => import('../shared/messagerie/pages/MessageriePage'));
/* Chargeurs des dashboards, par rôle — partagés entre lazy() et le
 * préchargement au démarrage (voir prechargerDashboardDuRole) : même
 * fonction d'import = même fichier, téléchargé une seule fois. */
const CHARGEURS_DASHBOARD = {
  super_admin:   () => import('../dashboards/super-admin/SuperAdminApp'),
  admin:         () => import('../dashboards/administrateur/AdministrateurApp'),
  company:       () => import('../dashboards/entreprise/EntrepriseApp'),
  partner:       () => import('../dashboards/partenaire/PartenaireApp'),
  delivery:      () => import('../dashboards/livreur/LivreurApp'),
  correspondent: () => import('../dashboards/correspondant/CorrespondantApp'),
} as const;
const SuperAdminApp  = lazy(CHARGEURS_DASHBOARD.super_admin);
const AdminApp       = lazy(CHARGEURS_DASHBOARD.admin);
const EntrepriseApp  = lazy(CHARGEURS_DASHBOARD.company);
const PartenaireApp  = lazy(CHARGEURS_DASHBOARD.partner);
const LivreurApp     = lazy(CHARGEURS_DASHBOARD.delivery);
const CorrespApp     = lazy(CHARGEURS_DASHBOARD.correspondent);
const ClientApp      = lazy(() => import('../dashboards/client/ClientApp'));

/* ── Premier chargement d'un compte pro (entreprise, livreur…) ──
 * LENTEUR + « LOGO AFFICHÉ PLUSIEURS FOIS » CORRIGÉS : l'ouverture de
 * l'application suivait jusqu'ici une chaîne strictement séquentielle —
 * fichier principal → GET /auth/me (serveur Render parfois lent) → SEULEMENT
 * ALORS téléchargement du dashboard. Pire, pendant /auth/me, SmartRedirect
 * envoyait tout le monde vers /home : un compte pro voyait l'écran de
 * chargement, puis la Home un instant (téléchargée pour rien), puis à
 * nouveau l'écran de chargement, puis le dashboard.
 * Désormais, dès le démarrage, le dashboard du dernier compte connecté
 * (indice lu dans le jeton, voir getRoleHint) se télécharge EN PARALLÈLE
 * de /auth/me, et la Home n'est plus affichée à un compte pro. */
const ROLE_INDICE = getRoleHint();
const estRolePro = (role: string | null): boolean => !!role && role !== 'client';
if (ROLE_INDICE && ROLE_INDICE in CHARGEURS_DASHBOARD) {
  CHARGEURS_DASHBOARD[ROLE_INDICE as keyof typeof CHARGEURS_DASHBOARD]()
    .catch(() => { /* réseau : il se chargera normalement à l'affichage */ });
}
const CommandeSuiviPage = lazy(() => import('../modules/commandes/pages/CommandePage'));
/* lazy() car cette page tire leaflet/react-leaflet (LocationMap) — un import
 * direct en tête de fichier bundlerait ce chunk dans le graphe évalué au
 * démarrage de l'app, donc si ce chunk plante toutes les pages tombent avec
 * lui (voir incident production "aucune page ne s'affiche"). */
const AdressesPage = lazy(() => import('../modules/home/components/adresses/pages/AdressesPage'));

const Loader = () => <LoadingScreen />;

/* ── Guards — auth via AppContext (source de vérité = serveur) ── */

/**
 * Protège une route contre les utilisateurs non connectés.
 *
 * AppProvider ne bloque plus le rendu global pendant GET /auth/me (voir
 * AppContext.tsx) — donc isAuthenticated n'est PAS forcément définitif au
 * tout premier rendu ici. Seules les routes qui en ont réellement besoin
 * (celle-ci, PublicOnlyRoute, RoleRoute) attendent localement isLoading,
 * pour ne jamais afficher le contenu protégé puis rediriger derrière (flash),
 * sans pour autant faire attendre les pages publiques qui n'utilisent pas
 * ce guard.
 */
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAppContext();
  if (isLoading) return <Loader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

/* SÉCURITÉ / BUG CORRIGÉ — un lien d'invitation (parrainage partenaire
 * ?ref=, activation ?role&code, collaborateur ?collabToken, vérification
 * email ?verifyUserId) était systématiquement AVALÉ par PublicOnlyRoute
 * dès qu'une session — même celle d'un compte totalement différent,
 * restée active sur le même navigateur — était encore valide : la
 * redirection vers le dashboard de CE compte-là se déclenchait avant
 * même que /login n'ait eu la moindre chance de lire le paramètre.
 * Ce qui a fait croire à un "lien cassé" (montre toujours le 1er compte
 * connecté ; ne se met à fonctionner qu'après avoir vidé le cache, qui
 * efface justement cette session parasite) est exactement ce garde,
 * appliqué sans jamais regarder à QUOI l'URL correspondait. Présence
 * d'un de ces paramètres → on affiche la page d'invitation/connexion
 * quoi qu'il arrive, jamais une redirection automatique vers un AUTRE
 * compte que celui explicitement visé par le lien. */
const INVITE_CONTEXT_PARAMS = ['ref', 'code', 'collabToken', 'verifyUserId'];

function hasInviteContext(search: string, pathname: string): boolean {
  if (pathname.startsWith('/rejoindre/')) return true;
  const params = new URLSearchParams(search);
  return INVITE_CONTEXT_PARAMS.some(key => !!params.get(key)?.trim());
}

/** Redirige les utilisateurs déjà connectés vers leur dashboard — sauf si
 *  l'URL porte un contexte d'invitation explicite (voir hasInviteContext). */
const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAppContext();
  const location = useLocation();
  if (isLoading) return <Loader />;
  if (!isAuthenticated) return <>{children}</>;
  if (hasInviteContext(location.search, location.pathname)) return <>{children}</>;
  const role = user?.role ?? null;
  if (role === 'client') return <Navigate to="/home" replace />;
  return <Navigate to={getDashboardPath(role)} replace />;
};

/**
 * Protège une route de dashboard contre un utilisateur connecté mais dont
 * le rôle ne correspond PAS à ce dashboard précis — PrivateRoute seul ne
 * vérifie que l'authentification, pas le rôle. Sans ce garde, un client
 * connecté qui atterrit sur /dashboard/entreprise/* (URL restée en
 * historique, changement de rôle après un switch de compte, lien
 * partagé...) se retrouvait avec la coquille ENTIÈRE du dashboard
 * entreprise montée pour lui : chaque appel API spécifique à l'entreprise
 * échouait en 403 (le backend refuse correctement), mais le frontend
 * affichait quand même la page cassée au lieu de rediriger proprement.
 * Renvoie vers le dashboard réellement associé au rôle courant (ou /login
 * si pas connecté du tout, ou /home en dernier recours pour un rôle
 * inconnu/client).
 */
const RoleRoute: React.FC<{ role: string; children: React.ReactNode }> = ({ role, children }) => {
  const { isAuthenticated, isLoading, user } = useAppContext();
  if (isLoading) return <Loader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== role) return <Navigate to={getDashboardPath(user?.role ?? null)} replace />;
  return <>{children}</>;
};

/**
 * Pages de l'espace client (vitrine publique + pages personnelles du client)
 * fermées aux comptes PRO. Le seul passage prévu entre un espace pro et
 * l'espace client est la bascule (AccountSwitchCard) : sans ce garde, un
 * compte entreprise / livreur / point relais… pouvait parcourir la vitrine,
 * le panier ou « Mon profil » sous son identité pro en tapant l'URL, en
 * suivant un lien ou une notification (ex. ancien bouton « Ouvrir » de
 * « Voir ma boutique »). Visiteurs et clients : page affichée telle quelle.
 * Compte pro : ClientSpaceGate propose la bascule ou le retour à son espace.
 */
const ClientSpaceRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAppContext();
  /* Compte pro sur cet appareil : attendre /auth/me plutôt que d'afficher
   * la page client un instant (même règle que HomeRoute). */
  if (isLoading) return estRolePro(ROLE_INDICE) ? <Loader /> : <>{children}</>;
  const role = user?.role ?? null;
  if (isAuthenticated && role && role !== 'client') return <ClientSpaceGate role={role} />;
  return <>{children}</>;
};

/**
 * ThemeRouteSync — force le thème sombre dès que l'URL correspond à un
 * dashboard "toujours sombre", AVANT même que le chunk lazy du dashboard
 * (EntrepriseApp, PartenaireApp...) ait fini de se charger.
 *
 * Pourquoi pas dans RoleRoute (essayé d'abord, insuffisant) : RoleRoute
 * est monté À L'INTÉRIEUR du même <Suspense> que le composant lazy du
 * dashboard. Or quand un enfant lazy suspend (chunk pas encore prêt),
 * React n'engage AUCUNE partie du sous-arbre de ce Suspense — y compris
 * RoleRoute lui-même — tant que le chunk n'est pas prêt : son effet de
 * forçage ne s'exécute donc qu'au moment même où le dashboard apparaît
 * déjà, trop tard pour éviter le flash clair à la toute première
 * connexion (le rafraîchissement, lui, fonctionnait déjà : le script
 * inline de index.html fixe le thème avant le tout premier rendu React).
 *
 * Ce composant est rendu en dehors du <Suspense>, donc jamais suspendu :
 * son effet (useLayoutEffect, via useForceDarkTheme) s'exécute dès que
 * l'URL change, indépendamment du chargement du chunk du dashboard.
 */
const DARK_FORCED_PREFIXES = [
  '/dashboard/super-admin',
  /* '/dashboard/entreprise' : suit désormais la préférence clair / sombre
   * de l'utilisateur (Paramètres → Apparence de l'espace entreprise). */
  '/dashboard/partenaire',
  '/dashboard/correspondant',
];

const ThemeRouteSync: React.FC = () => {
  const { pathname } = useLocation();
  /* Ne dépend QUE du chemin, pas de isAuthenticated : ce composant est
   * rendu hors de tout Suspense/guard, donc AVANT même que GET /auth/me
   * n'ait résolu (voir AppContext.tsx — le rendu global n'attend plus
   * cette requête). Si on attendait isAuthenticated ici, un utilisateur
   * déjà connecté qui rafraîchit une page de dashboard verrait un flash
   * clair→sombre le temps de la résolution — exactement le bug que ce
   * composant existe pour éviter (voir commentaire au-dessus). Un visiteur
   * non connecté qui atterrit sur une URL de dashboard sera de toute façon
   * redirigé vers /login par RoleRoute/PrivateRoute une fois résolu — le
   * thème forcé entre-temps est sans conséquence. */
  const forceDark = DARK_FORCED_PREFIXES.some(p => pathname.startsWith(p));
  useForceDarkTheme(forceDark);
  return null;
};

/**
 * SiteScopeSync — pose data-site="home"|"app" sur <html> selon la route,
 * pour que la police "style X" (tokens.css :root[data-site="home"]) ne
 * s'applique qu'aux pages publiques. Même valeur initiale que le script
 * inline de index.html (aucun flash), ici pour suivre la navigation SPA
 * (ex. /home → /dashboard/... sans rechargement).
 */
const APP_SCOPE_RE = /^\/(dashboard|login|register|rejoindre)(\/|$)/;

const SiteScopeSync: React.FC = () => {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-site', APP_SCOPE_RE.test(pathname) ? 'app' : 'home');
    /* data-area="entreprise" : active la palette claire neutre (tokens.css)
     * sur tout l'espace entreprise, y compris ses fenêtres rendues hors de
     * .entreprise-app (modales, menus) — même valeur que index.html. */
    if (/^\/dashboard\/entreprise(\/|$)/.test(pathname)) root.setAttribute('data-area', 'entreprise');
    else root.removeAttribute('data-area');
  }, [pathname]);
  return null;
};

/**
 * ScrollToTop — remonte en haut de page à chaque changement de route.
 *
 * React Router (BrowserRouter) ne le fait PAS automatiquement — sans ce
 * composant, naviguer vers une nouvelle page conserve la position de
 * scroll de la page précédente : cliquer sur un onglet alors qu'on avait
 * scrollé en bas d'une longue page affiche la nouvelle page déjà scrollée
 * en bas, au lieu de commencer par le haut (bug rapporté : "l'affichage
 * en bas de la page" après un clic sur un onglet).
 *
 * `pathname` uniquement (pas `search`/`hash`) : changer un filtre en query
 * string sur la même page (ex. /explorer?category=x) ne doit pas remonter
 * en haut à chaque frappe/clic de filtre, seul un changement de PAGE le
 * doit. Instantané (pas 'smooth') : une vraie navigation de page démarre
 * en haut directement, comme un site multi-page classique — un scroll
 * animé à chaque clic d'onglet serait plus lent et inattendu.
 */
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

/**
 * Home — accessible aux clients et aux non-connectés ; redirige les autres
 * rôles vers leur dashboard.
 *
 * Rend HomePage IMMÉDIATEMENT, sans attendre la résolution de la session
 * (GET /auth/me) — Home est publique par nature (visiteur anonyme ou
 * client), donc dans l'immense majorité des cas il n'y a rien à attendre.
 * Le cas rare (utilisateur déjà connecté avec un rôle non-client qui
 * atterrit sur /home) est corrigé après coup, dès que la session résout,
 * via ce useEffect — un très bref affichage de Home avant redirection dans
 * ce cas précis, plutôt que de bloquer TOUS les visiteurs (l'immense
 * majorité) en attendant une vérification qui ne les concerne même pas.
 */
const HomeRoute: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    const role = user?.role ?? null;
    if (role && role !== 'client') navigate(getDashboardPath(role), { replace: true });
  }, [isLoading, isAuthenticated, user, navigate]);

  /* Compte pro sur cet appareil : on garde l'écran de chargement le temps
   * de /auth/me au lieu d'afficher la Home puis de rediriger (flash + Home
   * téléchargée pour rien). Visiteurs et clients : Home immédiate. */
  if (isLoading && estRolePro(ROLE_INDICE)) return <Loader />;

  return (
    <Suspense fallback={<Loader />}>
      <HomePage />
    </Suspense>
  );
};

/**
 * Redirige / et les routes inconnues vers home ou le dashboard selon le rôle.
 * Pendant la résolution de session (isLoading), traite l'utilisateur comme
 * non connecté et part vers /home immédiatement plutôt que d'attendre —
 * HomeRoute ci-dessus corrige elle-même la destination un instant plus tard
 * si l'utilisateur s'avère être un rôle non-client déjà connecté.
 */
const SmartRedirect: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAppContext();
  /* Compte pro sur cet appareil : attendre /auth/me (son dashboard se
   * télécharge déjà en parallèle) puis y aller directement, sans passer
   * par la Home — voir ROLE_INDICE. */
  if (isLoading && estRolePro(ROLE_INDICE)) return <Loader />;
  const role = user?.role ?? null;
  const cible = (isLoading || !isAuthenticated || role === 'client' || !role) ? '/home' : getDashboardPath(role);
  /* <Loader /> pendant la redirection : <Navigate> ne rend rien et ne
   * redirige qu'au rendu suivant — sans lui, l'écran restait VIDE un
   * instant entre l'écran de démarrage et la page (« / » est l'URL de
   * lancement de l'application Android et de l'application installée). */
  return <><Loader /><Navigate to={cible} replace /></>;
};

/** Route de suivi de commande — détermine le rôle acteur depuis le contexte. */
const CommandeSuiviRoute: React.FC = () => {
  const { user } = useAppContext();
  const role = user?.role ?? null;
  let acteurRole: 'entreprise' | 'livreur' | 'correspondant' | 'client';
  switch (role) {
    case 'company':       acteurRole = 'entreprise';    break;
    case 'delivery':      acteurRole = 'livreur';       break;
    case 'correspondent': acteurRole = 'correspondant'; break;
    default:              acteurRole = 'client';
  }
  return (
    <Suspense fallback={<Loader />}>
      <CommandeSuiviPage role={acteurRole} useApi onToast={showToast} />
    </Suspense>
  );
};

function showToast(msg: string) {
  window.dispatchEvent(new CustomEvent('shoneya-toast', { detail: msg }));
}

/**
 * Précharge en tâche de fond les pages les plus visitées, une fois l'application affichée et au
 * repos : la navigation vers elles reste instantanée alors qu'elles ne sont plus dans le fichier
 * principal. Rien sur une connexion économie de données / 2G — la priorité y reste la page ouverte
 * (et un appel entrant éventuel), pas des pages que l'utilisateur ne visitera peut-être pas.
 */
function prechargerPagesPubliques() {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? '')) return;
  const pages = [
    /* Compte connecté : les paramètres (souvent ouverts, et la plus grosse page du site) passent en premier. */
    ...(localStorage.getItem('shopi_access_token') ? [() => import('../modules/home/components/settings/pages/SettingsPage')] : []),
    () => import('../modules/home/pages/HomePage'),
    () => import('../modules/home/components/boutique/pages/BoutiquePage'),
    () => import('../modules/home/components/produit/pages/ProduitPage'),
    () => import('../modules/home/components/service/pages/ServiceDetailPage'),
    () => import('../modules/home/components/panier/pages/CommandePage'),
    () => import('../modules/home/components/explorer/pages/ExplorerPage'),
  ];
  /* Une page après l'autre, jamais toutes en même temps : ne sature pas une petite connexion. */
  const suivante = () => {
    const charger = pages.shift();
    if (!charger) return;
    charger().catch(() => { /* réseau : la page se chargera normalement à la visite */ }).finally(() => { attendreRepos(suivante); });
  };
  attendreRepos(suivante);
}

function attendreRepos(fn: () => void) {
  if ('requestIdleCallback' in window) window.requestIdleCallback(() => fn(), { timeout: 5_000 });
  else setTimeout(fn, 1_000);
}

const PrechargementPages: React.FC = () => {
  useEffect(() => {
    const demarrer = () => setTimeout(prechargerPagesPubliques, 3_000);
    if (document.readyState === 'complete') { const t = demarrer(); return () => clearTimeout(t); }
    window.addEventListener('load', demarrer, { once: true });
    return () => window.removeEventListener('load', demarrer);
  }, []);
  return null;
};

/* ── Router ── */
export const AppRouter: React.FC = () => (
  <BrowserRouter>
    <GlobalCallProvider>
      <GroupCallProvider>
      <ThemeRouteSync />
      <SiteScopeSync />
      <ScrollToTop />
      <PrechargementPages />
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/"         element={<SmartRedirect />} />
          <Route path="/login"    element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />

          {/* Lien de parrainage partenaire — résout le slug puis redirige
              vers /login?ref=slug (voir ReferralRedirectPage). */}
          <Route path="/rejoindre/:slug" element={<PublicOnlyRoute><ReferralRedirectPage /></PublicOnlyRoute>} />

          {/* Home — public + client */}
          <Route path="/home" element={<HomeRoute />} />

          {/* Pages produits — publiques */}
          <Route path="/boutique/:id" element={<ClientSpaceRoute><BoutiquePage /></ClientSpaceRoute>} />
          <Route path="/produit/:id"  element={<ClientSpaceRoute><ProduitPage /></ClientSpaceRoute>} />
          <Route path="/service/:id" element={<ClientSpaceRoute><ServiceDetailPage /></ClientSpaceRoute>} />

          {/* Help Center — publiques */}
          <Route path="/aide"                        element={<HelpHomePage />} />
          <Route path="/aide/categories/:slug"       element={<HelpCategoryPage />} />
          <Route path="/aide/articles/:slug"         element={<HelpArticlePage />} />
          <Route path="/aide/recherche"              element={<HelpSearchPage />} />
          <Route path="/remboursements"              element={<RemboursementsPage />} />
          <Route path="/politique-retour"            element={<PolitiqueRetourPage />} />
          <Route path="/confidentialite"             element={<ConfidentialitePage />} />
          <Route path="/suppression-compte"          element={<SuppressionComptePage />} />
          <Route path="/contact"                     element={<ContactPage />} />

          {/* Support tickets — protégées */}
          <Route path="/support"              element={<PrivateRoute><SupportPage /></PrivateRoute>} />
          <Route path="/support/nouveau"      element={<PrivateRoute><NewTicketPage /></PrivateRoute>} />
          <Route path="/support/tickets/:id"  element={<PrivateRoute><TicketDetailPage /></PrivateRoute>} />
          {/* Analytics support — admin/super_admin uniquement */}
          <Route path="/support/stats"        element={<PrivateRoute><SupportStatsPage /></PrivateRoute>} />

          {/* Explorer — publique */}
          <Route path="/explorer"           element={<ClientSpaceRoute><ExplorerPage /></ClientSpaceRoute>} />

          {/* Boutiques — publique */}
          <Route path="/boutiques"          element={<ClientSpaceRoute><BoutiquesPage /></ClientSpaceRoute>} />

          {/* Type d'entreprise — publique (produits + catégories de ce type) */}
          <Route path="/types/:id"          element={<ClientSpaceRoute><TypeEntreprisePage /></ClientSpaceRoute>} />
          <Route path="/catalogue"          element={<ClientSpaceRoute><CataloguePage /></ClientSpaceRoute>} />

          {/* Offres / promotions — publique */}
          <Route path="/offres"             element={<ClientSpaceRoute><OffresPage /></ClientSpaceRoute>} />

          {/* Comparateur produits — publique, local (localStorage) */}
          <Route path="/comparer"           element={<ClientSpaceRoute><ComparerPage /></ClientSpaceRoute>} />
          <Route path="/diagnostic-notifications" element={<Suspense fallback={<Loader />}><PushDiagnosticPage /></Suspense>} />

          {/* Livreurs — publiques */}
          <Route path="/livreurs"           element={<ClientSpaceRoute><LivreursPage /></ClientSpaceRoute>} />
          <Route path="/correspondants"     element={<ClientSpaceRoute><CorrespondantsPage /></ClientSpaceRoute>} />
          <Route path="/livreurs/:id"       element={<ClientSpaceRoute><ProfilLivreurPage /></ClientSpaceRoute>} />
          <Route path="/correspondants/:id" element={<ClientSpaceRoute><ProfilCorrespondantPage /></ClientSpaceRoute>} />
          <Route path="/clients/:id"        element={<ClientSpaceRoute><ProfilPublicClientPage /></ClientSpaceRoute>} />

          {/* Pages client — protégées */}
          <Route path="/mon-profil"           element={<ClientSpaceRoute><PrivateRoute><ProfilClientPage /></PrivateRoute></ClientSpaceRoute>} />
          <Route path="/mes-adresses"         element={<ClientSpaceRoute><PrivateRoute><AdressesPage /></PrivateRoute></ClientSpaceRoute>} />
          <Route path="/commande"             element={<ClientSpaceRoute><PrivateRoute><CommandePage /></PrivateRoute></ClientSpaceRoute>} />
          <Route path="/commande/:id/suivi"   element={<PrivateRoute><CommandeSuiviRoute /></PrivateRoute>} />
          <Route path="/messagerie"           element={<PrivateRoute><MessageriePage /></PrivateRoute>} />
          <Route path="/parametres"           element={<ClientSpaceRoute><PrivateRoute><SettingsPage onToast={showToast} /></PrivateRoute></ClientSpaceRoute>} />

          {/* Dashboards — RoleRoute vérifie que le rôle connecté correspond
              bien à CE dashboard précis (pas juste "connecté", voir son
              commentaire ci-dessus). */}
          <Route path="/dashboard/super-admin/*"   element={<RoleRoute role="super_admin"><SuperAdminApp /></RoleRoute>} />
          <Route path="/dashboard/admin/*"         element={<RoleRoute role="admin"><AdminApp /></RoleRoute>} />
          <Route path="/dashboard/entreprise/*"    element={<RoleRoute role="company"><EntrepriseApp /></RoleRoute>} />
          <Route path="/dashboard/partenaire/*"    element={<RoleRoute role="partner"><PartenaireApp /></RoleRoute>} />
          <Route path="/dashboard/livreur/*"       element={<RoleRoute role="delivery"><LivreurApp /></RoleRoute>} />
          <Route path="/dashboard/correspondant/*" element={<RoleRoute role="correspondent"><CorrespApp /></RoleRoute>} />
          <Route path="/dashboard/client/*"        element={<RoleRoute role="client"><ClientApp /></RoleRoute>} />

          {/* Raccourcis dashboards */}
          <Route path="/super-admin/*"   element={<Navigate to="/dashboard/super-admin"   replace />} />
          <Route path="/admin/*"         element={<Navigate to="/dashboard/admin"          replace />} />
          <Route path="/partenaire/*"    element={<Navigate to="/dashboard/partenaire"     replace />} />
          <Route path="/livreur/*"       element={<Navigate to="/dashboard/livreur"        replace />} />
          <Route path="/entreprise/*"    element={<Navigate to="/dashboard/entreprise"     replace />} />
          <Route path="/correspondant/*" element={<Navigate to="/dashboard/correspondant"  replace />} />
          <Route path="/client/*"        element={<Navigate to="/dashboard/client"         replace />} />

          <Route path="*" element={<SmartRedirect />} />
        </Routes>

        {/*
         * HelpFab — bouton flottant "?" d'aide.
         * Placé APRÈS <Routes> pour qu'il s'affiche par-dessus le contenu.
         * Se cache automatiquement sur les routes dashboard/support/aide.
         * Requiert d'être à l'intérieur de <BrowserRouter> pour useLocation.
         */}
        <HelpFab />
        <CompareFab />

      </Suspense>
      </GroupCallProvider>
    </GlobalCallProvider>
  </BrowserRouter>
);
