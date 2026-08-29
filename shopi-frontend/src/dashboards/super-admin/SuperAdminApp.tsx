// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/SuperAdminApp.tsx
// ─────────────────────────────────────────────────────────────

import React, { Suspense, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../shared/services/apiFetch';
import { useAppContext } from '../../shared/context/AppContext';
import { useSuperAdminState } from './hooks/useSuperAdminState';
import Sidebar   from './layout/Sidebar';
import Topbar    from './layout/Topbar';
import UserModal from './components/UserModal';
import ToastStack from './components/ToastStack';
import { NotificationProvider }   from '../../shared/notifications/NotificationContext';
import NotificationToastStack     from '../../shared/notifications/NotificationToastStack';
import SharedNotificationsPage    from '../../shared/notifications/NotificationsPage';
import LoadingScreen from '../../shared/components/LoadingScreen';
import './styles/super-admin.css';

/* ── Sections chargées à la demande — une seule active à la fois ── */
const OverviewSection         = React.lazy(() => import('./sections/OverviewSection'));
const UsersSection            = React.lazy(() => import('./sections/UsersSection'));
const AnalyticsSection        = React.lazy(() => import('./sections/AnalyticsSection'));
const FinancesSection         = React.lazy(() => import('./sections/FinancesSection'));
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

function SectionLoader() {
  return <LoadingScreen mini />;
}

export default function SuperAdminApp() {
  // Thème sombre forcé de façon centralisée par ThemeRouteSync (router.tsx).
  const store = useSuperAdminState();
  const { state, navigate } = store;
  const routerNavigate = useNavigate();
  const { logout } = useAppContext();

  const [sidebarOpen,   setSidebarOpen]  = useState(false);
  const [toasts,        setToasts]       = useState<{ id: number; type: string; msg: string }[]>([]);
  const [slaViolations, setSlaViolations] = useState(0);

  const toast = useCallback((type: string, msg: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, msg }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    routerNavigate('/login');
  }, [routerNavigate, logout]);

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth > 1024) setSidebarOpen(false); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    apiFetch<{ slaViolations: number }>('/support/agent/stats')
      .then(data => setSlaViolations(data.slaViolations ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { store.closeUserModal(); }
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
        validCodesCount={validCodesCount}
        slaViolations={slaViolations}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
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
          pendingAlerts={store.pendingAlerts}
          onNavigate={navigate}
        />

        <main className="content">
          <Suspense fallback={<SectionLoader />}>
            {sec === 'overview'            && <OverviewSection store={store} toast={toast} isActive />}
            {sec === 'users'               && <UsersSection store={store} toast={toast} isActive />}
            {sec === 'analytics'           && <AnalyticsSection store={store} isActive />}
            {sec === 'finances'            && <FinancesSection store={store} isActive />}
            {sec === 'invitations'         && <InvitationsSection store={store} toast={toast} isActive />}
            {sec === 'alerts'              && <AlertsSection store={store} toast={toast} isActive />}
            {sec === 'audit'               && <AuditSection store={store} isActive />}
            {sec === 'system'              && <SystemSection store={store} isActive />}
            {sec === 'settings'            && <SettingsSection toast={toast} isActive onLogout={handleLogout} />}
            {sec === 'permissions'         && <PermissionsSection store={store} toast={toast} isActive />}
            {sec === 'notifications-admin' && <NotificationsAdminSection isActive />}
            {sec === 'notifications'       && <SharedNotificationsPage />}
            {sec === 'support'             && <SupportSection isActive />}
            {sec === 'help-center'         && <HelpCenterSection isActive />}
            {sec === 'geo-referentiel'     && <GeoReferentielSection isActive toast={toast} />}
            {sec === 'commissions'         && <CommissionsSection isActive toast={toast} />}
          </Suspense>
        </main>
      </div>

      {state.currentUser && <UserModal store={store} toast={toast} />}
      <ToastStack toasts={toasts} onRemove={removeToast} />
    </div>
    </NotificationProvider>
  );
}
