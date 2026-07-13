// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/SuperAdminApp.tsx
// ─────────────────────────────────────────────────────────────

import React, { Suspense, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, tokenStorage } from '../../shared/services/apiFetch';
import { useSuperAdminState } from './hooks/useSuperAdminState';
import Sidebar   from './layout/Sidebar';
import Topbar    from './layout/Topbar';
import UserModal from './components/UserModal';
import NewMessageModal from './components/NewMessageModal';
import ToastStack from './components/ToastStack';
import { NotificationProvider }   from '../../shared/notifications/NotificationContext';
import NotificationToastStack     from '../../shared/notifications/NotificationToastStack';
import './styles/super-admin.css';

/* ── Sections chargées à la demande — une seule active à la fois ── */
const OverviewSection         = React.lazy(() => import('./sections/OverviewSection'));
const UsersSection            = React.lazy(() => import('./sections/UsersSection'));
const AnalyticsSection        = React.lazy(() => import('./sections/AnalyticsSection'));
const FinancesSection         = React.lazy(() => import('./sections/FinancesSection'));
const PortefeuilleSection     = React.lazy(() => import('./sections/PortefeuilleSection'));
const InvitationsSection      = React.lazy(() => import('./sections/InvitationsSection'));
const AlertsSection           = React.lazy(() => import('./sections/AlertsSection'));
const AuditSection            = React.lazy(() => import('./sections/AuditSection'));
const SystemSection           = React.lazy(() => import('./sections/SystemSection'));
const SettingsSection         = React.lazy(() => import('./sections/SettingsSection'));
const PermissionsSection      = React.lazy(() => import('./sections/PermissionsSection'));
const NotificationsAdminSection = React.lazy(() => import('./sections/NotificationsAdminSection'));
const SupportSection          = React.lazy(() => import('./sections/SupportSection'));
const HelpCenterSection       = React.lazy(() => import('./sections/HelpCenterSection'));
const GeoReferentielSection   = React.lazy(() => import('./sections/GeoReferentielSection'));
const CommissionsSection      = React.lazy(() => import('./sections/CommissionsSection'));
const ProfilSection           = React.lazy(() => import('./sections/ProfilSection'));

function SectionLoader() {
  return (
    <div className="section active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 26, color: 'var(--acid)', opacity: 0.7 }} />
    </div>
  );
}

export default function SuperAdminApp() {
  const store = useSuperAdminState();
  const { state, navigate, toggleTheme } = store;
  const routerNavigate = useNavigate();

  const [sidebarOpen,   setSidebarOpen]  = useState(false);
  const [newMsgOpen,    setNewMsgOpen]   = useState(false);
  const [toasts,        setToasts]       = useState<{ id: number; type: string; msg: string }[]>([]);
  const [slaViolations, setSlaViolations] = useState(0);
  const [profilName,    setProfilName]   = useState<string>('');
  const [profilAvatar,  setProfilAvatar] = useState<string | null>(null);

  const toast = useCallback((type: string, msg: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, msg }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleLogout = useCallback(() => {
    tokenStorage.remove();
    routerNavigate('/login');
  }, [routerNavigate]);

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth > 960) setSidebarOpen(false); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    apiFetch<{ slaViolations: number }>('/support/agent/stats')
      .then(data => setSlaViolations(data.slaViolations ?? 0))
      .catch(() => {});
  }, []);

  /* Charge le profil du super-admin pour la sidebar et le titre */
  useEffect(() => {
    apiFetch<{ firstName: string; lastName: string; profilePicture: string | null }>(
      '/dashboard/super-admin/my-profil',
    )
      .then(data => {
        setProfilName(`${data.firstName} ${data.lastName}`.trim());
        setProfilAvatar(data.profilePicture ?? null);
      })
      .catch(() => {/* silencieux — on garde les valeurs par défaut */});
  }, []);

  /* Écoute les mises à jour de la section ProfilSection */
  useEffect(() => {
    const onProfilUpdated = (e: CustomEvent<{ firstName: string; lastName: string }>) => {
      setProfilName(`${e.detail.firstName} ${e.detail.lastName}`.trim());
    };
    const onAvatarUpdated = (e: CustomEvent<string | null>) => {
      setProfilAvatar(e.detail);
    };
    window.addEventListener('profil-updated', onProfilUpdated as EventListener);
    window.addEventListener('avatar-updated', onAvatarUpdated as EventListener);
    return () => {
      window.removeEventListener('profil-updated', onProfilUpdated as EventListener);
      window.removeEventListener('avatar-updated', onAvatarUpdated as EventListener);
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { store.closeUserModal(); setNewMsgOpen(false); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [store]);

  const validCodesCount = store.codes.filter(c => c.status === 'valid').length;
  const sec = state.section;

  return (
    <NotificationProvider>
    <NotificationToastStack />
    <div className="app">
      <Sidebar
        activeSection={sec}
        navigate={navigate}
        navUsers={store.navUsers}
        totalUsers={store.usersTotal}
        roleStats={store.roleStats}
        pendingAlerts={store.pendingAlerts}
        totalUnread={store.totalUnread}
        validCodesCount={validCodesCount}
        slaViolations={slaViolations}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={handleLogout}
        profilName={profilName}
        profilAvatar={profilAvatar}
      />

      <div className="main">
        <Topbar
          onMenuClick={() => setSidebarOpen(true)}
          onSearchGlobal={(v) => {
            if (v.length >= 2) {
              store.setSearch(v); store.setRoleFilter('all');
              store.setStatusFilter('all'); store.setCountryFilter('all');
              navigate('users');
            }
          }}
          totalUnread={store.totalUnread}
          pendingAlerts={store.pendingAlerts}
          theme={state.theme}
          onThemeToggle={toggleTheme}
          onNavigate={navigate}
        />

        <main className="content">
          <Suspense fallback={<SectionLoader />}>
            {sec === 'overview'            && <OverviewSection store={store} toast={toast} isActive />}
            {sec === 'users'               && <UsersSection store={store} toast={toast} isActive />}
            {sec === 'analytics'           && <AnalyticsSection store={store} isActive />}
            {sec === 'finances'            && <FinancesSection store={store} isActive />}
            {sec === 'portefeuille'        && <PortefeuilleSection isActive />}
            {sec === 'invitations'         && <InvitationsSection store={store} toast={toast} isActive />}
            {sec === 'alerts'              && <AlertsSection store={store} toast={toast} isActive />}
            {sec === 'audit'               && <AuditSection store={store} isActive />}
            {sec === 'system'              && <SystemSection store={store} isActive />}
            {sec === 'settings'            && <SettingsSection store={store} toast={toast} isActive />}
            {sec === 'permissions'         && <PermissionsSection store={store} toast={toast} isActive />}
            {sec === 'notifications-admin' && <NotificationsAdminSection isActive />}
            {sec === 'support'             && <SupportSection isActive />}
            {sec === 'help-center'         && <HelpCenterSection isActive />}
            {sec === 'geo-referentiel'     && <GeoReferentielSection isActive toast={toast} />}
            {sec === 'commissions'         && <CommissionsSection isActive toast={toast} />}
            {sec === 'profil'             && <ProfilSection toast={toast} />}
          </Suspense>
        </main>
      </div>

      {state.currentUser && <UserModal store={store} toast={toast} />}
      <NewMessageModal store={store} toast={toast} isOpen={newMsgOpen} onClose={() => setNewMsgOpen(false)} />
      <ToastStack toasts={toasts} onRemove={removeToast} />
    </div>
    </NotificationProvider>
  );
}
