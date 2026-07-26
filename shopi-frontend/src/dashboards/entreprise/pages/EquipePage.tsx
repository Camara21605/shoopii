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

const PERMISSION_GROUPS = [
  { key: 'products',   label: 'Produits',      icon: 'fa-tag',
    actions: [{ key: 'view', label: 'Voir' }, { key: 'create', label: 'Créer' },
              { key: 'edit', label: 'Modifier' }, { key: 'delete', label: 'Supprimer' }] },
  { key: 'orders',     label: 'Commandes',     icon: 'fa-box',
    actions: [{ key: 'view', label: 'Voir' }, { key: 'validate', label: 'Valider' },
              { key: 'cancel', label: 'Annuler' }, { key: 'edit', label: 'Modifier' }] },
  { key: 'deliveries', label: 'Livraisons',    icon: 'fa-motorcycle',
    actions: [{ key: 'view', label: 'Voir' }, { key: 'assign', label: 'Affecter' },
              { key: 'edit', label: 'Modifier' }] },
  { key: 'payments',   label: 'Paiements',     icon: 'fa-coins',
    actions: [{ key: 'view', label: 'Voir' }, { key: 'viewTransactions', label: 'Transactions' },
              { key: 'manageRefunds', label: 'Remboursements' }] },
  { key: 'messaging',  label: 'Messagerie',    icon: 'fa-comment',
    actions: [{ key: 'read', label: 'Lire' }, { key: 'send', label: 'Envoyer' }] },
  { key: 'statistics', label: 'Statistiques',  icon: 'fa-chart-line',
    actions: [{ key: 'view', label: 'Voir' }] },
  { key: 'settings',   label: 'Paramètres',    icon: 'fa-gear',
    actions: [{ key: 'view', label: 'Voir' }, { key: 'edit', label: 'Modifier' }] },
  { key: 'returns',    label: 'Retours & SAV', icon: 'fa-rotate-left',
    actions: [{ key: 'view', label: 'Voir' }, { key: 'process', label: 'Traiter' }] },
  { key: 'wallet',     label: 'Portefeuille',  icon: 'fa-wallet',
    actions: [{ key: 'view', label: 'Voir' }, { key: 'withdraw', label: 'Retrait' }] },
] as const;

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

function statusLabel(s: TeamMember['status']) {
  const map = {
    active:    { label: 'Actif',       cls: 'st-active'    },
    suspended: { label: 'Suspendu',    cls: 'st-suspended' },
    pending:   { label: 'En attente',  cls: 'st-pending'   },
    revoked:   { label: 'Révoqué',     cls: 'st-revoked'   },
  };
  return map[s] ?? map.revoked;
}

/* ══════════════════════════════════════════════════════════════
 * COMPOSANT PRINCIPAL
 * ══════════════════════════════════════════════════════════════ */

