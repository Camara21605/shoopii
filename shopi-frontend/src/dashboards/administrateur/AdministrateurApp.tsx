/* ================================================================
 * FICHIER : src/dashboards/administrateur/AdministrateurApp.tsx
 *
 * Point d'entrée du dashboard administrateur de zone Shoneya.
 * Pattern activePage + PageRenderer (identique partenaire/client).
 * Route : /dashboard/administrateur/*
 * ================================================================ */

import { lazy, Suspense, useEffect, useState } from 'react';
import LoadingScreen from '../../shared/components/LoadingScreen';
import styles from './styles/AdminApp.module.css';
import { useAdminState } from './hooks/useAdminState';
import { useNotifications } from './hooks/useNotifications';
import { apiFetch } from '../../shared/services/apiFetch';
import { useToasts, ToastStack } from './components/Toast';
import {
  fetchPrefs,
  applyPrefs,
  watchAutoTheme,
} from '../../shared/services/appearanceService';

import Sidebar    from './components/Sidebar';
import Topbar     from './components/Topbar';
import NotifPanel from './components/NotifPanel';
import GenerateCodeModal from './components/GenerateCodeModal';
import SanctionModal     from './components/SanctionModal';

/* ── Pages chargées à la demande ── */
const OverviewPage       = lazy(() => import('./pages/OverviewPage'));
const CodesPage          = lazy(() => import('./pages/CodesPage'));
const PartenairesPage    = lazy(() => import('./pages/PartenairesPage'));
const ActeursPage        = lazy(() => import('./pages/ActeursPage'));
const ClientsPage        = lazy(() => import('./pages/ClientsPage'));
const ValidationsPage    = lazy(() => import('./pages/ValidationsPage'));
const SignalementsPage   = lazy(() => import('./pages/SignalementsPage'));
const CommandesPage      = lazy(() => import('./pages/CommandesPage'));
const FinancesPage       = lazy(() => import('./pages/FinancesPage'));
const StatsPage          = lazy(() => import('./pages/StatsPage'));
const SupportPage        = lazy(() => import('./pages/SupportPage'));
const AuditPage          = lazy(() => import('./pages/AuditPage'));
const ParametresPage     = lazy(() => import('./pages/ParametresPage'));
const GeoReferentielPage = lazy(() => import('./pages/GeoReferentielPage'));

