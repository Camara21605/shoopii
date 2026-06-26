/* ================================================================
 * FICHIER : src/dashboards/super-admin/hooks/useSuperAdminState.ts
 * ================================================================ */

import { useState, useCallback, useEffect } from 'react';
import type {
  SuperAdminState, SectionId, UserRole, UserStatus, User,
  Alert, AuditEntry, Admin,
} from '../types/codes.types';
import {
  MOCK_CODES, MOCK_HEALTH, MOCK_CONVERSATIONS,
} from '../data/mockDB';
import {
  apiFetch, ApiError, tokenStorage,
} from '../../../shared/services/apiFetch';

/* ── Types API définis ici (pas d'import backend) ── */
export interface UserListItem {
  id:       string;
  name:     string;
  email:    string;
  role:     string;
  status:   string;
  country:  string;
  phone:    string;
  date:     string;
  verified: boolean;
}

export interface UserListResponse {
  data:  UserListItem[];
  total: number;
  page:  number;
  pages: number;
  limit: number;
}

/* BASE_URL partagée */
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

const INITIAL_STATE: SuperAdminState = {
  section:          (localStorage.getItem('shopi-super-admin-section') as SectionId) || 'overview',
  roleFilter:       'all',
  statusFilter:     'all',
  countryFilter:    'all',
  search:           '',
  page:             1,
  perPage:          20,
  codeQty:          1,
  codeFilter:       '',
  codeStatusFilter: 'all',
  codeRoleFilter:   'all',
  activeConvId:     null,
  convSearch:       '',
  currentUser:      null,
  theme: (localStorage.getItem('shopi-theme') as 'dark' | 'light') || 'dark',
};

