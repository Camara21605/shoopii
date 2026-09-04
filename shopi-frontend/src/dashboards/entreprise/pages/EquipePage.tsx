/*
 * FICHIER : src/dashboards/entreprise/pages/EquipePage.tsx
 * PAGE    : Gestion de l'équipe entreprise – Workspace Collaboratif
 *
 * FONCTIONNALITÉS :
 *   - Statistiques équipe avec plan actif et limite dynamique
 *   - Onglet Membres : liste, statut, permissions, actions rapides
 *   - Onglet Invitations : envoyer / renvoyer / annuler
 *   - Modifier les permissions avec éditeur par groupe (panneau latéral)
 *   - Appliquer un modèle de permissions (template)
 *   - Suspendre / Réactiver / Supprimer un membre
 *   - Réinitialiser le mot de passe (MDP temporaire affiché une fois)
 *   - Journal d'activité par membre
 *
 * DONNÉES : 100 % backend – zéro mock.
 *
 * AUTEUR  : Shopi03
 * DATE    : 2026-07-18
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { apiFetch } from '../../../shared/services/apiFetch';
import { useToast } from '../../../shared/context/ToastContext';
import './EquipePage.css';

/* ══════════════════════════════════════════════════════════════
 * TYPES
 * ══════════════════════════════════════════════════════════════ */

interface TeamStats {
  activeCount:    number;
  suspendedCount: number;
  totalCount:     number;
  maxAllowed:     number;
  canAddMore:     boolean;
  remainingSlots: number;
}

interface PlanInfo {
  plan:       string;
  name:       string;
  maxMembers: number;
}

interface TeamMember {
  id:                 string;
  userId:             string;
  status:             'active' | 'suspended' | 'pending' | 'revoked';
  firstName:          string;
  lastName:           string;
  email:              string;
  phone?:             string | null;
  jobTitle?:          string | null;
  internalRole?:      string | null;
  lastLoginAt?:       string | null;
  mustChangePassword: boolean;
  suspensionReason?:  string | null;
  createdAt:          string;
  permissions?:       Record<string, Record<string, boolean>> | null;
  profilePicture?:    string | null;
}

interface PaginatedMembers {
  items:      TeamMember[];
  total:      number;
  page:       number;
  totalPages: number;
}

interface InvitationEntry {
  id:         string;
  email:      string;
  firstName?: string | null;
  lastName?:  string | null;
  jobTitle?:  string | null;
  status:     'pending' | 'accepted' | 'expired' | 'cancelled';
  expiresAt:  string;
  createdAt:  string;
}

interface PermissionTemplate {
  id:           string;
  name:         string;
  description?: string;
  isSystem:     boolean;
  permissions:  Record<string, Record<string, boolean>>;
}

interface ActivityEntry {
  id:          string;
  action:      string;
  description: string | null;
  createdAt:   string;
}

/* ══════════════════════════════════════════════════════════════
 * GROUPES DE PERMISSIONS
 * Utilisé par l'éditeur de permissions latéral.
 * Le schéma dynamique (/company-team/permission-schema) peut enrichir
 * cette liste sans modifier ce fichier.
 * ══════════════════════════════════════════════════════════════ */

