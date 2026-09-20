/*
 * FICHIER : src/dashboards/entreprise/EntrepriseApp.tsx
 *
 * ✅ NAVIGATION URL-BASED :
 *    La page active est lue depuis l'URL (useParams) et écrite
 *    avec useNavigate — permet la navigation interne normale.
 *    Un montage FRAIS du shell (rechargement du navigateur, ou
 *    déconnexion/reconnexion) retombe toujours sur la vue d'ensemble,
 *    voir l'effet de redirection au montage dans EntrepriseLayout.
 *
 * Exemples d'URL :
 *   /dashboard/entreprise/                       → overview
 *   /dashboard/entreprise/commandes              → commandes
 *   /dashboard/entreprise/ajouter                → ajouter (création)
 *   /dashboard/entreprise/ajouter/{id}           → ajouter (édition)
 *   /dashboard/entreprise/parametres             → parametres
 *   /dashboard/entreprise/reseau/correspondants  → reseauCorrespondants
 *   /dashboard/entreprise/reseau/livreurs/{id}   → profilLivreurReseau
 */

import { lazy, Suspense, useEffect } from 'react';
import { useParams, useNavigate }    from 'react-router-dom';
import { useState }                  from 'react';

import Sidebar          from './layout/Sidebar';
import Topbar           from './layout/Topbar';
import ReseauBottomNav  from './layout/ReseauBottomNav';

import { ToastProvider } from '../../shared/context/ToastContext';
import ToastContainer    from '../../shared/components/ui/ToastContainer';
import { apiFetch }      from '../../shared/services/apiFetch';
import { NotificationProvider }   from '../../shared/notifications/NotificationContext';
import NotificationToastStack     from '../../shared/notifications/NotificationToastStack';
import LoadingScreen    from '../../shared/components/LoadingScreen';
import { useTeamPermissions } from './hooks/useTeamPermissions';
import { IDENTITY_EVENT, pickIdentity, readIdentity, writeIdentity, type BoutiqueIdentity } from './hooks/boutiqueIdentity';

/* ── Pages chargées à la demande ── */
const OverviewPage                  = lazy(() => import('./pages/OverviewPage'));
const CommandesPage                 = lazy(() => import('./pages/CommandesPage'));
const RetoursPage                   = lazy(() => import('./pages/RetoursPage'));
const ProduitsPage                  = lazy(() => import('./pages/ProduitsPage'));
const AjouterProduitPage            = lazy(() => import('./pages/AjouterPage'));
const ServicesPage                  = lazy(() => import('./pages/ServicesPage'));
const AjouterServicePage            = lazy(() => import('./pages/AjouterServicePage'));
const InventairePage                = lazy(() => import('./pages/InventairePage'));
const FournisseursPage              = lazy(() => import('./pages/FournisseursPage'));
const PromotionsPage                = lazy(() => import('./pages/PromotionsPage'));
const AnalyticsPage                 = lazy(() => import('./pages/AnalyticsPage'));
const MessagesPage                  = lazy(() => import('./pages/MessagesPage'));
const SEOPage                       = lazy(() => import('./pages/SEOPage'));
const LivreursPage                  = lazy(() => import('./pages/LivreursPage'));
const CorrespondantsPage            = lazy(() => import('./pages/CorrespondantsPage'));
const FinancesPage                  = lazy(() => import('./pages/FinancesPage'));
const PortefeuillePage              = lazy(() => import('./pages/PortefeuillePage'));
const ClientsPage                   = lazy(() => import('./pages/ClientsPage'));
const AvisPage                      = lazy(() => import('./pages/AvisPage'));
const ParametresPage                = lazy(() => import('./pages/ParametresPage'));
const ReseauCorrespondantsPage      = lazy(() => import('./pages/ReseauCorrespondantsPage'));
const ReseauLivreursPage            = lazy(() => import('./pages/ReseauLivreursPage'));
const ProfilCorrespondantReseauPage = lazy(() => import('./pages/ProfilCorrespondantReseauPage'));
const ProfilLivreurReseauPage       = lazy(() => import('./pages/ProfilLivreurReseauPage'));
const ProfilEntreprisePage          = lazy(() => import('../../shared/profils/profil-entreprise/ProfilEntreprisePage'));
const BoutiquePreviewPage           = lazy(() => import('./pages/BoutiquePreviewPage'));
const EquipePage                    = lazy(() => import('./pages/EquipePage'));

import type { EntreprisePage, ToastType } from './types';
import { useToast } from '../../shared/context/ToastContext';

