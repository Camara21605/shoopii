/* ================================================================
 * FICHIER : src/dashboards/administrateur/AdministrateurApp.tsx
 *
 * Point d'entrée du dashboard administrateur de zone Shopi.
 * Pattern activePage + PageRenderer (identique partenaire/client).
 * Route : /dashboard/administrateur/*
 * ================================================================ */

import { lazy, Suspense, useEffect } from 'react';
import styles from './styles/AdminApp.module.css';
import { useAdminState } from './hooks/useAdminState';
import { useToasts, ToastStack } from './components/Toast';
import {
  fetchPrefs,
  applyPrefs,
  watchAutoTheme,
} from '../../shared/services/appearanceService';

import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import GenerateCodeModal from './components/GenerateCodeModal';
import SanctionModal from './components/SanctionModal';

/* ── Pages chargées à la demande ── */
const OverviewPage       = lazy(() => import('./pages/OverviewPage'));
const CodesPage          = lazy(() => import('./pages/CodesPage'));
const PartenairesPage    = lazy(() => import('./pages/PartenairesPage'));
const ActeursPage        = lazy(() => import('./pages/ActeursPage'));
const ValidationsPage    = lazy(() => import('./pages/ValidationsPage'));
const SignalementsPage   = lazy(() => import('./pages/SignalementsPage'));
const CommandesPage      = lazy(() => import('./pages/CommandesPage'));
const FinancesPage       = lazy(() => import('./pages/FinancesPage'));
const AuditPage          = lazy(() => import('./pages/AuditPage'));
const ParametresPage     = lazy(() => import('./pages/ParametresPage'));
const GeoReferentielPage = lazy(() => import('./pages/GeoReferentielPage'));

export default function AdministrateurApp() {
  const { toasts, pop } = useToasts();
  const s = useAdminState();

  /**
   * Appliquer les préférences d'apparence dès le montage du dashboard,
   * avant même que l'utilisateur ouvre la section Paramètres.
   * En cas d'erreur réseau, le dashboard s'affiche avec les valeurs par défaut.
   */
  useEffect(() => {
    fetchPrefs()
      .then(prefs => {
        applyPrefs(prefs);
        watchAutoTheme(prefs);
      })
      .catch(() => { /* silencieux — defaults déjà appliqués par le service */ });
  }, []);

  /* PageRenderer : rend la page active en fonction de s.activePage */
  const renderPage = () => {
    switch (s.activePage) {
      case 'overview':     return <OverviewPage onNavigate={s.navigate} />;
      case 'codes':        return <CodesPage onGenerate={() => s.setGenOpen(true)} onToast={pop} />;
      case 'partenaires':  return <PartenairesPage onSanction={s.ouvrirSanction} onToast={pop} />;
      case 'acteurs':      return <ActeursPage onSanction={s.ouvrirSanction} onToast={pop} />;
      case 'validations':  return <ValidationsPage onToast={pop} />;
      case 'signalements': return <SignalementsPage onSanction={s.ouvrirSanction} onToast={pop} />;
      case 'commandes':    return <CommandesPage onToast={pop} />;
      case 'finances':     return <FinancesPage onToast={pop} />;
      case 'audit':        return <AuditPage onToast={pop} />;
      case 'parametres':   return <ParametresPage onToast={pop} />;
      case 'geo':          return <GeoReferentielPage geoPerms={s.geoPerms} onToast={pop} />;
      default:             return <OverviewPage onNavigate={s.navigate} />;
    }
  };

  return (
    <div className={styles.app}>
      {/* ── Sidebar latérale (fixe desktop, coulissante mobile) ── */}
      <Sidebar
        activePage={s.activePage}
        open={s.sbOpen}
        onClose={() => s.setSbOpen(false)}
        onNavigate={s.navigate}
        onGenerate={() => s.setGenOpen(true)}
        geoPerms={s.geoPerms}
      />

      {/* ── Corps principal (topbar + page) ── */}
      <div className={styles.main}>
        <Topbar
          activePage={s.activePage}
          onBurger={() => s.setSbOpen(true)}
          onGenerate={() => s.setGenOpen(true)}
          onNavigate={s.navigate}
          onToast={pop}
        />
        <main className={styles.page}>
          <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><i className="fas fa-circle-notch fa-spin" style={{ fontSize: 24, opacity: 0.5 }} /></div>}>
            {renderPage()}
          </Suspense>
        </main>
      </div>

      {/* ── Modales globales ── */}
      {s.genOpen && (
        <GenerateCodeModal
          onClose={() => s.setGenOpen(false)}
          onGenerate={s.genererCode}
          onToast={pop}
        />
      )}
      {s.sanctionTarget && (
        <SanctionModal
          target={s.sanctionTarget}
          onClose={s.fermerSanction}
          onConfirm={() => {
            const cible = s.sanctionTarget;
            s.fermerSanction();
            pop(`🚫 ${cible} suspendu — consigné au journal d'audit`, 'w');
          }}
        />
      )}

      {/* ── Toasts locaux ── */}
      <ToastStack toasts={toasts} />
    </div>
  );
}
