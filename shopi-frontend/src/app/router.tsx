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

import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { GlobalCallProvider } from '../shared/context/GlobalCallContext';
import { GroupCallProvider }  from '../shared/context/GroupCallContext';
import { useAppContext }      from '../shared/context/AppContext';
import { getDashboardPath }   from '../shared/services/authUtils';
import { useForceDarkTheme }  from '../shared/context/ThemeContext';

/* ── Pages publiques (import direct) ── */
import BoutiquePage      from '../modules/home/components/boutique/pages/BoutiquePage';
import ProduitPage       from '../modules/home/components/produit/pages/ProduitPage';
import CommandePage      from '../modules/home/components/panier/pages/CommandePage';
import SettingsPage      from '../modules/home/components/settings/pages/SettingsPage';
import LivreursPage      from '../modules/home/components/livreurs/pages/LivreursPage';
import BoutiquesPage     from '../modules/home/components/boutiques/pages/BoutiquesPage';
import ExplorerPage      from '../modules/home/components/explorer/pages/ExplorerPage';
import OffresPage        from '../modules/home/components/offres/pages/OffresPage';
import ProfilLivreurPage from '../shared/profils/profil-livreur/ProfilLivreurPage';
import ProfilClientPage  from '../shared/profils/profil-client/ProfilClientPage';
import CorrespondantsPage from '../modules/home/components/correspondants/pages/CorrespondantsPage';
import ProfilCorrespondantPage from '../shared/profils/profil-correspondant/pages/ProfilCorrespondantPage';
import ProfilPublicClientPage from '../shared/profils/profil-public-client/ProfilPublicClientPage';
import ComparerPage      from '../modules/home/components/compare/pages/ComparerPage';

/* ── Help Center ── */
import HelpHomePage        from '../modules/help/pages/HelpHomePage';
import HelpCategoryPage    from '../modules/help/pages/HelpCategoryPage';
import HelpArticlePage     from '../modules/help/pages/HelpArticlePage';
import HelpSearchPage      from '../modules/help/pages/HelpSearchPage';
import RemboursementsPage  from '../modules/help/pages/RemboursementsPage';
import PolitiqueRetourPage from '../modules/help/pages/PolitiqueRetourPage';
import ContactPage         from '../modules/help/pages/ContactPage';

/* ── Support ── */
import LoadingScreen    from '../shared/components/LoadingScreen';
import HelpFab          from '../shared/components/HelpFab';
import CompareFab       from '../shared/components/CompareFab';
import SupportPage      from '../modules/support/pages/SupportPage';
import NewTicketPage    from '../modules/support/pages/NewTicketPage';
import TicketDetailPage from '../modules/support/pages/TicketDetailPage';
import SupportStatsPage from '../modules/support/pages/SupportStatsPage';

/* ── Pages / apps lazy-loadées ── */
const Login          = lazy(() => import('../modules/auth/pages/Login'));
const HomePage       = lazy(() => import('../modules/home/pages/HomePage'));
const MessageriePage = lazy(() => import('../shared/messagerie/pages/MessageriePage'));
const SuperAdminApp  = lazy(() => import('../dashboards/super-admin/SuperAdminApp'));
const AdminApp       = lazy(() => import('../dashboards/administrateur/AdministrateurApp'));
const EntrepriseApp  = lazy(() => import('../dashboards/entreprise/EntrepriseApp'));
const PartenaireApp  = lazy(() => import('../dashboards/partenaire/PartenaireApp'));
const LivreurApp     = lazy(() => import('../dashboards/livreur/LivreurApp'));
const CorrespApp     = lazy(() => import('../dashboards/correspondant/CorrespondantApp'));
const ClientApp      = lazy(() => import('../dashboards/client/ClientApp'));
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

/** Redirige les utilisateurs déjà connectés vers leur dashboard. */
const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAppContext();
  if (isLoading) return <Loader />;
  if (!isAuthenticated) return <>{children}</>;
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
  '/dashboard/entreprise',
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
  if (isLoading || !isAuthenticated) return <Navigate to="/home" replace />;
  const role = user?.role ?? null;
  if (role === 'client' || !role) return <Navigate to="/home" replace />;
  return <Navigate to={getDashboardPath(role)} replace />;
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

/* ── Router ── */
export const AppRouter: React.FC = () => (
  <BrowserRouter>
    <GlobalCallProvider>
      <GroupCallProvider>
      <ThemeRouteSync />
      <ScrollToTop />
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/"         element={<SmartRedirect />} />
          <Route path="/login"    element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />

          {/* Home — public + client */}
          <Route path="/home" element={<HomeRoute />} />

          {/* Pages produits — publiques */}
          <Route path="/boutique/:id" element={<BoutiquePage />} />
          <Route path="/produit/:id"  element={<ProduitPage />} />

          {/* Help Center — publiques */}
          <Route path="/aide"                        element={<HelpHomePage />} />
          <Route path="/aide/categories/:slug"       element={<HelpCategoryPage />} />
          <Route path="/aide/articles/:slug"         element={<HelpArticlePage />} />
          <Route path="/aide/recherche"              element={<HelpSearchPage />} />
          <Route path="/remboursements"              element={<RemboursementsPage />} />
          <Route path="/politique-retour"            element={<PolitiqueRetourPage />} />
          <Route path="/contact"                     element={<ContactPage />} />

          {/* Support tickets — protégées */}
          <Route path="/support"              element={<PrivateRoute><SupportPage /></PrivateRoute>} />
          <Route path="/support/nouveau"      element={<PrivateRoute><NewTicketPage /></PrivateRoute>} />
          <Route path="/support/tickets/:id"  element={<PrivateRoute><TicketDetailPage /></PrivateRoute>} />
          {/* Analytics support — admin/super_admin uniquement */}
          <Route path="/support/stats"        element={<PrivateRoute><SupportStatsPage /></PrivateRoute>} />

          {/* Explorer — publique */}
          <Route path="/explorer"           element={<ExplorerPage />} />

          {/* Boutiques — publique */}
          <Route path="/boutiques"          element={<BoutiquesPage />} />

          {/* Offres / promotions — publique */}
          <Route path="/offres"             element={<OffresPage />} />

          {/* Comparateur produits — publique, local (localStorage) */}
          <Route path="/comparer"           element={<ComparerPage />} />

          {/* Livreurs — publiques */}
          <Route path="/livreurs"           element={<LivreursPage />} />
          <Route path="/correspondants"     element={<CorrespondantsPage />} />
          <Route path="/livreurs/:id"       element={<ProfilLivreurPage />} />
          <Route path="/correspondants/:id" element={<ProfilCorrespondantPage />} />
          <Route path="/clients/:id"        element={<ProfilPublicClientPage />} />

          {/* Pages client — protégées */}
          <Route path="/mon-profil"           element={<PrivateRoute><ProfilClientPage /></PrivateRoute>} />
          <Route path="/mes-adresses"         element={<PrivateRoute><AdressesPage /></PrivateRoute>} />
          <Route path="/commande"             element={<PrivateRoute><CommandePage /></PrivateRoute>} />
          <Route path="/commande/:id/suivi"   element={<PrivateRoute><CommandeSuiviRoute /></PrivateRoute>} />
          <Route path="/messagerie"           element={<PrivateRoute><MessageriePage /></PrivateRoute>} />
          <Route path="/parametres"           element={<PrivateRoute><SettingsPage onToast={showToast} /></PrivateRoute>} />

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