import '../../styles/global.css';
import './EntrepriseApp.css';

export type NavigateFn = (page: EntreprisePage, id?: string) => void;

// ─────────────────────────────────────────────────────────────
// URL ↔ Page mapping
// ─────────────────────────────────────────────────────────────

/**
 * Construit le segment d'URL depuis une page + id optionnel.
 * ex: buildPath('ajouter', '123') → 'ajouter/123'
 */
function buildPath(page: EntreprisePage, id?: string): string {
  switch (page) {
    case 'overview':                  return '';
    case 'ajouter':                   return id ? `ajouter/${id}` : 'ajouter';
    case 'ajouter-service':           return id ? `ajouter-service/${id}` : 'ajouter-service';
    case 'reseauCorrespondants':      return 'reseau/correspondants';
    case 'reseauLivreurs':            return 'reseau/livreurs';
    case 'profilCorrespondantReseau': return id ? `reseau/correspondants/${id}` : 'reseau/correspondants';
    case 'profilLivreurReseau':       return id ? `reseau/livreurs/${id}` : 'reseau/livreurs';
    default:                          return page; // slug direct pour tous les autres
  }
}

/**
 * Déduit la page active depuis le splat URL (* après /dashboard/entreprise/).
 * ex: 'reseau/correspondants/abc' → { page: 'profilCorrespondantReseau', id: 'abc' }
 */
function parseSplat(splat: string): { page: EntreprisePage; productId?: string; viewedId?: string } {
  const parts = splat.split('/').filter(Boolean);
  const [a, b, c] = parts;

  if (!a) return { page: 'overview' };

  /* Réseau */
  if (a === 'reseau') {
    if (b === 'correspondants') {
      return c
        ? { page: 'profilCorrespondantReseau', viewedId: c }
        : { page: 'reseauCorrespondants' };
    }
    if (b === 'livreurs') {
      return c
        ? { page: 'profilLivreurReseau', viewedId: c }
        : { page: 'reseauLivreurs' };
    }
    return { page: 'overview' };
  }

  /* Ajouter produit : ajouter / ajouter/{productId} */
  if (a === 'ajouter') return { page: 'ajouter', productId: b };

  /* Ajouter service : ajouter-service / ajouter-service/{serviceId} —
   * réutilise le même champ productId (id générique de l'élément édité). */
  if (a === 'ajouter-service') return { page: 'ajouter-service', productId: b };

  /* Pages directes */
  const DIRECT_PAGES: EntreprisePage[] = [
    'commandes', 'retours', 'produits', 'inventaire', 'fournisseurs',
    'promotions', 'services', 'analytics', 'messages', 'seo',
    'livreurs', 'correspondants', 'finances', 'portefeuille',
    'clients', 'avis', 'parametres', 'profil', 'boutique-preview', 'equipe',
  ];
  if (DIRECT_PAGES.includes(a as EntreprisePage)) {
    return { page: a as EntreprisePage };
  }

  return { page: 'overview' };
}

// ─────────────────────────────────────────────────────────────
// PageRenderer
// ─────────────────────────────────────────────────────────────

