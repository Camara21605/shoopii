/* ================================================================
 * FICHIER : src/dashboards/partenaire/PartenaireApp.tsx
 *
 * App principale du dashboard partenaire.
 * ================================================================ */

import { useState } from 'react';
import styles from './styles/PartenaireApp.module.css';

import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import { useToasts, ToastStack } from './components/Toast';
import GenerateCodeModal from './components/GenerateCodeModal';
import ReportModal from './components/ReportModal';

import OverviewPage from './pages/OverviewPage';
import CodesPage from './pages/CodesPage';
import ActeursPage from './pages/ActeursPage';
import CommissionsPage from './pages/CommissionsPage';
import SignalementsPage from './pages/SignalementsPage';
import PlaceholderPage from './pages/PlaceholderPage';
import ParametresPage  from './pages/ParametresPage';

import { usePartenaireState } from './hooks/usePartenaireState';
import { NotificationProvider }   from '../../shared/notifications/NotificationContext';
import NotificationToastStack     from '../../shared/notifications/NotificationToastStack';

export default function PartenaireApp() {
  const { toasts, pop } = useToasts();
  const s = usePartenaireState();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleNavigate(page: Parameters<typeof s.navigate>[0]) {
    s.navigate(page);
    setSidebarOpen(false);
  }

  /* PageRenderer : mappe activePage → composant */
  function renderPage() {
    switch (s.activePage) {
      case 'overview':
        return <OverviewPage onNavigate={handleNavigate} onGenerate={() => s.setGenOpen(true)} />;
      case 'codes':
        return <CodesPage onGenerate={() => s.setGenOpen(true)} onToast={pop} />;
      case 'acteurs':
        return <ActeursPage onReport={s.ouvrirSignalement} onToast={pop} />;
      case 'commissions':
        return <CommissionsPage onNavigate={handleNavigate} onToast={pop} />;
      case 'signalements':
        return <SignalementsPage onReport={() => s.ouvrirSignalement()} />;
      case 'invitations':
        return <PlaceholderPage icon="fa-paper-plane" title="Invitations"
          text="Suivez ici les invitations envoyées par lien de parrainage, en plus des codes de création. Section à brancher." />;
      case 'paiements':
        return <PlaceholderPage icon="fa-wallet" title="Paiements"
          text="Historique de vos retraits de commissions (Orange Money, MTN, virement). Section à brancher." />;
      case 'stats':
        return <PlaceholderPage icon="fa-chart-line" title="Statistiques"
          text="Analyses détaillées : conversion par type d'acteur, performance mensuelle, classement partenaires. Section à brancher." />;
      case 'parametres':
        return <ParametresPage />;
      default:
        return null;
    }
  }

  return (
    <NotificationProvider>
    <NotificationToastStack />
    <div className={styles.app}>
      <Sidebar
        activePage={s.activePage}
        onNavigate={handleNavigate}
        onGenerate={() => { s.setGenOpen(true); setSidebarOpen(false); }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <Topbar
        activePage={s.activePage}
        onGenerate={() => s.setGenOpen(true)}
        onReport={() => s.ouvrirSignalement()}
        onToast={pop}
        onMenuToggle={() => setSidebarOpen(o => !o)}
      />

      <main className={styles.main}>
        <div className={styles.page}>
          {renderPage()}
        </div>
      </main>

      {/* Modales globales */}
      {s.genOpen && (
        <GenerateCodeModal
          onClose={() => s.setGenOpen(false)}
          onGenerate={s.genererCode}
          onToast={pop}
        />
      )}
      {s.reportOpen && (
        <ReportModal
          defaultTarget={s.reportTarget}
          onClose={() => s.setReportOpen(false)}
          onSubmit={s.envoyerSignalement}
          onToast={pop}
        />
      )}

      <ToastStack toasts={toasts} />
    </div>
    </NotificationProvider>
  );
}
