// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/SuperAdminApp.tsx
//
// Contrôleur principal du dashboard Super Admin.
// Instancie le hook central et distribue les props aux sections.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { tokenStorage } from '../../shared/services/apiFetch';
import { useSuperAdminState } from './hooks/useSuperAdminState';
import Sidebar from './layout/Sidebar';
import Topbar from './layout/Topbar';
import OverviewSection from './sections/OverviewSection';
import UsersSection from './sections/UsersSection';
import AnalyticsSection from './sections/AnalyticsSection';
import FinancesSection from './sections/FinancesSection';
import PortefeuilleSection from './sections/PortefeuilleSection';
import InvitationsSection from './sections/InvitationsSection';
import MessagerieCore from '../../shared/messagerie/MessagerieCore';
import AlertsSection from './sections/AlertsSection';
import AuditSection from './sections/AuditSection';
import SystemSection from './sections/SystemSection';
import SettingsSection from './sections/SettingsSection';
import PermissionsSection from './sections/PermissionsSection';
import NotificationsAdminSection from './sections/NotificationsAdminSection';
import UserModal from './components/UserModal';
import NewMessageModal from './components/NewMessageModal';
import ToastStack from './components/ToastStack';
import { NotificationProvider }   from '../../shared/notifications/NotificationContext';
import NotificationToastStack     from '../../shared/notifications/NotificationToastStack';
import './styles/super-admin.css';

export default function SuperAdminApp() {
  const store = useSuperAdminState();
  const { state, navigate, toggleTheme } = store;
  const routerNavigate = useNavigate();

  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [newMsgOpen,   setNewMsgOpen]   = useState(false);
  const [toasts, setToasts] = useState<{ id: number; type: string; msg: string }[]>([]);

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

  // Fermer sidebar sur resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 960) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Appliquer thème
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  // Fermer modals avec Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        store.closeUserModal();
        setNewMsgOpen(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [store]);

  const validCodesCount = store.codes.filter(c => c.status === 'valid').length;

  return (
    <NotificationProvider>
    <NotificationToastStack />
    <div className="app">
      <Sidebar
        activeSection={state.section}
        navigate={navigate}
        navUsers={store.navUsers}
        totalUsers={store.users.length}
        pendingAlerts={store.pendingAlerts}
        totalUnread={store.totalUnread}
        validCodesCount={validCodesCount}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={handleLogout}
      />

      <div className="main">
        <Topbar
          onMenuClick={() => setSidebarOpen(true)}
          onSearchGlobal={(v) => {
            if (v.length >= 2) {
              store.setSearch(v);
              store.setRoleFilter('all');
              store.setStatusFilter('all');
              store.setCountryFilter('all');
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
          <OverviewSection store={store} toast={toast} isActive={state.section === 'overview'} />
          <UsersSection    store={store} toast={toast} isActive={state.section === 'users'} />
          <AnalyticsSection store={store} isActive={state.section === 'analytics'} />
          <FinancesSection  store={store} isActive={state.section === 'finances'} />
          <PortefeuilleSection isActive={state.section === 'portefeuille'} />
          <InvitationsSection store={store} toast={toast} isActive={state.section === 'invitations'} />
          {state.section === 'messaging' && (
            <div className="section active" style={{ padding: 0, gap: 0 }}>
              <MessagerieCore />
            </div>
          )}
          <AlertsSection      store={store} toast={toast} isActive={state.section === 'alerts'} />
          <AuditSection       store={store} isActive={state.section === 'audit'} />
          <SystemSection      store={store} isActive={state.section === 'system'} />
          <SettingsSection    store={store} toast={toast} isActive={state.section === 'settings'} />
          <PermissionsSection store={store} toast={toast} isActive={state.section === 'permissions'} />
          <NotificationsAdminSection isActive={state.section === 'notifications-admin'} />
        </main>
      </div>

      {/* ── Modals ── */}
      {state.currentUser && (
        <UserModal store={store} toast={toast} />
      )}
      <NewMessageModal
        store={store}
        toast={toast}
        isOpen={newMsgOpen}
        onClose={() => setNewMsgOpen(false)}
      />

      {/* ── Toasts ── */}
      <ToastStack toasts={toasts} onRemove={removeToast} />
    </div>
    </NotificationProvider>
  );
}