function PageRenderer({
  page, productId, viewedId, onNavigate, onPop,
}: {
  page:       EntreprisePage;
  productId?: string;
  viewedId?:  string;
  onNavigate: NavigateFn;
  onPop:      (msg: string, type?: string) => void;
}) {
  switch (page) {
    case 'overview':       return <OverviewPage onNavigate={onNavigate} />;
    case 'commandes':      return <CommandesPage />;
    case 'retours':        return <RetoursPage />;
    case 'produits':       return <ProduitsPage onNavigate={onNavigate} />;
    case 'ajouter':        return <AjouterProduitPage onNavigate={onNavigate} productId={productId} />;
    case 'services':       return <ServicesPage onNavigate={onNavigate} />;
    case 'ajouter-service': return <AjouterServicePage onNavigate={onNavigate} serviceId={productId} />;
    case 'inventaire':     return <InventairePage onNavigate={onNavigate} />;
    case 'fournisseurs':   return <FournisseursPage />;
    case 'promotions':     return <PromotionsPage />;
    case 'analytics':      return <AnalyticsPage />;
    case 'messages':       return <MessagesPage />;
    case 'seo':            return <SEOPage />;
    case 'livreurs':       return <LivreursPage />;
    case 'correspondants': return <CorrespondantsPage />;
    case 'finances':       return <FinancesPage />;
    case 'portefeuille':   return <PortefeuillePage />;
    case 'clients':        return <ClientsPage />;
    case 'avis':           return <AvisPage />;
    case 'parametres':     return <ParametresPage />;
    case 'reseauCorrespondants':
      return <ReseauCorrespondantsPage onPop={onPop} onView={id => onNavigate('profilCorrespondantReseau', id)} />;
    case 'reseauLivreurs':
      return <ReseauLivreursPage onPop={onPop} onView={id => onNavigate('profilLivreurReseau', id)} />;
    case 'profilCorrespondantReseau':
      return viewedId
        ? <ProfilCorrespondantReseauPage id={viewedId} onBack={() => onNavigate('reseauCorrespondants')} onPop={onPop} />
        : <ReseauCorrespondantsPage onPop={onPop} onView={id => onNavigate('profilCorrespondantReseau', id)} />;
    case 'profilLivreurReseau':
      return viewedId
        ? <ProfilLivreurReseauPage id={viewedId} onBack={() => onNavigate('reseauLivreurs')} onPop={onPop} />
        : <ReseauLivreursPage onPop={onPop} onView={id => onNavigate('profilLivreurReseau', id)} />;
    case 'profil':           return <ProfilEntreprisePage onNavigate={onNavigate} />;
    case 'boutique-preview': return <BoutiquePreviewPage onNavigate={onNavigate} />;
    case 'equipe':           return <EquipePage />;
    default:                 return <OverviewPage onNavigate={onNavigate} />;
  }
}

// ─────────────────────────────────────────────────────────────
// Layout principal
// ─────────────────────────────────────────────────────────────

