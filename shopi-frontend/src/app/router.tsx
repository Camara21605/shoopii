/* ================================================================
 * src/app/router.tsx
 *
 * MODIFICATIONS :
 *   ✅ Route /livreurs        → LivreursPage      (publique)
 *   ✅ Route /livreurs/:id    → ProfilLivreurPage (publique, profil complet)
 *   ✅ Route /mon-profil      → ProfilClientPage  (protégée, client connecté)
 *   ✅ Pages profil autonomes → aucune prop à passer
 * ================================================================ */

import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GlobalCallProvider } from '../shared/context/GlobalCallContext';
import { tokenStorage }    from '../shared/services/apiFetch';
import { isTokenValid, getRoleFromToken, getDashboardPath } from '../shared/services/authUtils';

/* ── Pages publiques (import direct) ── */
import BoutiquePage      from '../modules/home/components/boutique/pages/BoutiquePage';
import ProduitPage       from '../modules/home/components/produit/pages/ProduitPage';
import CommandePage      from '../modules/home/components/panier/pages/CommandePage';
import SettingsPage      from '../modules/home/components/settings/pages/SettingsPage';
import LivreursPage      from '../modules/home/components/livreurs/pages/LivreursPage';
import ProfilLivreurPage from '../shared/profils/profil-livreur/ProfilLivreurPage';
import ProfilClientPage  from '../shared/profils/profil-client/ProfilClientPage';
import CorrespondantsPage from '../modules/home/components/correspondants/pages/CorrespondantsPage';
import ProfilCorrespondantPage from '../shared/profils/profil-correspondant/pages/ProfilCorrespondantPage';

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

/* Mappe le rôle backend (token JWT) vers le rôle acteur de la page de suivi */
function getActeurRole(): 'entreprise' | 'livreur' | 'correspondant' | 'client' {
  switch (getRoleFromToken()) {
    case 'company':       return 'entreprise';
    case 'delivery':      return 'livreur';
    case 'correspondent': return 'correspondant';
    default:              return 'client';
  }
}

const Loader = () => (
  <div style={{
    minHeight: '100vh', background: '#0B1F3A',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'rgba(200,217,248,.6)', fontFamily: 'DM Sans,sans-serif', fontSize: 14, gap: 10,
  }}>
    <i className="fas fa-circle-notch" style={{ animation: 'spin .8s linear infinite', display: 'inline-block' }} />
    Chargement…
  </div>
);

/* ── Guards ── */

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = tokenStorage.get();
  if (!isTokenValid(token)) { tokenStorage.remove(); return <Navigate to="/login" replace />; }
  return <>{children}</>;
};

const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = tokenStorage.get();
  if (!isTokenValid(token)) return <>{children}</>;
  const role = getRoleFromToken();
  if (role === 'client') return <Navigate to="/home" replace />;
  return <Navigate to={getDashboardPath(role)} replace />;
};

const HomeRoute: React.FC = () => {
  const token = tokenStorage.get();
  if (isTokenValid(token)) {
    const role = getRoleFromToken();
    if (role && role !== 'client') return <Navigate to={getDashboardPath(role)} replace />;
  }
  return (
    <Suspense fallback={<Loader />}>
      <HomePage />
    </Suspense>
  );
};

const CommandeSuiviRoute: React.FC = () => (
  <Suspense fallback={<Loader />}>
    <CommandeSuiviPage role={getActeurRole()} useApi onToast={showToast} />
  </Suspense>
);

const SmartRedirect: React.FC = () => {
  const token = tokenStorage.get();
  if (!isTokenValid(token)) return <Navigate to="/home" replace />;
  const role = getRoleFromToken();
  if (role === 'client' || !role) return <Navigate to="/home" replace />;
  return <Navigate to={getDashboardPath(role)} replace />;
};

function showToast(msg: string) {
  window.dispatchEvent(new CustomEvent('shopi-toast', { detail: msg }));
}

/* ── Router ── */
export const AppRouter: React.FC = () => (
  <BrowserRouter>
    <GlobalCallProvider>
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

          {/* Livreurs — publiques */}
          <Route path="/livreurs"           element={<LivreursPage />} />
          <Route path="/correspondants"     element={<CorrespondantsPage />} />
          <Route path="/livreurs/:id"       element={<ProfilLivreurPage />} />
          <Route path="/correspondants/:id" element={<ProfilCorrespondantPage />} />

          {/* Pages client — protégées */}
          <Route path="/mon-profil"           element={<PrivateRoute><ProfilClientPage /></PrivateRoute>} />
          <Route path="/commande"             element={<PrivateRoute><CommandePage /></PrivateRoute>} />
          <Route path="/commande/:id/suivi"   element={<PrivateRoute><CommandeSuiviRoute /></PrivateRoute>} />
          <Route path="/messagerie"           element={<PrivateRoute><MessageriePage /></PrivateRoute>} />
          <Route path="/parametres"           element={<PrivateRoute><SettingsPage onToast={showToast} /></PrivateRoute>} />

          {/* Dashboards */}
          <Route path="/dashboard/super-admin/*"   element={<PrivateRoute><SuperAdminApp /></PrivateRoute>} />
          <Route path="/dashboard/admin/*"         element={<PrivateRoute><AdminApp /></PrivateRoute>} />
          <Route path="/dashboard/entreprise/*"    element={<PrivateRoute><EntrepriseApp /></PrivateRoute>} />
          <Route path="/dashboard/partenaire/*"    element={<PrivateRoute><PartenaireApp /></PrivateRoute>} />
          <Route path="/dashboard/livreur/*"       element={<PrivateRoute><LivreurApp /></PrivateRoute>} />
          <Route path="/dashboard/correspondant/*" element={<PrivateRoute><CorrespApp /></PrivateRoute>} />
          <Route path="/dashboard/client/*"        element={<PrivateRoute><ClientApp /></PrivateRoute>} />

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
      </Suspense>
    </GlobalCallProvider>
  </BrowserRouter>
);