function getPermissionGroups(t: TFunction) {
  return [
    { key: 'products',   label: t('equipe.permGroups.products.label'),   icon: 'fa-tag',
      actions: [{ key: 'view', label: t('equipe.permGroups.products.view') }, { key: 'create', label: t('equipe.permGroups.products.create') },
                { key: 'edit', label: t('equipe.permGroups.products.edit') }, { key: 'delete', label: t('equipe.permGroups.products.delete') }] },
    { key: 'orders',     label: t('equipe.permGroups.orders.label'),     icon: 'fa-box',
      actions: [{ key: 'view', label: t('equipe.permGroups.orders.view') }, { key: 'validate', label: t('equipe.permGroups.orders.validate') },
                { key: 'cancel', label: t('equipe.permGroups.orders.cancel') }, { key: 'edit', label: t('equipe.permGroups.orders.edit') }] },
    { key: 'deliveries', label: t('equipe.permGroups.deliveries.label'), icon: 'fa-motorcycle',
      actions: [{ key: 'view', label: t('equipe.permGroups.deliveries.view') }, { key: 'assign', label: t('equipe.permGroups.deliveries.assign') },
                { key: 'edit', label: t('equipe.permGroups.deliveries.edit') }] },
    { key: 'payments',   label: t('equipe.permGroups.payments.label'),   icon: 'fa-coins',
      actions: [{ key: 'view', label: t('equipe.permGroups.payments.view') }, { key: 'viewTransactions', label: t('equipe.permGroups.payments.viewTransactions') },
                { key: 'manageRefunds', label: t('equipe.permGroups.payments.manageRefunds') }] },
    { key: 'messaging',  label: t('equipe.permGroups.messaging.label'),  icon: 'fa-comment',
      actions: [{ key: 'read', label: t('equipe.permGroups.messaging.read') }, { key: 'send', label: t('equipe.permGroups.messaging.send') }] },
    { key: 'statistics', label: t('equipe.permGroups.statistics.label'), icon: 'fa-chart-line',
      actions: [{ key: 'view', label: t('equipe.permGroups.statistics.view') }] },
    { key: 'settings',   label: t('equipe.permGroups.settings.label'),   icon: 'fa-gear',
      actions: [{ key: 'view', label: t('equipe.permGroups.settings.view') }, { key: 'edit', label: t('equipe.permGroups.settings.edit') }] },
    { key: 'returns',    label: t('equipe.permGroups.returns.label'),    icon: 'fa-rotate-left',
      actions: [{ key: 'view', label: t('equipe.permGroups.returns.view') }, { key: 'process', label: t('equipe.permGroups.returns.process') }] },
    { key: 'wallet',     label: t('equipe.permGroups.wallet.label'),    icon: 'fa-wallet',
      actions: [{ key: 'view', label: t('equipe.permGroups.wallet.view') }, { key: 'withdraw', label: t('equipe.permGroups.wallet.withdraw') }] },
    { key: 'fournisseurs', label: t('equipe.permGroups.fournisseurs.label'), icon: 'fa-industry',
      actions: [{ key: 'view', label: t('equipe.permGroups.fournisseurs.view') }, { key: 'connect', label: t('equipe.permGroups.fournisseurs.connect') },
                { key: 'disconnect', label: t('equipe.permGroups.fournisseurs.disconnect') }] },
    { key: 'boutique', label: t('equipe.permGroups.boutique.label'), icon: 'fa-store',
      actions: [{ key: 'view', label: t('equipe.permGroups.boutique.view') }, { key: 'edit', label: t('equipe.permGroups.boutique.edit') }] },
  ] as const;
}

/* ══════════════════════════════════════════════════════════════
 * HELPERS
 * ══════════════════════════════════════════════════════════════ */