function EntrepriseLayout() {
  /* ── URL → état ── */
  const { '*': splat = '' }  = useParams<{ '*': string }>();
  const navigate             = useNavigate();
  const { page, productId, viewedId } = parseSplat(splat);

  /* Un montage FRAIS de ce shell (rechargement du navigateur, ou retour ici
   * après une déconnexion/reconnexion — dans les deux cas /dashboard/entreprise/*
   * est remonté depuis zéro) doit toujours retomber sur la vue d'ensemble,
   * même si l'URL pointe encore sur une sous-page visitée avant. La
   * navigation interne normale (clic sidebar/topbar) ne remonte PAS ce
   * composant — seul un montage initial passe ici, une seule fois. */
  useEffect(() => {
    if (splat) navigate('/dashboard/entreprise', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Permissions du user courant (propriétaire ou membre) ── */
  const { can, isOwner } = useTeamPermissions();

  /* ── Identité de la boutique (nom, logo, statut…) ──
   * Lue de façon SYNCHRONE depuis la mémoire du navigateur (par compte) avant le premier rendu :
   * au rechargement, le bon nom est affiché tout de suite au lieu d'un nom de remplacement qui
   * clignote pendant l'appel API (voir boutiqueIdentity.ts). L'API rafraîchit ensuite en arrière-plan. */
  const [profile, setProfile] = useState<BoutiqueIdentity | null>(() => readIdentity());
  /* true = l'identité n'a pas pu être obtenue (ni mémoire, ni réseau) : le shell affiche alors un libellé neutre */
  const [identityFailed, setIdentityFailed] = useState(false);
  const { pop } = useToast();

  useEffect(() => {
    let alive = true;
    apiFetch<Partial<BoutiqueIdentity> & { id: string; companyName: string }>('/dashboard/entreprise/parametres')
      .then(data => { if (alive) { const id = pickIdentity(data); setProfile(id); writeIdentity(id); setIdentityFailed(false); } })
      .catch(() => { if (alive) setIdentityFailed(true); });

    /* Modifications faites dans Paramètres (nom, logo, statut…) : visibles aussitôt partout */
    const onChange = (e: Event) => setProfile((e as CustomEvent<BoutiqueIdentity>).detail);
    window.addEventListener(IDENTITY_EVENT, onChange);
    return () => { alive = false; window.removeEventListener(IDENTITY_EVENT, onChange); };
  }, []);

  /* Squelette tant qu'aucun nom réel n'est connu (première visite) — jamais un faux nom */
  const identityLoading = !profile && !identityFailed;

  /* SÉCURITÉ — garde de dernier recours, indépendante de la sidebar/topbar/
   * FAB : même si un de ces menus redirige un jour à nouveau vers la
   * mauvaise page (voir le bug corrigé sur le bottom nav mobile, qui
   * pointait "produits" en dur quel que soit businessModel), la page
   * elle-même ne doit jamais pouvoir rester affichée pour le mauvais
   * modèle économique. Contrairement au premier useEffect ci-dessus (qui
   * ne joue qu'au montage initial), celui-ci réagit à CHAQUE changement
   * de page/profil — une navigation interne vers une page interdite est
   * donc renvoyée à l'aperçu immédiatement, avant même un rendu visible. */
  useEffect(() => {
    if (!profile) return;
    const produitsOnly = ['produits', 'ajouter', 'inventaire', 'fournisseurs', 'promotions'];
    const servicesOnly = ['services', 'ajouter-service'];
    const interdite =
      (profile.businessModel === 'services' && produitsOnly.includes(page)) ||
      (profile.businessModel === 'products' && servicesOnly.includes(page));
    if (interdite) navigate('/dashboard/entreprise', { replace: true });
  }, [profile, page, navigate]);

  /* Le dashboard entreprise n'a pas de mode clair : le thème sombre est
     forcé de façon centralisée par ThemeRouteSync (src/app/router.tsx),
     dès que l'URL correspond à /dashboard/entreprise — pas ici. Deux
     instances indépendantes de useForceDarkTheme (une ici, une dans
     ThemeRouteSync) créaient une course sur la restauration du thème
     précédent à la déconnexion/reconnexion dans le même onglet : chacune
     capture "le thème d'avant" à SON propre montage et le restaure à SON
     propre démontage, dans un ordre non garanti — ce qui pouvait
     réappliquer le thème clair après coup et le laisser bloqué ainsi. */

  const handlePop = (msg: string, type?: string) => pop(msg, type as ToastType | undefined);

  /* La barre réseau mobile (ReseauBottomNav) ne s'affiche que sur ces pages —
     ailleurs, .main n'a pas besoin du padding-bottom supplémentaire qu'elle réserve. */
  const isReseauPage =
    page === 'reseauCorrespondants' || page === 'reseauLivreurs' ||
    page === 'profilCorrespondantReseau' || page === 'profilLivreurReseau';

  const isMessagesPage = page === 'messages';

  /* ── Navigation → URL ── */
  const handleNavigate: NavigateFn = (targetPage, id?) => {
    const segment = buildPath(targetPage, id);
    navigate(`/dashboard/entreprise${segment ? `/${segment}` : ''}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="entreprise-app">
      {!isMessagesPage && (
        <Sidebar
          activePage={page}
          onNavigate={handleNavigate}
          companyLogo={profile?.logo}
          companyName={profile?.companyName}
          companyStatus={profile?.status ?? undefined}
          identityLoading={identityLoading}
          businessModel={profile?.businessModel}
          can={can}
          isOwner={isOwner}
        />
      )}
      {!isMessagesPage && (
        <Topbar
          activePage={page}
          onNavigate={handleNavigate}
          companyLogo={profile?.logo}
          companyName={profile?.companyName}
          companyId={profile?.id}
          companyStatus={profile?.status ?? undefined}
          companyEmail={profile?.businessEmail ?? undefined}
          companyVille={profile?.ville ?? undefined}
          companyPays={profile?.pays ?? undefined}
          identityLoading={identityLoading}
          businessModel={profile?.businessModel}
          can={can}
          isOwner={isOwner}
        />
      )}

      {isReseauPage && (
        <ReseauBottomNav activePage={page} onNavigate={handleNavigate} />
      )}

      <main className={[
        'main',
        isReseauPage    ? 'main-reseau'    : '',
        isMessagesPage  ? 'main-fullscreen' : '',
      ].filter(Boolean).join(' ')}>
        <Suspense fallback={<LoadingScreen mini />}>
          <PageRenderer
            page={page}
            productId={productId}
            viewedId={viewedId}
            onNavigate={handleNavigate}
            onPop={handlePop}
          />
        </Suspense>
      </main>

      <ToastContainer />
      <NotificationToastStack />

      {!isMessagesPage && (
        <div className="fab">
          <button
            className="fab-main"
            onClick={() => handleNavigate(profile?.businessModel === 'services' ? 'ajouter-service' : 'ajouter')}
            title={profile?.businessModel === 'services' ? 'Ajouter un service' : 'Ajouter un produit'}
          >
            <i className="fas fa-plus" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

export default function EntrepriseApp() {
  return (
    <ToastProvider>
      <NotificationProvider>
        <EntrepriseLayout />
      </NotificationProvider>
    </ToastProvider>
  );
}
