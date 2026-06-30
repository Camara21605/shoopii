/*
 * FICHIER : src/dashboards/entreprise/EntrepriseApp.tsx
 *
 * ✅ NAVIGATION URL-BASED :
 *    La page active est lue depuis l'URL (useParams) et écrite
 *    avec useNavigate. Un rafraîchissement conserve la page courante.
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

import { useEffect }                         from 'react';
import { useParams, useNavigate }            from 'react-router-dom';
import { useState }                          from 'react';

import Sidebar          from './layout/Sidebar';
import Topbar           from './layout/Topbar';
import ReseauBottomNav  from './layout/ReseauBottomNav';

import { ToastProvider } from '../../shared/context/ToastContext';
import ToastContainer    from '../../shared/components/ui/ToastContainer';
import { apiFetch }      from '../../shared/services/apiFetch';

// Pages
import OverviewPage                   from './pages/OverviewPage';
import CommandesPage                  from './pages/CommandesPage';
import RetoursPage                    from './pages/RetoursPage';
import ProduitsPage                   from './pages/ProduitsPage';
import AjouterProduitPage             from './pages/AjouterPage';
import InventairePage                 from './pages/InventairePage';
import PromotionsPage                 from './pages/PromotionsPage';
import AnalyticsPage                  from './pages/AnalyticsPage';
import MessagesPage                   from './pages/MessagesPage';
import SEOPage                        from './pages/SEOPage';
import LivreursPage                   from './pages/LivreursPage';
import CorrespondantsPage             from './pages/CorrespondantsPage';
import FinancesPage                   from './pages/FinancesPage';
import PortefeuillePage               from './pages/PortefeuillePage';
import ClientsPage                    from './pages/ClientsPage';
import AvisPage                       from './pages/AvisPage';
import ParametresPage                 from './pages/ParametresPage';
import ReseauCorrespondantsPage       from './pages/ReseauCorrespondantsPage';
import ReseauLivreursPage             from './pages/ReseauLivreursPage';
import ProfilCorrespondantReseauPage  from './pages/ProfilCorrespondantReseauPage';
import ProfilLivreurReseauPage        from './pages/ProfilLivreurReseauPage';
import ProfilEntreprisePage           from '../../shared/profils/profil-entreprise/ProfilEntreprisePage';
import BoutiquePreviewPage            from './pages/BoutiquePreviewPage';

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

  /* Pages directes */
  const DIRECT_PAGES: EntreprisePage[] = [
    'commandes', 'retours', 'produits', 'inventaire',
    'promotions', 'analytics', 'messages', 'seo',
    'livreurs', 'correspondants', 'finances', 'portefeuille',
    'clients', 'avis', 'parametres', 'profil', 'boutique-preview',
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
    case 'inventaire':     return <InventairePage />;
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
    default:                 return <OverviewPage onNavigate={onNavigate} />;
  }
}

// ─────────────────────────────────────────────────────────────
// Layout principal
// ─────────────────────────────────────────────────────────────

interface BoutiqueProfile {
  id:            string;
  companyName:   string;
  logo:          string | null;
  status:        string | null;
  businessEmail: string | null;
  ville:         string | null;
  pays:          string | null;
}

function EntrepriseLayout() {
  /* ── URL → état ── */
  const { '*': splat = '' }  = useParams<{ '*': string }>();
  const navigate             = useNavigate();
  const { page, productId, viewedId } = parseSplat(splat);

  /* ── Profil boutique (logo + nom) ── */
  const [profile, setProfile] = useState<BoutiqueProfile | null>(null);
  const { pop } = useToast();

  useEffect(() => {
    apiFetch<BoutiqueProfile>('/dashboard/entreprise/parametres')
      .then(data => setProfile(data))
      .catch(() => {});
  }, []);

  const handlePop = (msg: string, type?: string) => pop(msg, type as ToastType | undefined);

  /* La barre réseau mobile (ReseauBottomNav) ne s'affiche que sur ces pages —
     ailleurs, .main n'a pas besoin du padding-bottom supplémentaire qu'elle réserve. */
  const isReseauPage =
    page === 'reseauCorrespondants' || page === 'reseauLivreurs' ||
    page === 'profilCorrespondantReseau' || page === 'profilLivreurReseau';

  /* ── Navigation → URL ── */
  const handleNavigate: NavigateFn = (targetPage, id?) => {
    const segment = buildPath(targetPage, id);
    navigate(`/dashboard/entreprise${segment ? `/${segment}` : ''}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="entreprise-app">
      <Sidebar
        activePage={page}
        onNavigate={handleNavigate}
        companyLogo={profile?.logo}
        companyName={profile?.companyName}
      />
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
      />

      {/* ✅ Barre réseau mobile : uniquement sur les pages réseau,
          sinon elle s'affichait au-dessus de la nav principale sur
          TOUTES les pages (Commandes, Produits…), rendant le bas
          de l'écran encombré/confus sur mobile. */}
      {isReseauPage && (
        <ReseauBottomNav activePage={page} onNavigate={handleNavigate} />
      )}

      <main className={`main${isReseauPage ? ' main-reseau' : ''}`}>
        <PageRenderer
          page={page}
          productId={productId}
          viewedId={viewedId}
          onNavigate={handleNavigate}
          onPop={handlePop}
        />
      </main>

      <ToastContainer />

      <div className="fab">
        <button
          className="fab-main"
          onClick={() => handleNavigate('ajouter')}
          title="Ajouter un produit"
        >
          <i className="fas fa-plus" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

export default function EntrepriseApp() {
  return (
    <ToastProvider>
      <EntrepriseLayout />
    </ToastProvider>
  );
}
