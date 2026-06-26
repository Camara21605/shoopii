/*
 * FICHIER : src/dashboards/entreprise/EntrepriseApp.tsx
 *
 * ✅ MODIFIÉ : Sidebar et Topbar reçoivent maintenant companyLogo et companyName
 *    chargés depuis l'API au montage.
 */

import { useState, useEffect } from 'react';

import Sidebar from './layout/Sidebar';
import Topbar  from './layout/Topbar';
import ReseauBottomNav from './layout/ReseauBottomNav';

import { ToastProvider }  from '../../shared/context/ToastContext';
import ToastContainer     from '../../shared/components/ui/ToastContainer';
import { apiFetch }       from '../../shared/services/apiFetch';

// Pages
import OverviewPage       from './pages/OverviewPage';
import CommandesPage      from './pages/CommandesPage';
import RetoursPage        from './pages/RetoursPage';
import ProduitsPage       from './pages/ProduitsPage';
import AjouterProduitPage from './pages/AjouterPage';
import InventairePage     from './pages/InventairePage';
import PromotionsPage     from './pages/PromotionsPage';
import AnalyticsPage      from './pages/AnalyticsPage';
import MessagesPage       from './pages/MessagesPage';
import SEOPage            from './pages/SEOPage';
import LivreursPage       from './pages/LivreursPage';
import CorrespondantsPage from './pages/CorrespondantsPage';
import FinancesPage       from './pages/FinancesPage';
import PortefeuillePage   from './pages/PortefeuillePage';
import ClientsPage        from './pages/ClientsPage';
import AvisPage           from './pages/AvisPage';
import ParametresPage     from './pages/ParametresPage';
import ReseauCorrespondantsPage from './pages/ReseauCorrespondantsPage';
import ReseauLivreursPage       from './pages/ReseauLivreursPage';
import ProfilCorrespondantReseauPage from './pages/ProfilCorrespondantReseauPage';
import ProfilLivreurReseauPage       from './pages/ProfilLivreurReseauPage';
import ProfilEntreprisePage          from '../../shared/profils/profil-entreprise/ProfilEntreprisePage';
import BoutiquePreviewPage           from './pages/BoutiquePreviewPage';

import type { EntreprisePage, ToastType } from './types';
import { useToast } from '../../shared/context/ToastContext';

import '../../styles/global.css';
import './EntrepriseApp.css';

export type NavigateFn = (page: EntreprisePage, productId?: string) => void;

// ─────────────────────────────────────────────────────────────
// Type minimal profil boutique
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

// ─────────────────────────────────────────────────────────────
// Rendu de la page active
// ─────────────────────────────────────────────────────────────

function PageRenderer({
  page, productId, viewedId, onNavigate, onPop,
}: {
  page:       EntreprisePage;
  productId?: string;
  viewedId:   string | null;
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
    case 'profil':            return <ProfilEntreprisePage onNavigate={onNavigate} />;
    case 'boutique-preview':  return <BoutiquePreviewPage onNavigate={onNavigate} />;
    default:                  return <OverviewPage onNavigate={onNavigate} />;
  }
}

// ─────────────────────────────────────────────────────────────
// Layout principal
// ─────────────────────────────────────────────────────────────

function EntrepriseLayout() {
  const [activePage, setActivePage] = useState<EntreprisePage>('overview');
  const [productId,  setProductId]  = useState<string | undefined>(undefined);
  const [viewedId,   setViewedId]   = useState<string | null>(null);
  const { pop } = useToast();

  // ✅ NOUVEAU — profil boutique pour le logo dans Sidebar et Topbar
  const [profile, setProfile] = useState<BoutiqueProfile | null>(null);

  useEffect(() => {
    apiFetch<BoutiqueProfile>('/dashboard/entreprise/parametres')
      .then(data => setProfile(data))
      .catch(() => { /* silencieux — initiales par défaut */ });
  }, []);

  const handlePop = (msg: string, type?: string) => pop(msg, type as ToastType | undefined);

  const handleNavigate: NavigateFn = (page, id?) => {
    if (page === 'profilCorrespondantReseau' || page === 'profilLivreurReseau') {
      setViewedId(id ?? null);
    } else {
      setProductId(id);
    }
    setActivePage(page);
  };

  return (
    <div className="entreprise-app">
      {/*
       * ✅ MODIFIÉ : companyLogo + companyName passés en props
       * → Sidebar affiche le logo dans la carte boutique
       * → Topbar affiche le logo dans l'avatar
       */}
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        companyLogo={profile?.logo}
        companyName={profile?.companyName}
      />
      <Topbar
        activePage={activePage}
        onNavigate={handleNavigate}
        companyLogo={profile?.logo}
        companyName={profile?.companyName}
        companyId={profile?.id}
        companyStatus={profile?.status ?? undefined}
        companyEmail={profile?.businessEmail ?? undefined}
        companyVille={profile?.ville ?? undefined}
        companyPays={profile?.pays ?? undefined}
      />

      {/* Bottom nav réseau (mobile) : Correspondants · Livreurs · Mon espace */}
      <ReseauBottomNav activePage={activePage} onNavigate={handleNavigate} />

      <main className="main">
        <PageRenderer
          page={activePage}
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
          <i className="fas fa-plus"></i>
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