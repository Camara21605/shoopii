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
import { NotificationProvider }   from '../../shared/notifications/NotificationContext';
import NotificationToastStack     from '../../shared/notifications/NotificationToastStack';

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

  const closeSide  = () => setSideOpen(false);

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
    <NotificationProvider>
      <NotificationToastStack />
      <div className={s.root}>
        {/* Overlay sidebar mobile */}
        {sideOpen && <div className={s.overlay} onClick={closeSide} />}

        {/* Sidebar navigation */}
        <Sidebar
          page={page}
          setPage={setPage}
          open={sideOpen}
          onClose={closeSide}
        />

        {/* Topbar */}
        <Topbar
          page={page}
          onMenu={() => setSideOpen(o => !o)}
          onPage={setPage}
        />

        {/* Contenu de la page active */}
        <main className={s.main}>
          {PAGE_MAP[page]}
        </main>

        {/* Toasts */}
        <Toast />
      </div>
    </NotificationProvider>
  );
}