export default function AdministrateurApp() {
  const { toasts, pop } = useToasts();
  const s = useAdminState();

  /* ── Profil admin (sidebar) ── */
  const [adminProfile, setAdminProfile] = useState<{
    adminName: string; zoneName: string; communesCount: number;
  } | null>(null);

  /* ── Notifications temps réel ── */
  const notifs = useNotifications();

  /* ── Panel de notifications (dropdown topbar) ── */
  const [notifOpen, setNotifOpen] = useState(false);

  /* ── Modale sanction (suspension d'un compte) ── */
  const [sanctionBusy, setSanctionBusy] = useState(false);
  const confirmSanction = async (motif: string) => {
    const cible = s.sanctionTarget;
    if (!cible || sanctionBusy) return;
    setSanctionBusy(true);
    try {
      await apiFetch(`/dashboard/admin/acteurs/${cible.id}/suspend`, {
        method: 'PATCH',
        body:   { motif: motif || undefined },
      });
      s.fermerSanction();
      pop(`🚫 ${cible.nom} suspendu — consigné au journal d'audit`, 'w');
    } catch (e: any) {
      pop(e?.message ?? 'Erreur lors de la suspension', 'w');
    } finally {
      setSanctionBusy(false);
    }
  };

  /* ── Deep-link "clic sur une notification" ──
   * Id de la ressource précise à surligner/afficher sur la page cible
   * (ValidationsPage / SignalementsPage). Effacé dès qu'on navigue
   * "normalement" (sidebar/topbar) ailleurs que via une notification. */
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const navigate = (page: typeof s.activePage) => { setHighlightId(null); s.navigate(page); };
  const navigateFromNotif = (page: typeof s.activePage, resourceId?: string | null) => {
    setHighlightId(resourceId ?? null);
    s.navigate(page);
  };

  useEffect(() => {
    fetchPrefs()
      .then(prefs => { applyPrefs(prefs); watchAutoTheme(prefs); })
      .catch(() => {});
    apiFetch('/dashboard/admin/me')
      .then(d => setAdminProfile(d as any))
      .catch(() => {});
  }, []);

  /* Filet de sécurité : si l'accès à activePage a été révoqué (ou n'a
   * jamais été accordé) pendant que l'admin s'y trouvait déjà — ex. le
   * super-admin retire "Signalements" en temps réel — on renvoie vers
   * la vue d'ensemble plutôt que de laisser une page à moitié accessible
   * affichée. Miroir de Sidebar.tsx (même mapping page → permission). */
  const PAGE_PERM: Partial<Record<typeof s.activePage, string>> = {
    partenaires:   'partners',
    signalements:  'reports',
    clients:       'customers',
    stats:         'stats',
    support:       'support',
  };
  useEffect(() => {
    if (!s.permsLoaded) return; // attend le premier chargement avant de juger
    const requiredPerm = PAGE_PERM[s.activePage];
    if (requiredPerm && s.geoPerms[requiredPerm] !== true) {
      s.navigate('overview');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.activePage, s.geoPerms, s.permsLoaded]);

  /* ── PageRenderer ── */
  const renderPage = () => {
    switch (s.activePage) {
      case 'overview':       return <OverviewPage onNavigate={navigate} />;
      case 'codes':          return <CodesPage onGenerate={() => s.setGenOpen(true)} onToast={pop} />;
      case 'partenaires':    return <PartenairesPage onSanction={s.ouvrirSanction} onToast={pop} />;
      case 'acteurs':        return <ActeursPage onSanction={s.ouvrirSanction} onToast={pop} geoPerms={s.geoPerms} />;
      case 'clients':        return <ClientsPage onToast={pop} />;
      case 'validations':    return <ValidationsPage onToast={pop} highlightId={highlightId} />;
      case 'signalements':   return <SignalementsPage onSanction={s.ouvrirSanction} onToast={pop} highlightId={highlightId} />;
      case 'commandes':      return <CommandesPage onToast={pop} />;
      case 'finances':       return <FinancesPage onToast={pop} />;
      case 'stats':          return <StatsPage onToast={pop} />;
      case 'support':        return <SupportPage onToast={pop} />;
      case 'audit':          return <AuditPage onToast={pop} />;
      case 'parametres':     return <ParametresPage onToast={pop} />;
      case 'geo':            return <GeoReferentielPage geoPerms={s.geoPerms} onToast={pop} />;
      default:               return <OverviewPage onNavigate={navigate} />;
    }
  };

  return (
    <div className={styles.app}>
      {/* ── Sidebar latérale (fixe desktop, coulissante mobile) ── */}
      <Sidebar
        activePage={s.activePage}
        open={s.sbOpen}
        onClose={() => s.setSbOpen(false)}
        onNavigate={navigate}
        onGenerate={() => s.setGenOpen(true)}
        geoPerms={s.geoPerms}
        zoneName={adminProfile?.zoneName}
        adminName={adminProfile?.adminName}
        communesCount={adminProfile?.communesCount}
      />

      {/* ── Corps principal (topbar + page) ── */}
      <div className={styles.main}>
        <Topbar
          activePage={s.activePage}
          onBurger={() => s.setSbOpen(true)}
          onGenerate={() => s.setGenOpen(true)}
          onNavigate={navigate}
          onToast={pop}
          unreadCount={notifs.unreadCount}
          onBell={() => setNotifOpen(o => !o)}
          geoPerms={s.geoPerms}
        />

        <main className={styles.page}>
          <Suspense fallback={<LoadingScreen mini />}>
            {renderPage()}
          </Suspense>
        </main>
      </div>

      {/* ── Dropdown notifications ── */}
      {notifOpen && (
        <NotifPanel
          items={notifs.items}
          unreadCount={notifs.unreadCount}
          loading={notifs.loading}
          onMarkRead={notifs.markRead}
          onMarkAll={notifs.markAll}
          onDismiss={notifs.dismiss}
          onClose={() => setNotifOpen(false)}
          onNavigate={navigateFromNotif}
        />
      )}

      {/* ── Modales globales ── */}
      {s.genOpen && (
        <GenerateCodeModal
          onClose={() => s.setGenOpen(false)}
          onToast={pop}
        />
      )}
      {s.sanctionTarget && (
        <SanctionModal
          target={s.sanctionTarget}
          busy={sanctionBusy}
          onClose={s.fermerSanction}
          onConfirm={confirmSanction}
        />
      )}

      {/* ── Toasts locaux ── */}
      <ToastStack toasts={toasts} />
    </div>
  );
}
