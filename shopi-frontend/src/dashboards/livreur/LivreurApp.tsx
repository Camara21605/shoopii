// src/dashboards/livreur/LivreurApp.tsx
// Route : /livreur/*
// Contrôleur racine du dashboard livreur.
// Accent : teal (#0E7490) + navy

import React, { useState, useCallback, useEffect } from 'react';
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

export default function LivreurApp() {
  const [page,        setPage]        = useState<PageId>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [isOnline,    setIsOnline]    = useState(true);
  const [todayEarn,   setTodayEarn]   = useState(44_000);
  const [toasts,      setToasts]      = useState<ToastMsg[]>([]);
  const [viewedId,    setViewedId]    = useState<string | null>(null);

  // Toast system
  const pop = useCallback((msg: string, type = 'i') => {
    const id = Date.now();
    setToasts(t => [{ id, msg, type }, ...t]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3400);
  }, []);

  // Navigation
  const navigate = useCallback((p: PageId) => {
    setPage(p);
    setSidebarOpen(false);
    setNotifOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Voir le profil d'un correspondant / livreur du réseau
  const viewCorrespondant = useCallback((id: string) => {
    setViewedId(id);
    navigate('profilCorrespondant');
  }, [navigate]);

  const viewLivreur = useCallback((id: string) => {
    setViewedId(id);
    navigate('profilLivreur');
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
        onNavigate={navigate}
        onClose={() => setSidebarOpen(false)}
        onToggleOnline={() => {
          setIsOnline(v => {
            pop(v ? '⏸️ Hors ligne — Aucune nouvelle mission' : '✅ Vous êtes maintenant en ligne', v ? 'w' : 's');
            return !v;
          });
        }}
        onPop={pop}
      />

      {/* Topbar */}
      <Topbar
        title={meta.title}
        subtitle={meta.sub}
        isOnline={isOnline}
        onMenuToggle={() => setSidebarOpen(o => !o)}
        onNotif={() => setNotifOpen(o => !o)}
        onNavigate={navigate}
        onPop={pop}
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
          <ParametresPage onBack={() => navigate('overview')} onPop={pop} />
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