/* ================================================================
 * CorrespondantApp.tsx — Root du dashboard correspondant
 * Route : /correspondant/*
 * Accent : amber/orange (--cor:#B45309)
 * ================================================================ */

import React, { useState } from 'react';
import s from './styles/CorrespondantApp.module.css';

import Sidebar      from './components/Sidebar';
import Topbar       from './components/Topbar';
import Toast        from './components/Toast';
import NotifPanel   from './components/NotifPanel';

import OverviewPage    from './pages/OverviewPage';
import ColisPage       from './pages/ColisPage';
import TransfertsPage  from './pages/TransfertsPage';
import RetoursPage     from './pages/RetoursPage';
import BoutiquesPage   from './pages/BoutiquesPage';
import LivreursPage    from './pages/LivreursPage';
import ClientsPage     from './pages/ClientsPage';
import RevenusPage     from './pages/RevenusPage';
import PortefeuillePage from './pages/PortefeuillePage';
import ZonePage        from './pages/ZonePage';
import EvaluationPage  from './pages/EvaluationPage';
import ParametresPage  from './pages/ParametresPage';

import type { PageId } from './data/correspondantData';

export default function CorrespondantApp() {
  const [page,      setPage]      = useState<PageId>('overview');
  const [sideOpen,  setSideOpen]  = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const closeSide  = () => setSideOpen(false);
  const closeNotif = () => setNotifOpen(false);
  const toggleNotif = () => setNotifOpen(o => !o);

  const PAGE_MAP: Record<PageId, React.ReactNode> = {
    overview:   <OverviewPage   setPage={setPage} />,
    colis:      <ColisPage />,
    transferts: <TransfertsPage />,
    retours:    <RetoursPage />,
    boutiques:  <BoutiquesPage />,
    livreurs:   <LivreursPage />,
    clients:    <ClientsPage />,
    revenus:    <RevenusPage />,
    portefeuille: <PortefeuillePage />,
    zone:       <ZonePage />,
    evaluation: <EvaluationPage />,
    parametres: <ParametresPage />,
  };

  return (
    <div className={s.root}>
      {/* Overlay sidebar mobile */}
      {sideOpen && <div className={s.overlay} onClick={closeSide} />}

      {/* Overlay notif panel (ferme si on clique à l'extérieur) */}
      {notifOpen && <div className={s.overlay} onClick={closeNotif} />}

      {/* Sidebar navigation */}
      <Sidebar
        page={page}
        setPage={setPage}
        open={sideOpen}
        onClose={closeSide}
      />

      {/* Topbar — reçoit onNotif pour ouvrir le panneau */}
      <Topbar
        page={page}
        onMenu={() => setSideOpen(o => !o)}
        onPage={setPage}
        onNotif={toggleNotif}
        notifOpen={notifOpen}
      />

      {/* Panneau notifications — slide depuis la droite */}
      <NotifPanel open={notifOpen} onClose={closeNotif} />

      {/* Contenu de la page active */}
      <main className={s.main}>
        {PAGE_MAP[page]}
      </main>

      {/* Toasts */}
      <Toast />
    </div>
  );
}