export default function EquipePage() {
  const { pop } = useToast();

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
  const [tempPwd,     setTempPwd]     = useState<{ name: string; pwd: string } | null>(null);
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
      pop('Impossible de charger les membres.', 'e');
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
      title:   `Suspendre ${m.firstName} ${m.lastName}`,
      message: `${m.firstName} ne pourra plus se connecter. Vous pouvez réactiver son accès à tout moment.`,
      action:  async () => {
        await apiFetch(`/company-team/members/${m.id}/suspend`, { method: 'POST', body: {} });
        pop(`${m.firstName} a été suspendu(e).`, 's');
        loadStats(); loadMembers();
      },
    });
  };

  const handleReactivate = async (m: TeamMember) => {
    try {
      await apiFetch(`/company-team/members/${m.id}/reactivate`, { method: 'POST' });
      pop(`${m.firstName} a été réactivé(e).`, 's');
      loadStats(); loadMembers();
    } catch (err: any) {
      pop(err.message ?? 'Erreur lors de la réactivation.', 'e');
    }
  };

  const handleDelete = (m: TeamMember) => {
    setConfirmAction({
      title:   `Supprimer l'accès de ${m.firstName} ${m.lastName}`,
      message: `L'accès de ${m.firstName} sera définitivement révoqué. Cette action est irréversible.`,
      action:  async () => {
        await apiFetch(`/company-team/members/${m.id}`, { method: 'DELETE' });
        pop(`Accès de ${m.firstName} révoqué.`, 's');
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
      pop(err.message ?? 'Erreur lors de la réinitialisation.', 'e');
    }
  };

  const openPermissions = (m: TeamMember) => {
    setPermTarget(m);
    setPermState(m.permissions ? JSON.parse(JSON.stringify(m.permissions)) : {});
  };

  const savePermissions = async () => {
    if (!permTarget) return;
    setSavingPerm(true);
    try {
      await apiFetch(`/company-team/members/${permTarget.id}/permissions`, {
        method: 'PATCH',
        body:   { permissions: permState },
      });
      pop('Permissions mises à jour.', 's');
      setPermTarget(null);
      loadMembers();
    } catch (err: any) {
      pop(err.message ?? 'Erreur lors de la mise à jour.', 'e');
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
      pop('Invitation renvoyée.', 's');
      loadInvitations();
    } catch (err: any) {
      pop(err.message ?? 'Erreur.', 'e');
    }
  };

  const handleCancelInvitation = (inv: InvitationEntry) => {
    setConfirmAction({
      title:   `Annuler l'invitation pour ${inv.email}`,
      message: `L'invitation envoyée à ${inv.email} sera annulée. Le lien ne sera plus valide.`,
      action:  async () => {
        await apiFetch(`/company-team/invitations/${inv.id}`, { method: 'DELETE' });
        pop('Invitation annulée.', 's');
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
            <i className="fas fa-users-gear" /> Gestion de l'équipe
          </h1>
          <p className="eq-sub">Gérez les accès et permissions de vos collaborateurs.</p>
        </div>
        {stats?.canAddMore && (
          <button className="eq-btn-add" onClick={() => setShowAdd(true)}>
            <i className="fas fa-user-plus" /> Ajouter un membre
          </button>
        )}
      </div>

      {/* ── Stats ── */}
      {stats && (
        <div className="eq-stats">
          <div className="eq-stat">
            <div className="eq-stat-val">{stats.activeCount}</div>
            <div className="eq-stat-lbl">Membres actifs</div>
          </div>
          <div className="eq-stat eq-stat-max">
            <div className="eq-stat-val">
              {stats.activeCount}
              <span>/{stats.maxAllowed === Infinity ? '∞' : stats.maxAllowed}</span>
            </div>
            <div className="eq-stat-lbl">Slots utilisés</div>
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
            <div className="eq-stat-lbl">Suspendus</div>
          </div>
          <div className="eq-stat">
            <div className="eq-stat-val eq-green">
              {stats.maxAllowed === Infinity ? '∞' : stats.remainingSlots}
            </div>
            <div className="eq-stat-lbl">Places restantes</div>
          </div>
          {planInfo && (
            <div className="eq-stat eq-stat-plan">
              <div className="eq-plan-badge">{planInfo.name}</div>
              <div className="eq-stat-lbl">Plan actif</div>
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
          <i className="fas fa-users" /> Membres
          {stats && stats.activeCount > 0 && (
            <span className="eq-tab-badge">{stats.activeCount}</span>
          )}
        </button>
        <button
          className={`eq-tab${activeTab === 'invitations' ? ' eq-tab-on' : ''}`}
          onClick={() => setActiveTab('invitations')}
        >
          <i className="fas fa-envelope-open-text" /> Invitations
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
                placeholder="Rechercher par nom, email, poste…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <span className="eq-count">{total} membre{total > 1 ? 's' : ''}</span>
          </div>

          {/* Tableau */}
          <div className="eq-table-wrap">
            {loading ? (
              <div className="eq-loading">
                <i className="fas fa-circle-notch fa-spin" /> Chargement…
              </div>
            ) : members.length === 0 ? (
              <div className="eq-empty">
                <i className="fas fa-users-slash" />
                <p>Aucun collaborateur pour le moment.</p>
                <p className="eq-empty-sub">
                  Cliquez sur "Ajouter un membre" pour inviter votre première équipe.
                </p>
              </div>
            ) : (
              <table className="eq-table">
                <thead>
                  <tr>
                    <th>Membre</th>
                    <th>Poste / Rôle</th>
                    <th>Statut</th>
                    <th>Dernière connexion</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => {
                    const st = statusLabel(m.status);
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
                                <span className="eq-tag-pwd">⚠ MDP à changer</span>
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
                              title="Modifier les permissions"
                              onClick={() => openPermissions(m)}
                            >
                              <i className="fas fa-shield-halved" />
                            </button>
                            <button
                              className="eq-act"
                              title="Journal d'activité"
                              onClick={() => openActivity(m)}
                            >
                              <i className="fas fa-clock-rotate-left" />
                            </button>
                            <button
                              className="eq-act"
                              title="Réinitialiser le mot de passe"
                              onClick={() => handleResetPassword(m)}
                            >
                              <i className="fas fa-key" />
                            </button>
                            {m.status === 'active' ? (
                              <button
                                className="eq-act eq-act-warn"
                                title="Suspendre"
                                onClick={() => handleSuspend(m)}
                              >
                                <i className="fas fa-ban" />
                              </button>
                            ) : m.status === 'suspended' ? (
                              <button
                                className="eq-act eq-act-ok"
                                title="Réactiver"
                                onClick={() => handleReactivate(m)}
                              >
                                <i className="fas fa-circle-check" />
                              </button>
                            ) : null}
                            <button
                              className="eq-act eq-act-danger"
                              title="Supprimer l'accès"
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
              <span>Page {page} / {Math.ceil(total / 20)}</span>
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
            <span className="eq-inv-title">Invitations en attente</span>
            <button className="eq-btn-add" onClick={() => setShowAdd(true)}>
              <i className="fas fa-envelope" /> Envoyer une invitation
            </button>
          </div>
          {invitations.length === 0 ? (
            <div className="eq-empty">
              <i className="fas fa-envelope-open" />
              <p>Aucune invitation en attente.</p>
              <p className="eq-empty-sub">
                Utilisez "Ajouter un membre" pour inviter un collaborateur par email.
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
                      Expire le {formatDate(inv.expiresAt)}
                    </div>
                  </div>
                  <div className="eq-inv-actions">
                    <button
                      className="eq-act"
                      title="Renvoyer l'invitation"
                      onClick={() => handleResendInvitation(inv)}
                    >
                      <i className="fas fa-paper-plane" />
                    </button>
                    <button
                      className="eq-act eq-act-danger"
                      title="Annuler l'invitation"
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
          onSuccess={(name, pwd) => {
            setShowAdd(false);
            setTempPwd({ name, pwd });
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
        <div className="eq-overlay" onClick={() => setPermTarget(null)}>
          <div className="eq-panel" onClick={e => e.stopPropagation()}>
            <div className="eq-panel-header">
              <div>
                <div className="eq-panel-title">
                  <i className="fas fa-shield-halved" /> Permissions
                </div>
                <div className="eq-panel-sub">
                  {permTarget.firstName} {permTarget.lastName}
                </div>
              </div>
              <button className="eq-close" onClick={() => setPermTarget(null)}>
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className="eq-panel-body">
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
                            onChange={e => {
                              setPermState(prev => ({
                                ...prev,
                                [group.key]: {
                                  ...(prev[group.key] ?? {}),
                                  [action.key]: e.target.checked,
                                },
                              }));
                            }}
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
              <button className="eq-btn-cancel" onClick={() => setPermTarget(null)}>
                Annuler
              </button>
              <button
                className="eq-btn-save"
                onClick={savePermissions}
                disabled={savingPerm}
              >
                {savingPerm
                  ? <i className="fas fa-circle-notch fa-spin" />
                  : 'Enregistrer'}
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
                  <i className="fas fa-clock-rotate-left" /> Activité récente
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
                  Aucune activité enregistrée.
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
            <div className="eq-modal-icon eq-modal-icon-key">
              <i className="fas fa-key" />
            </div>
            <h3>Mot de passe temporaire</h3>
            <p>
              Transmettez ce mot de passe à <strong>{tempPwd.name}</strong>.<br />
              Il devra le changer à la prochaine connexion.
            </p>
            <div className="eq-pwd-box">
              <span className="eq-pwd-val">{tempPwd.pwd}</span>
              <button
                className="eq-pwd-copy"
                onClick={() => {
                  navigator.clipboard.writeText(tempPwd.pwd);
                  pop('Mot de passe copié !', 's');
                }}
              >
                <i className="fas fa-copy" />
              </button>
            </div>
            <p className="eq-pwd-warn">
              <i className="fas fa-triangle-exclamation" />
              Ce mot de passe ne sera affiché qu'une seule fois.
            </p>
            <button className="eq-btn-save" onClick={() => setTempPwd(null)}>
              J'ai noté le mot de passe
            </button>
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
                Annuler
              </button>
              <button
                className="eq-btn-danger"
                onClick={async () => {
                  try { await confirmAction.action(); }
                  catch (err: any) { pop(err.message ?? 'Erreur.', 'e'); }
                  setConfirmAction(null);
                }}
              >
                Confirmer
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
  onSuccess: (name: string, pwd: string) => void;
}

function AddMemberModal({ onClose, onSuccess }: AddMemberModalProps) {
  const { pop } = useToast();

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
    if (!form.firstName.trim()) e.firstName = 'Prénom requis';
    if (!form.lastName.trim())  e.lastName  = 'Nom requis';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) {
      e.email = 'Email invalide';
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
        /* Invitation par email — phone n'est pas dans CreateInvitationDto */
        await apiFetch('/company-team/invitations', { method: 'POST', body: basePayload });
        pop(`Invitation envoyée à ${form.email}.`, 's');
        onSuccess(`${form.firstName} ${form.lastName}`, '');
      } else {
        /* Création directe avec MDP temporaire */
        const res = await apiFetch<{ member: TeamMember; temporaryPassword: string }>(
          '/company-team/members', {
            method: 'POST',
            body: { ...basePayload, phone: form.phone.trim() || undefined },
          },
        );
        onSuccess(`${form.firstName} ${form.lastName}`, res.temporaryPassword);
      }
    } catch (err: any) {
      pop(err.message ?? 'Erreur lors de la création.', 'e');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="eq-overlay" onClick={onClose}>
      <div className="eq-modal eq-modal-add" onClick={e => e.stopPropagation()}>
        <div className="eq-modal-header">
          <h3><i className="fas fa-user-plus" /> Ajouter un collaborateur</h3>
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
            <i className="fas fa-user-check" /> Création directe
          </button>
          <button
            type="button"
            className={`eq-mode-tab${mode === 'invite' ? ' eq-mode-on' : ''}`}
            onClick={() => setMode('invite')}
          >
            <i className="fas fa-envelope" /> Invitation par email
          </button>
        </div>

        <form onSubmit={handleSubmit} className="eq-form">
          <div className="eq-form-row">
            <div className="eq-field">
              <label>Prénom *</label>
              <input
                type="text"
                value={form.firstName}
                onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                placeholder="Marie"
                className={errors.firstName ? 'err' : ''}
              />
              {errors.firstName && <span className="eq-err">{errors.firstName}</span>}
            </div>
            <div className="eq-field">
              <label>Nom *</label>
              <input
                type="text"
                value={form.lastName}
                onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                placeholder="Diallo"
                className={errors.lastName ? 'err' : ''}
              />
              {errors.lastName && <span className="eq-err">{errors.lastName}</span>}
            </div>
          </div>

          <div className="eq-field">
            <label>Email professionnel *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="marie.diallo@boutique.com"
              className={errors.email ? 'err' : ''}
            />
            {errors.email && <span className="eq-err">{errors.email}</span>}
          </div>

          <div className="eq-form-row">
            <div className="eq-field">
              <label>Téléphone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+224 620 000 000"
              />
            </div>
            <div className="eq-field">
              <label>Poste</label>
              <input
                type="text"
                value={form.jobTitle}
                onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))}
                placeholder="Responsable des ventes"
              />
            </div>
          </div>

          <div className="eq-form-row">
            <div className="eq-field">
              <label>Rôle interne</label>
              <select
                value={form.internalRole}
                onChange={e => setForm(f => ({ ...f, internalRole: e.target.value }))}
              >
                <option value="">— Sélectionner —</option>
                <option value="manager">Manager</option>
                <option value="commercial">Commercial</option>
                <option value="order_manager">Gestionnaire des commandes</option>
                <option value="logistics_manager">Responsable logistique</option>
                <option value="customer_service">Service client</option>
                <option value="accountant">Comptable</option>
              </select>
            </div>
            {templates.length > 0 && (
              <div className="eq-field">
                <label>Modèle de permissions</label>
                <select
                  value={templateId}
                  onChange={e => setTemplateId(e.target.value)}
                >
                  <option value="">— Aucun modèle —</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.isSystem ? '⭐ ' : ''}{t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <p className="eq-form-note">
            <i className="fas fa-circle-info" />
            {mode === 'invite'
              ? 'Un email d\'invitation sera envoyé. Le collaborateur choisira son propre mot de passe.'
              : 'Un mot de passe temporaire sera généré et affiché une seule fois.'}
          </p>

          <div className="eq-form-actions">
            <button type="button" className="eq-btn-cancel" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="eq-btn-save" disabled={saving}>
              {saving
                ? <i className="fas fa-circle-notch fa-spin" />
                : mode === 'invite' ? 'Envoyer l\'invitation' : 'Créer le compte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
