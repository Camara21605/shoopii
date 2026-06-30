// src/dashboards/livreur/LivreurApp.tsx
// Route : /dashboard/livreur/*
// Contrôleur racine du dashboard livreur.
// Accent : teal (#0E7490) + navy
//
// ✅ NAVIGATION URL-BASED :
//    La page active est lue depuis l'URL (useParams) et écrite avec
//    useNavigate. Un rafraîchissement conserve la page courante.
//
// Exemples d'URL :
//   /dashboard/livreur/                       → overview
//   /dashboard/livreur/missions                → missions
//   /dashboard/livreur/reseau/correspondants   → reseauCorrespondants
//   /dashboard/livreur/reseau/livreurs/{id}    → profilLivreur

import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate as useRouterNavigate } from 'react-router-dom';
import { tokenStorage, apiFetch } from '../../shared/services/apiFetch';
import type { PageId } from './data/livreurData';
import { PAGE_META } from './data/livreurData';

import Sidebar         from './components/Sidebar';
import Topbar          from './components/Topbar';
import BottomNav       from './components/BottomNav';
import NotifPanel      from './components/NotifPanel';
import Toast           from './components/Toast';

import OverviewPage    from './pages/OverviewPage';
import MissionsPage    from './pages/MissionsPage';
import EnCoursPage     from './pages/EnCoursPage';
import HistoriquePage  from './pages/HistoriquePage';
import BoutiquesPage   from './pages/BoutiquesPage';
import AbonnerPage     from './pages/AbonnerPage';
import RevenusPage     from './pages/RevenusPage';
import WalletPage      from './pages/WalletPage';
import ZonePage        from './pages/ZonePage';
import AjouterCorrespondantPage from './pages/AjouterCorrespondantPage';
import ParametresPage  from './pages/LivreurParametresPage';
import MessagesPage    from './pages/MessagesPage';
import ReseauCorrespondantsPage from './pages/ReseauCorrespondantsPage';
import ReseauLivreursPage       from './pages/ReseauLivreursPage';
import ProfilCorrespondantReseauPage from './pages/ProfilCorrespondantReseauPage';
import ProfilLivreurReseauPage       from './pages/ProfilLivreurReseauPage';
import MonProfilLivreurPage          from './pages/MonProfilLivreurPage';

import styles from './styles/LivreurApp.module.css';

// ── Types Toast ───────────────────────────────────────────────
interface ToastMsg { id: number; msg: string; type: string; }

// ── URL ↔ Page mapping ──────────────────────────────────────────

/** Construit le segment d'URL depuis une page + id optionnel. */
function buildPath(page: PageId, id?: string): string {
  switch (page) {
    case 'overview':             return '';
    case 'reseauCorrespondants': return 'reseau/correspondants';
    case 'reseauLivreurs':       return 'reseau/livreurs';
    case 'profilCorrespondant':  return id ? `reseau/correspondants/${id}` : 'reseau/correspondants';
    case 'profilLivreur':        return id ? `reseau/livreurs/${id}` : 'reseau/livreurs';
    default:                     return page; // slug direct pour toutes les autres pages
  }
}

/** Déduit la page active depuis le splat URL (* après /dashboard/livreur/). */
function parseSplat(splat: string): { page: PageId; viewedId?: string } {
  const parts = splat.split('/').filter(Boolean);
  const [a, b, c] = parts;

  if (!a) return { page: 'overview' };

  if (a === 'reseau') {
    if (b === 'correspondants') {
      return c ? { page: 'profilCorrespondant', viewedId: c } : { page: 'reseauCorrespondants' };
    }
    if (b === 'livreurs') {
      return c ? { page: 'profilLivreur', viewedId: c } : { page: 'reseauLivreurs' };
    }
    return { page: 'overview' };
  }

  const DIRECT_PAGES: PageId[] = [
    'missions', 'encours', 'historique', 'boutiques', 'abonner',
    'revenus', 'wallet', 'zone', 'evaluation', 'parametres', 'profil', 'messagerie',
  ];
  if (DIRECT_PAGES.includes(a as PageId)) return { page: a as PageId };

  return { page: 'overview' };
}