function initials(m: TeamMember) {
  return `${m.firstName?.[0] ?? ''}${m.lastName?.[0] ?? ''}`.toUpperCase();
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function statusLabel(s: TeamMember['status'], t: TFunction) {
  const map = {
    active:    { label: t('equipe.status.active'),    cls: 'st-active'    },
    suspended: { label: t('equipe.status.suspended'), cls: 'st-suspended' },
    pending:   { label: t('equipe.status.pending'),   cls: 'st-pending'   },
    revoked:   { label: t('equipe.status.revoked'),   cls: 'st-revoked'   },
  };
  return map[s] ?? map.revoked;
}

/* ══════════════════════════════════════════════════════════════
 * COMPOSANT PRINCIPAL
 * ══════════════════════════════════════════════════════════════ */

export default function EquipePage() {
  const { pop } = useToast();
  const { t } = useTranslation();
  const PERMISSION_GROUPS = getPermissionGroups(t);

  /* ── Onglets ── */
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');

  /* ── Données ── */
  const [stats,       setStats]       = useState<TeamStats | null>(null);
  const [planInfo,    setPlanInfo]    = useState<PlanInfo | null>(null);
  const [members,     setMembers]     = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<InvitationEntry[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [loading,     setLoading]     = useState(true);

  /* ── Modales / panneaux ── */
  const [showAdd,     setShowAdd]     = useState(false);
  const [permTarget,  setPermTarget]  = useState<TeamMember | null>(null);
  const [permState,   setPermState]   = useState<Record<string, Record<string, boolean>>>({});
  const [savingPerm,  setSavingPerm]  = useState(false);
  const [activityTarget, setActivityTarget] = useState<TeamMember | null>(null);
  const [activity,    setActivity]    = useState<ActivityEntry[]>([]);
  const [tempPwd,     setTempPwd]     = useState<{ name: string; pwd: string; kind: 'password' | 'inviteLink' } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string; message: string; action: () => Promise<void>;
  } | null>(null);

  /* ── Chargement ── */

  const loadStats = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        apiFetch<TeamStats>('/company-team/stats'),
        apiFetch<PlanInfo>('/company-team/plan').catch(() => null),
      ]);
      setStats(s);
      if (p) setPlanInfo(p);
    } catch { /* silencieux */ }
  }, []);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const res = await apiFetch<PaginatedMembers>(`/company-team/members?${params}`);
      setMembers(res.items);
      setTotal(res.total);
    } catch {
      pop(t('equipe.toast.loadMembersError'), 'e');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  const loadInvitations = useCallback(async () => {
    try {
      const res = await apiFetch<InvitationEntry[]>('/company-team/invitations');
      setInvitations(res);
    } catch { /* silencieux */ }
  }, []);

  useEffect(() => { loadStats(); },       [loadStats]);
  useEffect(() => { loadMembers(); },     [loadMembers]);
  useEffect(() => { loadInvitations(); }, [loadInvitations]);

  /* ── Actions membres ── */

  const handleSuspend = (m: TeamMember) => {
    setConfirmAction({
      title:   t('equipe.confirm.suspendTitle', { name: `${m.firstName} ${m.lastName}` }),
      message: t('equipe.confirm.suspendMessage', { firstName: m.firstName }),
      action:  async () => {
        await apiFetch(`/company-team/members/${m.id}/suspend`, { method: 'POST', body: {} });
        pop(t('equipe.toast.suspended', { name: m.firstName }), 's');
        loadStats(); loadMembers();
      },
    });
  };

  const handleReactivate = async (m: TeamMember) => {
    try {
      await apiFetch(`/company-team/members/${m.id}/reactivate`, { method: 'POST' });
      pop(t('equipe.toast.reactivated', { name: m.firstName }), 's');
      loadStats(); loadMembers();
    } catch (err: any) {
      pop(err.message ?? t('equipe.toast.reactivateError'), 'e');
    }
  };

  const handleDelete = (m: TeamMember) => {
    setConfirmAction({
      title:   t('equipe.confirm.deleteTitle', { name: `${m.firstName} ${m.lastName}` }),
      message: t('equipe.confirm.deleteMessage', { firstName: m.firstName }),
      action:  async () => {
        await apiFetch(`/company-team/members/${m.id}`, { method: 'DELETE' });
        pop(t('equipe.toast.deleted', { name: m.firstName }), 's');
        loadStats(); loadMembers();
      },
    });
  };

  const handleResetPassword = async (m: TeamMember) => {
    try {
      const res = await apiFetch<{ temporaryPassword: string }>(
        `/company-team/members/${m.id}/reset-password`, { method: 'POST' },
      );
      setTempPwd({ name: `${m.firstName} ${m.lastName}`, pwd: res.temporaryPassword });
    } catch (err: any) {
      pop(err.message ?? t('equipe.toast.resetPasswordError'), 'e');
    }
  };

  const openPermissions = (m: TeamMember) => {
    setPermTarget(m);
    setPermState(m.permissions ? JSON.parse(JSON.stringify(m.permissions)) : {});
  };

  /* Ferme le panneau et resynchronise la liste des membres (badges de
   * permissions affichés sur chaque ligne) — un seul appel réseau à la
   * fermeture plutôt qu'à chaque case cochée (voir toggleAction), pour ne
   * pas spammer /company-team/members pendant une session de clics rapides. */
  const closePermPanel = () => {
    setPermTarget(null);
    loadMembers();
  };

  /* Enregistre CHAQUE case cochée/décochée immédiatement — plus de bouton
   * "Enregistrer" à cliquer séparément (voir le footer du panneau plus
   * bas). Optimiste : la case bascule tout de suite, annulée si le PATCH
   * échoue. N'envoie que le champ modifié (deep merge côté backend, voir
   * CompanyTeamPermissionService.update) plutôt que tout permState — évite
   * qu'un envoi en échouerait un autre écrase une case cochée entre-temps
   * par un clic suivant. */
  const toggleAction = async (groupKey: string, actionKey: string, value: boolean) => {
    if (!permTarget) return;
    const prevValue = permState[groupKey]?.[actionKey] ?? false;

    setPermState(prev => ({
      ...prev,
      [groupKey]: { ...(prev[groupKey] ?? {}), [actionKey]: value },
    }));
    setSavingPerm(true);
    try {
      await apiFetch(`/company-team/members/${permTarget.id}/permissions`, {
        method: 'PATCH',
        body:   { permissions: { [groupKey]: { [actionKey]: value } } },
      });
    } catch (err: any) {
      setPermState(prev => ({
        ...prev,
        [groupKey]: { ...(prev[groupKey] ?? {}), [actionKey]: prevValue },
      }));
      pop(err.message ?? t('equipe.toast.permissionsUpdateError'), 'e');
    } finally {
      setSavingPerm(false);
    }
  };

  const openActivity = async (m: TeamMember) => {
    setActivityTarget(m);
    try {
      const res = await apiFetch<{ items: ActivityEntry[] }>(
        `/company-team/members/${m.id}/activity?limit=30`,
      );
      setActivity(res.items);
    } catch {
      setActivity([]);
    }
  };

  /* ── Actions invitations ── */

  const handleResendInvitation = async (inv: InvitationEntry) => {
    try {
      await apiFetch(`/company-team/invitations/${inv.id}/resend`, { method: 'POST' });
      pop(t('equipe.toast.invitationResent'), 's');
      loadInvitations();
    } catch (err: any) {
      pop(err.message ?? t('equipe.toast.genericError'), 'e');
    }
  };

  const handleCancelInvitation = (inv: InvitationEntry) => {
    setConfirmAction({
      title:   t('equipe.confirm.cancelInviteTitle', { email: inv.email }),
      message: t('equipe.confirm.cancelInviteMessage', { email: inv.email }),
      action:  async () => {
        await apiFetch(`/company-team/invitations/${inv.id}`, { method: 'DELETE' });
        pop(t('equipe.toast.invitationCancelled'), 's');
        loadInvitations();
      },
    });
  };

  /* ══════════════════════════════════════════════════════════════
   * RENDU
   * ══════════════════════════════════════════════════════════════ */

  return (
    <div className="eq-page">

      {/* ── En-tête ── */}
      <div className="eq-header">
        <div>
          <h1 className="eq-title">
            <i className="fas fa-users-gear" /> {t('equipe.title')}
          </h1>
          <p className="eq-sub">{t('equipe.subtitle')}</p>
        </div>
        {stats?.canAddMore && (
          <button className="eq-btn-add" onClick={() => setShowAdd(true)}>
            <i className="fas fa-user-plus" /> {t('equipe.addMember')}
          </button>
        )}
      </div>

      {/* ── Stats ── */}
      {stats && (
        <div className="eq-stats">
          <div className="eq-stat">
            <div className="eq-stat-val">{stats.activeCount}</div>
            <div className="eq-stat-lbl">{t('equipe.stats.activeMembers')}</div>
          </div>
          <div className="eq-stat eq-stat-max">
            <div className="eq-stat-val">
              {stats.activeCount}
              <span>/{stats.maxAllowed === Infinity ? '∞' : stats.maxAllowed}</span>
            </div>
            <div className="eq-stat-lbl">{t('equipe.stats.slotsUsed')}</div>
            <div className="eq-stat-bar">
              <div
                className="eq-stat-fill"
                style={{
                  width: stats.maxAllowed === Infinity
                    ? '10%'
                    : `${Math.min(100, (stats.activeCount / stats.maxAllowed) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="eq-stat">
            <div className="eq-stat-val eq-suspended">{stats.suspendedCount}</div>
            <div className="eq-stat-lbl">{t('equipe.stats.suspended')}</div>
          </div>
          <div className="eq-stat">
            <div className="eq-stat-val eq-green">
              {stats.maxAllowed === Infinity ? '∞' : stats.remainingSlots}
            </div>
            <div className="eq-stat-lbl">{t('equipe.stats.remainingSlots')}</div>
          </div>
          {planInfo && (
            <div className="eq-stat eq-stat-plan">
              <div className="eq-plan-badge">{planInfo.name}</div>
              <div className="eq-stat-lbl">{t('equipe.stats.activePlan')}</div>
            </div>
          )}
        </div>
      )}

      {/* ── Onglets ── */}
      <div className="eq-tabs">
        <button
          className={`eq-tab${activeTab === 'members' ? ' eq-tab-on' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          <i className="fas fa-users" /> {t('equipe.tabs.members')}
          {stats && stats.activeCount > 0 && (
            <span className="eq-tab-badge">{stats.activeCount}</span>
          )}
        </button>
        <button
          className={`eq-tab${activeTab === 'invitations' ? ' eq-tab-on' : ''}`}
          onClick={() => setActiveTab('invitations')}
        >
          <i className="fas fa-envelope-open-text" /> {t('equipe.tabs.invitations')}
          {invitations.length > 0 && (
            <span className="eq-tab-badge eq-tab-badge-warn">{invitations.length}</span>
          )}
        </button>
      </div>

      {/* ══════════════════════════════════════════════
       * ONGLET — MEMBRES
       * ══════════════════════════════════════════════ */}
      {activeTab === 'members' && (
        <>
          {/* Barre de recherche */}
          <div className="eq-toolbar">
            <div className="eq-search">
              <i className="fas fa-search" />
              <input
                type="text"
                placeholder={t('equipe.toolbar.searchPlaceholder')}
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <span className="eq-count">{t('equipe.toolbar.count', { count: total })}</span>
          </div>

          {/* Tableau */}
          <div className="eq-table-wrap">
            {loading ? (
              <div className="eq-loading">
                <i className="fas fa-circle-notch fa-spin" /> {t('equipe.loading')}
              </div>
            ) : members.length === 0 ? (
              <div className="eq-empty">
                <i className="fas fa-users-slash" />
                <p>{t('equipe.empty.membersTitle')}</p>
                <p className="eq-empty-sub">
                  {t('equipe.empty.membersSub')}
                </p>
              </div>
            ) : (
              <table className="eq-table">
                <thead>
                  <tr>
                    <th>{t('equipe.table.member')}</th>
                    <th>{t('equipe.table.jobRole')}</th>
                    <th>{t('equipe.table.status')}</th>
                    <th>{t('equipe.table.lastLogin')}</th>
                    <th>{t('equipe.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => {
                    const st = statusLabel(m.status, t);
                    return (
                      <tr key={m.id}>
                        <td>
                          <div className="eq-member">
                            <div className="eq-avatar">
                              {m.profilePicture
                                ? <img src={m.profilePicture} alt="" />
                                : <span>{initials(m)}</span>
                              }
                              <span className={`eq-dot eq-dot-${m.status}`} />
                            </div>
                            <div>
                              <div className="eq-nm">{m.firstName} {m.lastName}</div>
                              <div className="eq-email">{m.email}</div>
                              {m.mustChangePassword && (
                                <span className="eq-tag-pwd">{t('equipe.mustChangePassword')}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="eq-job">{m.jobTitle ?? '—'}</div>
                          {m.internalRole && (
                            <div className="eq-role-chip">{m.internalRole}</div>
                          )}
                        </td>
                        <td>
                          <span className={`eq-status ${st.cls}`}>{st.label}</span>
                          {m.suspensionReason && (
                            <div className="eq-reason" title={m.suspensionReason}>
                              {m.suspensionReason.slice(0, 30)}
                              {m.suspensionReason.length > 30 ? '…' : ''}
                            </div>
                          )}
                        </td>
                        <td className="eq-login">{formatDate(m.lastLoginAt)}</td>
                        <td>
                          <div className="eq-actions">
                            <button
                              className="eq-act eq-act-perm"
                              title={t('equipe.actions.editPermissions')}
                              onClick={() => openPermissions(m)}
                            >
                              <i className="fas fa-shield-halved" />
                            </button>
                            <button
                              className="eq-act"
                              title={t('equipe.actions.activityLog')}
                              onClick={() => openActivity(m)}
                            >
                              <i className="fas fa-clock-rotate-left" />
                            </button>
                            <button
                              className="eq-act"
                              title={t('equipe.actions.resetPassword')}
                              onClick={() => handleResetPassword(m)}
                            >
                              <i className="fas fa-key" />
                            </button>
                            {m.status === 'active' ? (
                              <button
                                className="eq-act eq-act-warn"
                                title={t('equipe.actions.suspend')}
                                onClick={() => handleSuspend(m)}
                              >
                                <i className="fas fa-ban" />
                              </button>
                            ) : m.status === 'suspended' ? (
                              <button
                                className="eq-act eq-act-ok"
                                title={t('equipe.actions.reactivate')}
                                onClick={() => handleReactivate(m)}
                              >
                                <i className="fas fa-circle-check" />
                              </button>
                            ) : null}
                            <button
                              className="eq-act eq-act-danger"
                              title={t('equipe.actions.deleteAccess')}
                              onClick={() => handleDelete(m)}
                            >
                              <i className="fas fa-trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {total > 20 && (
            <div className="eq-pagination">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <i className="fas fa-chevron-left" />
              </button>
              <span>{t('equipe.pagination.pageOf', { page, total: Math.ceil(total / 20) })}</span>
              <button
                disabled={page >= Math.ceil(total / 20)}
                onClick={() => setPage(p => p + 1)}
              >
                <i className="fas fa-chevron-right" />
              </button>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════
       * ONGLET — INVITATIONS
       * ══════════════════════════════════════════════ */}
      {activeTab === 'invitations' && (
        <div className="eq-inv-section">
          <div className="eq-inv-header">
            <span className="eq-inv-title">{t('equipe.invitations.pendingTitle')}</span>
            <button className="eq-btn-add" onClick={() => setShowAdd(true)}>
              <i className="fas fa-envelope" /> {t('equipe.invitations.send')}
            </button>
          </div>
          {invitations.length === 0 ? (
            <div className="eq-empty">
              <i className="fas fa-envelope-open" />
              <p>{t('equipe.empty.invitationsTitle')}</p>
              <p className="eq-empty-sub">
                {t('equipe.empty.invitationsSub')}
              </p>
            </div>
          ) : (
            <div className="eq-inv-list">
              {invitations.map(inv => (
                <div key={inv.id} className="eq-inv-card">
                  <div className="eq-inv-avatar">
                    {(inv.firstName?.[0] ?? inv.email[0]).toUpperCase()}
                  </div>
                  <div className="eq-inv-info">
                    <div className="eq-inv-name">
                      {inv.firstName && inv.lastName
                        ? `${inv.firstName} ${inv.lastName}`
                        : inv.email}
                    </div>
                    <div className="eq-inv-email">{inv.email}</div>
                    {inv.jobTitle && <div className="eq-inv-job">{inv.jobTitle}</div>}
                    <div className="eq-inv-expires">
                      {t('equipe.invitations.expiresOn', { date: formatDate(inv.expiresAt) })}
                    </div>
                  </div>
                  <div className="eq-inv-actions">
                    <button
                      className="eq-act"
                      title={t('equipe.invitations.resend')}
                      onClick={() => handleResendInvitation(inv)}
                    >
                      <i className="fas fa-paper-plane" />
                    </button>
                    <button
                      className="eq-act eq-act-danger"
                      title={t('equipe.invitations.cancel')}
                      onClick={() => handleCancelInvitation(inv)}
                    >
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════
       * MODALE — Ajouter un membre
       * ══════════════════════════════════════════════ */}
      {showAdd && (
        <AddMemberModal
          onClose={() => setShowAdd(false)}
          onSuccess={(name, pwdOrLink, kind) => {
            setShowAdd(false);
            setTempPwd({ name, pwd: pwdOrLink, kind });
            loadStats();
            loadMembers();
            loadInvitations();
          }}
        />
      )}

      {/* ══════════════════════════════════════════════
       * PANNEAU — Permissions
       * ══════════════════════════════════════════════ */}
      {permTarget && (
        <div className="eq-overlay" onClick={closePermPanel}>
          <div className="eq-panel" onClick={e => e.stopPropagation()}>
            <div className="eq-panel-header">
              <div>
                <div className="eq-panel-title">
                  <i className="fas fa-shield-halved" /> {t('equipe.permPanel.title')}
                </div>
                <div className="eq-panel-sub">
                  {permTarget.firstName} {permTarget.lastName}
                  {savingPerm && <i className="fas fa-circle-notch fa-spin" style={{ marginLeft: 8 }} />}
                </div>
              </div>
              <button className="eq-close" onClick={closePermPanel}>
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className="eq-panel-body">
              {/* Chaque case s'enregistre immédiatement au clic — voir toggleAction */}
              {PERMISSION_GROUPS.map(group => (
                <div key={group.key} className="eq-perm-group">
                  <div className="eq-perm-group-title">
                    <i className={`fas ${group.icon}`} /> {group.label}
                  </div>
                  <div className="eq-perm-actions">
                    {group.actions.map(action => {
                      const checked = permState[group.key]?.[action.key] ?? false;
                      return (
                        <label key={action.key} className="eq-perm-toggle">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => toggleAction(group.key, action.key, e.target.checked)}
                          />
                          <span className="eq-perm-slider" />
                          <span className="eq-perm-label">{action.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="eq-panel-footer">
              <button className="eq-btn-save" onClick={closePermPanel}>
                {t('equipe.permPanel.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
       * PANNEAU — Activité
       * ══════════════════════════════════════════════ */}
      {activityTarget && (
        <div className="eq-overlay" onClick={() => setActivityTarget(null)}>
          <div className="eq-panel" onClick={e => e.stopPropagation()}>
            <div className="eq-panel-header">
              <div>
                <div className="eq-panel-title">
                  <i className="fas fa-clock-rotate-left" /> {t('equipe.activityPanel.title')}
                </div>
                <div className="eq-panel-sub">
                  {activityTarget.firstName} {activityTarget.lastName}
                </div>
              </div>
              <button className="eq-close" onClick={() => setActivityTarget(null)}>
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className="eq-panel-body">
              {activity.length === 0 ? (
                <div className="eq-empty-activity">
                  {t('equipe.activityPanel.empty')}
                </div>
              ) : (
                <ul className="eq-activity-list">
                  {activity.map(a => (
                    <li key={a.id} className="eq-activity-item">
                      <div className="eq-activity-action">{a.action}</div>
                      {a.description && (
                        <div className="eq-activity-desc">{a.description}</div>
                      )}
                      <div className="eq-activity-date">{formatDate(a.createdAt)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
       * MODALE — Mot de passe temporaire
       * ══════════════════════════════════════════════ */}
      {tempPwd && (
        <div className="eq-overlay" onClick={() => setTempPwd(null)}>
          <div className="eq-modal eq-modal-pwd" onClick={e => e.stopPropagation()}>
            {tempPwd.kind === 'inviteLink' ? (
              <>
                <div className="eq-modal-icon eq-modal-icon-key">
                  <i className="fas fa-link" />
                </div>
                <h3>{t('equipe.inviteLinkModal.title')}</h3>
                <p>
                  {t('equipe.inviteLinkModal.transmitPrefix')} <strong>{tempPwd.name}</strong>.<br />
                  {t('equipe.inviteLinkModal.instructions')}
                </p>
                <div className="eq-pwd-box">
                  <span className="eq-pwd-val" style={{ fontSize: 12, wordBreak: 'break-all' }}>{tempPwd.pwd}</span>
                  <button
                    className="eq-pwd-copy"
                    onClick={() => {
                      navigator.clipboard.writeText(tempPwd.pwd);
                      pop(t('equipe.toast.passwordCopied'), 's');
                    }}
                  >
                    <i className="fas fa-copy" />
                  </button>
                </div>
                <p className="eq-pwd-warn">
                  <i className="fas fa-triangle-exclamation" />
                  {t('equipe.inviteLinkModal.warn')}
                </p>
                <button className="eq-btn-save" onClick={() => setTempPwd(null)}>
                  {t('equipe.inviteLinkModal.gotIt')}
                </button>
              </>
            ) : (
              <>
                <div className="eq-modal-icon eq-modal-icon-key">
                  <i className="fas fa-key" />
                </div>
                <h3>{t('equipe.tempPwdModal.title')}</h3>
                <p>
                  {t('equipe.tempPwdModal.transmitPrefix')} <strong>{tempPwd.name}</strong>.<br />
                  {t('equipe.tempPwdModal.mustChange')}
                </p>
                <div className="eq-pwd-box">
                  <span className="eq-pwd-val">{tempPwd.pwd}</span>
                  <button
                    className="eq-pwd-copy"
                    onClick={() => {
                      navigator.clipboard.writeText(tempPwd.pwd);
                      pop(t('equipe.toast.passwordCopied'), 's');
                    }}
                  >
                    <i className="fas fa-copy" />
                  </button>
                </div>
                <p className="eq-pwd-warn">
                  <i className="fas fa-triangle-exclamation" />
                  {t('equipe.tempPwdModal.warn')}
                </p>
                <button className="eq-btn-save" onClick={() => setTempPwd(null)}>
                  {t('equipe.tempPwdModal.gotIt')}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
       * MODALE — Confirmation d'action
       * ══════════════════════════════════════════════ */}
      {confirmAction && (
        <div className="eq-overlay" onClick={() => setConfirmAction(null)}>
          <div className="eq-modal" onClick={e => e.stopPropagation()}>
            <div className="eq-modal-icon eq-modal-icon-warn">
              <i className="fas fa-triangle-exclamation" />
            </div>
            <h3>{confirmAction.title}</h3>
            <p>{confirmAction.message}</p>
            <div className="eq-modal-actions">
              <button className="eq-btn-cancel" onClick={() => setConfirmAction(null)}>
                {t('equipe.confirm.cancel')}
              </button>
              <button
                className="eq-btn-danger"
                onClick={async () => {
                  try { await confirmAction.action(); }
                  catch (err: any) { pop(err.message ?? t('equipe.toast.genericError'), 'e'); }
                  setConfirmAction(null);
                }}
              >
                {t('equipe.confirm.confirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
 * SOUS-COMPOSANT — AddMemberModal
 * Supporte : création directe (MDP temporaire) ou invitation (email)
 * ══════════════════════════════════════════════════════════════ */

interface AddMemberModalProps {
  onClose:   () => void;
  onSuccess: (name: string, pwdOrLink: string, kind: 'password' | 'inviteLink') => void;
}

function AddMemberModal({ onClose, onSuccess }: AddMemberModalProps) {
  const { pop } = useToast();
  const { t } = useTranslation();

  /* Mode : 'direct' = création immédiate | 'invite' = invitation par email */
  const [mode, setMode] = useState<'direct' | 'invite'>('direct');

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    jobTitle: '', internalRole: '',
  });
  const [saving, setSaving]     = useState(false);
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');

  /* Charger les modèles de permissions */
  useEffect(() => {
    apiFetch<PermissionTemplate[]>('/company-team/permission-templates')
      .then(res => setTemplates(res))
      .catch(() => {});
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = t('equipe.addModal.errors.firstName');
    if (!form.lastName.trim())  e.lastName  = t('equipe.addModal.errors.lastName');
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) {
      e.email = t('equipe.addModal.errors.email');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);

    const basePayload = {
      firstName:    form.firstName.trim(),
      lastName:     form.lastName.trim(),
      email:        form.email.trim().toLowerCase(),
      jobTitle:     form.jobTitle.trim()     || undefined,
      internalRole: form.internalRole.trim() || undefined,
      templateId:   templateId || undefined,
    };

    try {
      if (mode === 'invite') {
        /* Invitation par email — phone n'est pas dans CreateInvitationDto.
         * Aucun email n'est envoyé automatiquement pour l'instant (voir
         * noteInvite) — le lien renvoyé par le serveur (relatif, ex.
         * /login?collabToken=xxx) doit être transformé en URL absolue
         * pour être copiable/partageable tel quel. */
        const res = await apiFetch<{ invitationLink: string }>(
          '/company-team/invitations', { method: 'POST', body: basePayload },
        );
        pop(t('equipe.addModal.invitationSentToast', { email: form.email }), 's');
        const fullLink = `${window.location.origin}${res.invitationLink}`;
        onSuccess(`${form.firstName} ${form.lastName}`, fullLink, 'inviteLink');
      } else {
        /* Création directe avec MDP temporaire */
        const res = await apiFetch<{ member: TeamMember; temporaryPassword: string }>(
          '/company-team/members', {
            method: 'POST',
            body: { ...basePayload, phone: form.phone.trim() || undefined },
          },
        );
        onSuccess(`${form.firstName} ${form.lastName}`, res.temporaryPassword, 'password');
      }
    } catch (err: any) {
      pop(err.message ?? t('equipe.addModal.createError'), 'e');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="eq-overlay" onClick={onClose}>
      <div className="eq-modal eq-modal-add" onClick={e => e.stopPropagation()}>
        <div className="eq-modal-header">
          <h3><i className="fas fa-user-plus" /> {t('equipe.addModal.title')}</h3>
          <button className="eq-close" onClick={onClose}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* Sélecteur de mode */}
        <div className="eq-mode-tabs">
          <button
            type="button"
            className={`eq-mode-tab${mode === 'direct' ? ' eq-mode-on' : ''}`}
            onClick={() => setMode('direct')}
          >
            <i className="fas fa-user-check" /> {t('equipe.addModal.modeDirect')}
          </button>
          <button
            type="button"
            className={`eq-mode-tab${mode === 'invite' ? ' eq-mode-on' : ''}`}
            onClick={() => setMode('invite')}
          >
            <i className="fas fa-envelope" /> {t('equipe.addModal.modeInvite')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="eq-form">
          <div className="eq-form-row">
            <div className="eq-field">
              <label>{t('equipe.addModal.firstName')}</label>
              <input
                type="text"
                value={form.firstName}
                onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                placeholder={t('equipe.addModal.firstNamePlaceholder')}
                className={errors.firstName ? 'err' : ''}
              />
              {errors.firstName && <span className="eq-err">{errors.firstName}</span>}
            </div>
            <div className="eq-field">
              <label>{t('equipe.addModal.lastName')}</label>
              <input
                type="text"
                value={form.lastName}
                onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                placeholder={t('equipe.addModal.lastNamePlaceholder')}
                className={errors.lastName ? 'err' : ''}
              />
              {errors.lastName && <span className="eq-err">{errors.lastName}</span>}
            </div>
          </div>

          <div className="eq-field">
            <label>{t('equipe.addModal.email')}</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder={t('equipe.addModal.emailPlaceholder')}
              className={errors.email ? 'err' : ''}
            />
            {errors.email && <span className="eq-err">{errors.email}</span>}
          </div>

          <div className="eq-form-row">
            <div className="eq-field">
              <label>{t('equipe.addModal.phone')}</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder={t('equipe.addModal.phonePlaceholder')}
              />
            </div>
            <div className="eq-field">
              <label>{t('equipe.addModal.jobTitle')}</label>
              <input
                type="text"
                value={form.jobTitle}
                onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))}
                placeholder={t('equipe.addModal.jobTitlePlaceholder')}
              />
            </div>
          </div>

          <div className="eq-form-row">
            <div className="eq-field">
              <label>{t('equipe.addModal.internalRole')}</label>
              <select
                value={form.internalRole}
                onChange={e => setForm(f => ({ ...f, internalRole: e.target.value }))}
              >
                <option value="">{t('equipe.addModal.selectPlaceholder')}</option>
                <option value="manager">{t('equipe.addModal.roles.manager')}</option>
                <option value="commercial">{t('equipe.addModal.roles.commercial')}</option>
                <option value="order_manager">{t('equipe.addModal.roles.orderManager')}</option>
                <option value="logistics_manager">{t('equipe.addModal.roles.logisticsManager')}</option>
                <option value="customer_service">{t('equipe.addModal.roles.customerService')}</option>
                <option value="accountant">{t('equipe.addModal.roles.accountant')}</option>
              </select>
            </div>
            {templates.length > 0 && (
              <div className="eq-field">
                <label>{t('equipe.addModal.permTemplate')}</label>
                <select
                  value={templateId}
                  onChange={e => setTemplateId(e.target.value)}
                >
                  <option value="">{t('equipe.addModal.noTemplate')}</option>
                  {templates.map(tpl => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.isSystem ? '⭐ ' : ''}{tpl.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <p className="eq-form-note">
            <i className="fas fa-circle-info" />
            {mode === 'invite'
              ? t('equipe.addModal.noteInvite')
              : t('equipe.addModal.noteDirect')}
          </p>

          <div className="eq-form-actions">
            <button type="button" className="eq-btn-cancel" onClick={onClose}>
              {t('equipe.addModal.cancel')}
            </button>
            <button type="submit" className="eq-btn-save" disabled={saving}>
              {saving
                ? <i className="fas fa-circle-notch fa-spin" />
                : mode === 'invite' ? t('equipe.addModal.sendInvitation') : t('equipe.addModal.createAccount')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