export function useSuperAdminState() {
  const [state, setState] = useState<SuperAdminState>(INITIAL_STATE);

  /* ── États API utilisateurs ── */
  const [users,        setUsers]        = useState<UserListItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError,   setUsersError]   = useState<string | null>(null);
  const [usersTotal,   setUsersTotal]   = useState(0);
  const [usersPages,   setUsersPages]   = useState(1);

  /* ── Données encore en mock ── */
  const [codes,         setCodes]         = useState(MOCK_CODES);
  const [conversations, setConversations] = useState(MOCK_CONVERSATIONS);
  const healthData = MOCK_HEALTH;

  /* ── États API signalements (alertes) ── */
  const [alerts,      setAlerts]      = useState<Alert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError,   setAlertsError]   = useState<string | null>(null);

  /* ── États API journal d'audit ── */
  const [auditLog,      setAuditLog]      = useState<AuditEntry[]>([]);
  const [auditLoading,  setAuditLoading]  = useState(false);
  const [auditError,    setAuditError]    = useState<string | null>(null);

  /* ── États API admins / permissions ── */
  const [admins,        setAdmins]        = useState<Admin[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminsError,   setAdminsError]   = useState<string | null>(null);

  /* ── Charger les signalements depuis l'API ── */
  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true);
    setAlertsError(null);
    try {
      const data = await apiFetch<Alert[]>('/dashboard/super-admin/alerts', { method: 'GET' });
      setAlerts(data);
    } catch (err) {
      setAlertsError(err instanceof ApiError ? err.message : 'Erreur de connexion au serveur.');
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  /* ── Charger le journal d'audit depuis l'API ── */
  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const data = await apiFetch<AuditEntry[]>('/dashboard/super-admin/audit', { method: 'GET' });
      setAuditLog(data);
    } catch (err) {
      setAuditError(err instanceof ApiError ? err.message : 'Erreur de connexion au serveur.');
    } finally {
      setAuditLoading(false);
    }
  }, []);

  /* ── Charger les comptes admin / permissions depuis l'API ── */
  const loadAdmins = useCallback(async () => {
    setAdminsLoading(true);
    setAdminsError(null);
    try {
      const data = await apiFetch<Admin[]>('/dashboard/super-admin/admins', { method: 'GET' });
      setAdmins(data);
    } catch (err) {
      setAdminsError(err instanceof ApiError ? err.message : 'Erreur de connexion au serveur.');
    } finally {
      setAdminsLoading(false);
    }
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);
  useEffect(() => { loadAudit(); }, [loadAudit]);
  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  /* ── Charger les utilisateurs depuis l'API ── */
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const data = await apiFetch<UserListResponse>(
        '/dashboard/super-admin/users',
        {
          method: 'GET',
          params: {
            page:    state.page,
            limit:   state.perPage,
            role:    state.roleFilter    !== 'all' ? state.roleFilter    : undefined,
            status:  state.statusFilter  !== 'all' ? state.statusFilter  : undefined,
            country: state.countryFilter !== 'all' ? state.countryFilter : undefined,
            search:  state.search        || undefined,
          },
        },
      );
      setUsers(data.data);
      setUsersTotal(data.total);
      setUsersPages(data.pages);
    } catch (err) {
      setUsersError(
        err instanceof ApiError ? err.message : 'Erreur de connexion au serveur.',
      );
    } finally {
      setUsersLoading(false);
    }
  }, [
    state.page, state.perPage,
    state.roleFilter, state.statusFilter,
    state.countryFilter, state.search,
  ]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  /* ── Thème ── */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('shopi-theme', state.theme);
  }, [state.theme]);

  /* ── Section active (persistée pour survivre à un rechargement) ── */
  useEffect(() => {
    localStorage.setItem('shopi-super-admin-section', state.section);
  }, [state.section]);

  const toggleTheme = useCallback(() => {
    setState(s => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }));
  }, []);

  /* ── Navigation ── */
  const navigate = useCallback((section: SectionId) => {
    setState(s => ({ ...s, section }));
  }, []);

  const navUsers = useCallback((role: UserRole | 'all') => {
    setState(s => ({ ...s, section: 'users', roleFilter: role, page: 1 }));
  }, []);

  /* ── Filtres ── */
  const setSearch = useCallback((v: string) => {
    setState(s => ({ ...s, search: v, page: 1 }));
  }, []);

  const setRoleFilter = useCallback((role: UserRole | 'all') => {
    setState(s => ({ ...s, roleFilter: role, page: 1 }));
  }, []);

  const setStatusFilter = useCallback((status: UserStatus | 'all') => {
    setState(s => ({ ...s, statusFilter: status, page: 1 }));
  }, []);

  const setCountryFilter = useCallback((country: string) => {
    setState(s => ({ ...s, countryFilter: country, page: 1 }));
  }, []);

  const goPage = useCallback((p: number) => {
    setState(s => ({ ...s, page: p }));
  }, []);

  /* ── Modal ── */
  const openUserModal = useCallback((user: User) => {
    setState(s => ({ ...s, currentUser: user }));
  }, []);

  const closeUserModal = useCallback(() => {
    setState(s => ({ ...s, currentUser: null }));
  }, []);

  /* ── Bloquer / Débloquer ── */
  const toggleBlockUser = useCallback(async (id: string) => {
    const data = await apiFetch<{ message: string; status: string }>(
      `/dashboard/super-admin/users/${id}/block`,
      { method: 'PATCH' },
    );
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: data.status } : u));
  }, []);

  /* ── Suspendre ── */
  const suspendUser = useCallback(async (id: string, raison?: string) => {
    await apiFetch<{ message: string }>(
      `/dashboard/super-admin/users/${id}/suspend`,
      { method: 'PATCH', body: { raison } },
    );
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'suspended' } : u));
  }, []);

  /* ── Vérifier ── */
  const verifyUser = useCallback(async (id: string) => {
    await apiFetch<{ message: string }>(
      `/dashboard/super-admin/users/${id}/verify`,
      { method: 'PATCH' },
    );
    setUsers(prev => prev.map(u => u.id === id ? { ...u, verified: true } : u));
  }, []);

  /* ── Supprimer (soft delete) ── */
  const deleteUser = useCallback(async (id: string) => {
    await apiFetch<{ message: string }>(
      `/dashboard/super-admin/users/${id}`,
      { method: 'DELETE' },
    );
    setUsers(prev => prev.filter(u => u.id !== id));
    setState(s => ({ ...s, currentUser: null }));
    setUsersTotal(t => Math.max(0, t - 1));
  }, []);

  /* ── Export CSV ── */
  const exportUsers = useCallback(async () => {
    const params = new URLSearchParams();
    if (state.roleFilter    !== 'all') params.set('role',    state.roleFilter);
    if (state.statusFilter  !== 'all') params.set('status',  state.statusFilter);
    if (state.countryFilter !== 'all') params.set('country', state.countryFilter);
    if (state.search)                  params.set('search',  state.search);

    const res = await fetch(
      `${BASE_URL}/dashboard/super-admin/users/export?${params}`,
      { headers: { Authorization: `Bearer ${tokenStorage.get() ?? ''}` } },
    );
    if (!res.ok) throw new Error('Export échoué');

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `shopi-utilisateurs-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.roleFilter, state.statusFilter, state.countryFilter, state.search]);

  /* ── Codes (mock) ── */
  const setCodeQty          = useCallback((qty: number) => setState(s => ({ ...s, codeQty: Math.max(1, Math.min(40, qty)) })), []);
  const setCodeFilter       = useCallback((v: string)   => setState(s => ({ ...s, codeFilter: v })), []);
  const setCodeStatusFilter = useCallback((v: string)   => setState(s => ({ ...s, codeStatusFilter: v })), []);
  const setCodeRoleFilter   = useCallback((v: string)   => setState(s => ({ ...s, codeRoleFilter: v })), []);

  const generateCodes = useCallback(
    (role: string, expiry: string, maxUses: number, note: string) => {
      const prefixes: Record<string, string> = {
        company: 'ENT', delivery: 'LIV', partner: 'PAR', correspondent: 'COR', admin: 'ADM',
      };
      const now = new Date().toISOString().slice(0, 10);
      const newCodes = Array.from({ length: state.codeQty }, (_, i) => ({
        id:      `CODE-${Date.now()}-${i}`,
        value:   `SHOPI-${new Date().getFullYear()}-${prefixes[role] || 'GEN'}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        role:    role as UserRole,
        status:  'valid' as const,
        created: now, expires: expiry || '2025-12-31',
        uses: 0, maxUses, note,
      }));
      setCodes(prev => [...newCodes, ...prev]);
    },
    [state.codeQty],
  );

  const revokeCode = useCallback((id: string) => {
    setCodes(prev => prev.map(c => c.id === id ? { ...c, status: 'revoked' as const } : c));
  }, []);

  /* ── Alertes ── */
  const resolveAlert = useCallback(async (id: string) => {
    await apiFetch<{ message: string }>(
      `/dashboard/super-admin/alerts/${id}/resolve`,
      { method: 'PATCH' },
    );
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a));
  }, []);

  /* ── Messagerie ── */
  const setActiveConv = useCallback((id: number | null) => {
    setState(s => ({ ...s, activeConvId: id }));
    if (id !== null) setConversations(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c));
  }, []);

  const setConvSearch = useCallback((v: string) => setState(s => ({ ...s, convSearch: v })), []);

  const sendMessage = useCallback((convId: number, text: string) => {
    setConversations(prev => prev.map(c =>
      c.id === convId
        ? { ...c, messages: [...c.messages, { from: 'admin', text, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }] }
        : c,
    ));
  }, []);

  /* ── Permissions admin ── */
  const toggleAdminPerm = useCallback(async (email: string, perm: string, val: boolean) => {
    await apiFetch<{ message: string; perms: Record<string, boolean> }>(
      `/dashboard/super-admin/admins/${encodeURIComponent(email)}/permissions`,
      { method: 'PATCH', body: { perm, value: val } },
    );
    setAdmins(prev => prev.map(a => a.email === email ? { ...a, perms: { ...a.perms, [perm]: val } } : a));
  }, []);

  const totalUnread   = conversations.reduce((sum, c) => sum + c.unread, 0);
  const pendingAlerts = alerts.filter(a => !a.resolved).length;

  return {
    state,
    users, usersTotal, usersPages, usersLoading, usersError,
    reloadUsers: loadUsers,
    admins, adminsLoading, adminsError, reloadAdmins: loadAdmins,
    codes,
    alerts, alertsLoading, alertsError, reloadAlerts: loadAlerts,
    conversations,
    auditLog, auditLoading, auditError, reloadAudit: loadAudit,
    healthData,
    totalUnread, pendingAlerts,
    navigate, navUsers, toggleTheme,
    setSearch, setRoleFilter, setStatusFilter, setCountryFilter, goPage,
    openUserModal, closeUserModal,
    toggleBlockUser, suspendUser, verifyUser, deleteUser, exportUsers,
    setCodeQty, setCodeFilter, setCodeStatusFilter, setCodeRoleFilter,
    generateCodes, revokeCode,
    resolveAlert,
    setActiveConv, setConvSearch, sendMessage,
    toggleAdminPerm,
  };
}

export type SuperAdminStore = ReturnType<typeof useSuperAdminState>;