export default function LivreurApp() {
  const routerNavigate = useRouterNavigate();
  const { '*': splat = '' } = useParams<{ '*': string }>();
  const { page, viewedId } = parseSplat(splat);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [isOnline,    setIsOnline]    = useState(true);
  const [todayEarn,   setTodayEarn]   = useState(44_000);
  const [toasts,      setToasts]      = useState<ToastMsg[]>([]);
  const [avatarUrl,    setAvatarUrl]    = useState<string | null>(null);
  const [livreurName,  setLivreurName]  = useState<string>('');
  const [rating,       setRating]       = useState<number | null>(null);
  const [totalDeliveries, setTotalDeliveries] = useState<number | null>(null);
  const [encoursCount, setEncoursCount] = useState(0);

  /* Charge la photo de profil au montage (endpoint léger — 2 colonnes seulement) */
  const refreshAvatar = useCallback(() => {
    apiFetch<{ photoUrl: string | null; fullName: string }>('/dashboard/livreur/parametres/me')
      .then(d => { setAvatarUrl(d.photoUrl); setLivreurName(d.fullName); })
      .catch(() => {});
  }, []);

  useEffect(() => { refreshAvatar(); }, [refreshAvatar]);

  /* Charge les chiffres réels affichés dans la carte profil de la sidebar
     (note, livraisons, missions en cours, boutiques suivies). */
  useEffect(() => {
    apiFetch<{ averageRating: number | string | null; totalDeliveries: number | string }>('/dashboard/livreur/stats')
      .then(d => {
        /* Les colonnes decimal TypeORM reviennent en string côté JSON — on force le cast. */
        setRating(d.averageRating != null ? Number(d.averageRating) : null);
        setTotalDeliveries(d.totalDeliveries != null ? Number(d.totalDeliveries) : 0);
      })
      .catch(() => {});

    apiFetch<{ activeMissions: unknown[] }>('/dashboard/livreur/missions')
      .then(d => setEncoursCount(d.activeMissions?.length ?? 0))
      .catch(() => {});

    /* NOTE : pas d'endpoint "boutiques suivies par un livreur" pour l'instant —
       /suivis/mes-abonnements est réservé aux profils client. Le badge
       correspondant reste donc masqué côté Sidebar (cf. buildNavReseau). */
  }, []);

  /* Déconnexion : vide le token et redirige vers /login */
  const handleLogout = useCallback(() => {
    tokenStorage.remove();
    routerNavigate('/login');
  }, [routerNavigate]);

  /* Retour à l'espace public */
  const handleGoHome = useCallback(() => {
    routerNavigate('/home');
  }, [routerNavigate]);

  // Toast system
  const pop = useCallback((msg: string, type = 'i') => {
    const id = Date.now();
    setToasts(t => [{ id, msg, type }, ...t]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3400);
  }, []);

  // Navigation → écrit l'URL (un rafraîchissement conserve donc la page)
  const navigate = useCallback((p: PageId, id?: string) => {
    const segment = buildPath(p, id);
    routerNavigate(`/dashboard/livreur${segment ? `/${segment}` : ''}`);
    setSidebarOpen(false);
    setNotifOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [routerNavigate]);

  // Voir le profil d'un correspondant / livreur du réseau
  const viewCorrespondant = useCallback((id: string) => {
    navigate('profilCorrespondant', id);
  }, [navigate]);

  const viewLivreur = useCallback((id: string) => {
    navigate('profilLivreur', id);
  }, [navigate]);

  // Resize : ferme sidebar
  useEffect(() => {
    const fn = () => { if (window.innerWidth > 640) setSidebarOpen(false); };
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  // Escape : ferme sidebar + notifs
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSidebarOpen(false); setNotifOpen(false); }
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, []);

  const meta = PAGE_META[page];

  return (
    <div className={styles.root}>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Panel notifications */}
      <NotifPanel isOpen={notifOpen} onClose={() => setNotifOpen(false)} onPop={pop} />

      {/* Sidebar */}
      <Sidebar
        activePage={page}
        isOpen={sidebarOpen}
        isOnline={isOnline}
        todayEarn={todayEarn}
        avatarUrl={avatarUrl}
        livreurName={livreurName}
        rating={rating}
        totalDeliveries={totalDeliveries}
        encoursCount={encoursCount}
        onNavigate={navigate}
        onClose={() => setSidebarOpen(false)}
        onToggleOnline={() => {
          setIsOnline(v => {
            pop(v ? '⏸️ Hors ligne — Aucune nouvelle mission' : '✅ Vous êtes maintenant en ligne', v ? 'w' : 's');
            return !v;
          });
        }}
        onLogout={handleLogout}
        onGoHome={handleGoHome}
      />

      {/* Topbar */}
      <Topbar
        title={meta.title}
        subtitle={meta.sub}
        isOnline={isOnline}
        avatarUrl={avatarUrl}
        livreurName={livreurName}
        onMenuToggle={() => setSidebarOpen(o => !o)}
        onNotif={() => setNotifOpen(o => !o)}
        onNavigate={navigate}
      />

      {/* Bottom nav (mobile) : Correspondants · Livreurs · Mon espace */}
      <BottomNav activePage={page} onNavigate={navigate} />

      {/* Pages */}
      <main className={styles.main}>
        {page === 'overview'    && <OverviewPage   onNavigate={navigate} onPop={pop} setTodayEarn={setTodayEarn} />}
        {page === 'missions'    && <MissionsPage   onPop={pop} />}
        {page === 'encours'     && <EnCoursPage    onPop={pop} onNavigate={navigate} />}
        {page === 'historique'  && <HistoriquePage onPop={pop} />}
        {page === 'boutiques'   && <BoutiquesPage  onPop={pop} />}
        {page === 'abonner'     && <AbonnerPage    onPop={pop} />}
        {page === 'revenus'     && <RevenusPage    onPop={pop} />}
        {page === 'wallet'      && <WalletPage />}
        {page === 'zone'        && <ZonePage       onPop={pop} />}
        {page === 'evaluation'  && <AjouterCorrespondantPage onPop={pop} />}
        {page === 'parametres'  && (
          <ParametresPage onBack={() => navigate('overview')} onPop={pop} onAvatarRefresh={refreshAvatar} />
        )}
        {page === 'messagerie'  && <MessagesPage />}
        {page === 'reseauCorrespondants' && <ReseauCorrespondantsPage onPop={pop} onView={viewCorrespondant} />}
        {page === 'reseauLivreurs'       && <ReseauLivreursPage onPop={pop} onView={viewLivreur} />}
        {page === 'profilCorrespondant' && viewedId && (
          <ProfilCorrespondantReseauPage id={viewedId} onBack={() => navigate('reseauCorrespondants')} onPop={pop} />
        )}
        {page === 'profilLivreur' && viewedId && (
          <ProfilLivreurReseauPage id={viewedId} onBack={() => navigate('reseauLivreurs')} onPop={pop} />
        )}
        {page === 'profil'      && (
          <MonProfilLivreurPage onPop={pop} onNavigate={navigate} />
        )}
      </main>

      {/* Toasts */}
      <div className={styles.toastContainer}>
        {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} />)}
      </div>
    </div>
  );
}