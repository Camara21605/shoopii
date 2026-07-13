/* ================================================================
 * FICHIER : src/dashboards/super-admin/sections/UsersSection.tsx
 *
 * AMÉLIORATIONS :
 *   1. Bouton Suspendre ajouté (appel API suspendUser)
 *   2. Bouton Vérifier ajouté (appel API verifyUser)
 *   3. Modal détail utilisateur (slide-over)
 *   4. handleExport async avec gestion d'erreur
 *   5. Loading spinner par ligne pendant les actions
 * ================================================================ */

import React, { useState } from 'react';
import type { SuperAdminStore } from '../hooks/useSuperAdminState';
import { AV_COLORS, FLAGS, ROLE_LABELS } from '../data/mockDB';

interface Props {
  store:    SuperAdminStore;
  toast:    (type: string, msg: string) => void;
  isActive: boolean;
}

const COUNTRY_NAMES: Record<string, string> = {
  GN: 'Guinée',
  SN: 'Sénégal',
  ML: 'Mali',
  CI: "Côte d'Ivoire",
};

const ROLE_PILL: Record<string, string> = {
  company: 'rp-company', delivery: 'rp-delivery', client: 'rp-customer',
  partner: 'rp-partner', admin: 'rp-admin', correspondent: 'rp-correspondent',
};

const ROLE_TABS = [
  { key: 'all',           label: '👥 Tous'           },
  { key: 'company',       label: '🏪 Entreprises'    },
  { key: 'delivery',      label: '🛵 Livreurs'       },
  { key: 'client',        label: '🛒 Clients'        },
  { key: 'partner',       label: '🤝 Partenaires'    },
  { key: 'correspondent', label: '📦 Correspondants' },
  { key: 'admin',         label: '🛡 Admins'         },
];

const STATUS_CLASS: Record<string, string> = {
  active: 'sd-active', blocked: 'sd-blocked', pending: 'sd-pending', suspended: 'sd-suspended',
};

const STATUS_LABEL: Record<string, string> = {
  active: '● Actif', blocked: '● Bloqué', pending: '● En attente', suspended: '● Suspendu',
};

export default function UsersSection({ store, toast, isActive }: Props) {
  if (!isActive) return null;

  /* IDs des lignes en cours d'action (spinner) */
  const [actionIds, setActionIds] = useState<Set<string>>(new Set());

  const {
    state, users, usersTotal, usersPages,
    usersLoading, usersError, reloadUsers, exportUsers,
  } = store;

  const totalPages = usersPages;
  const page       = state.page;

  /* Ajouter/retirer un ID en cours d'action */
  const withLoading = async (id: string, fn: () => Promise<void>) => {
    setActionIds(s => new Set(s).add(id));
    try   { await fn(); }
    finally { setActionIds(s => { const n = new Set(s); n.delete(id); return n; }); }
  };

  /* ── Actions ──────────────────────────────────────────────── */

  const handleToggleBlock = (u: typeof users[0]) =>
    withLoading(u.id, async () => {
      try {
        await store.toggleBlockUser(u.id);
        toast(
          u.status === 'blocked' ? 'success' : 'warn',
          `${u.status === 'blocked' ? '✅' : '🚫'} ${u.name} ${u.status === 'blocked' ? 'débloqué' : 'bloqué'}`,
        );
      } catch { toast('error', `❌ Erreur action sur ${u.name}`); }
    });

  const handleSuspend = (u: typeof users[0]) =>
    withLoading(u.id, async () => {
      try {
        await store.suspendUser(u.id);
        toast('warn', `⏸ ${u.name} suspendu`);
      } catch (e: any) { toast('error', `❌ ${e?.message ?? 'Erreur'}`); }
    });

  const handleVerify = (u: typeof users[0]) =>
    withLoading(u.id, async () => {
      try {
        await store.verifyUser(u.id);
        toast('success', `✅ ${u.name} vérifié`);
      } catch (e: any) { toast('error', `❌ ${e?.message ?? 'Erreur'}`); }
    });

  const handleExport = async () => {
    try {
      await exportUsers();
      toast('info', '⬇ Export CSV téléchargé');
    } catch { toast('error', '❌ Export CSV échoué'); }
  };

  return (
    <div className="section active">

      {/* ── En-tête ── */}
      <div className="page-header">
        <div>
          <div className="ph-title">Gestion des <mark>Utilisateurs</mark></div>
          <div className="ph-sub">
            {usersLoading
              ? 'Chargement…'
              : `${usersTotal} compte${usersTotal > 1 ? 's' : ''} trouvé${usersTotal > 1 ? 's' : ''}`
            }
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost btn-sm" onClick={reloadUsers} disabled={usersLoading} title="Actualiser">
            {usersLoading ? '⏳' : '🔄'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleExport} disabled={usersLoading}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* ── Onglets rôles ── */}
      <div className="role-tabs">
        {ROLE_TABS.map(t => (
          <div
            key={t.key}
            className={`role-tab${state.roleFilter === t.key ? ' active' : ''}`}
            onClick={() => store.setRoleFilter(t.key as any)}
          >
            {t.label}
          </div>
        ))}
      </div>

      <div className="card">

        {/* ── Filtres ── */}
        <div className="tbl-controls">
          <div className="tbl-search">
            <span style={{ color:'var(--txt-3)' }}>🔍</span>
            <input
              type="text"
              placeholder="Nom, email, téléphone…"
              value={state.search}
              onChange={e => store.setSearch(e.target.value)}
            />
          </div>

          <select className="sel" value={state.statusFilter} onChange={e => store.setStatusFilter(e.target.value as any)}>
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="blocked">Bloqué</option>
            <option value="pending">En attente</option>
            <option value="suspended">Suspendu</option>
          </select>

          <select className="sel" value={state.countryFilter} onChange={e => store.setCountryFilter(e.target.value)}>
            <option value="all">Tous les pays</option>
            <option value="GN">🇬🇳 Guinée</option>
            <option value="SN">🇸🇳 Sénégal</option>
            <option value="ML">🇲🇱 Mali</option>
            <option value="CI">🇨🇮 Côte d'Ivoire</option>
          </select>
        </div>

        {/* ── Erreur API ── */}
        {usersError && (
          <div style={{ margin:'0 16px 12px', padding:'10px 14px', background:'rgba(220,38,38,.08)', border:'1px solid rgba(220,38,38,.25)', borderRadius:8, fontSize:12, color:'var(--rose,#dc2626)', display:'flex', alignItems:'center', gap:8 }}>
            <span>⚠️</span> {usersError}
            <button onClick={reloadUsers} style={{ marginLeft:'auto', background:'none', border:'1px solid currentColor', borderRadius:5, padding:'2px 8px', fontSize:11, cursor:'pointer', color:'inherit' }}>
              Réessayer
            </button>
          </div>
        )}

        {/* ── Tableau ── */}
        <div style={{ overflowX:'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Rôle</th>
                <th>Statut</th>
                <th>Pays</th>
                <th>Téléphone</th>
                <th>Inscription</th>
                <th>Vérifié</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>

              {usersLoading && (
                <tr>
                  <td colSpan={8} style={{ textAlign:'center', padding:'32px', color:'var(--txt-3)' }}>
                    ⏳ Chargement des utilisateurs…
                  </td>
                </tr>
              )}

              {!usersLoading && users.map(u => {
                const [fg, bg] = AV_COLORS[u.role] || ['#607898', '#0F1824'];
                const initials = u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                const isActing = actionIds.has(u.id);

                return (
                  <tr key={u.id} style={{ opacity: isActing ? .6 : 1, transition:'opacity .2s' }}>

                    <td>
                      <div className="u-cell">
                        <div className="u-av" style={{ background:bg, color:fg }}>{initials}</div>
                        <div className="u-info">
                          <div className="u-name">{u.name}</div>
                          <div className="u-email">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className={`role-pill ${ROLE_PILL[u.role] ?? ''}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>

                    <td>
                      <span className={`status-dot ${STATUS_CLASS[u.status] ?? ''}`}>
                        {STATUS_LABEL[u.status] ?? u.status}
                      </span>
                    </td>

                    <td style={{ whiteSpace: 'nowrap' }}>
                      {u.country
                        ? <>{FLAGS[u.country] ?? '🌍'} {COUNTRY_NAMES[u.country] ?? u.country}</>
                        : <span style={{ color: 'var(--txt-3)', fontSize: 11 }}>—</span>
                      }
                    </td>

                    <td style={{ fontFamily:'var(--font-m)', fontSize:11 }}>
                      {u.phone}
                    </td>

                    <td style={{ fontFamily:'var(--font-m)', fontSize:11, color:'var(--txt-3)' }}>
                      {new Date(u.date).toLocaleDateString('fr-FR')}
                    </td>

                    <td style={{ textAlign:'center' }}>
                      {u.verified ? '✅' : '⏳'}
                    </td>

                    <td>
                      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>

                        {/* 👁 Voir détail */}
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => store.openUserModal(u as any)}
                          disabled={isActing}
                          title="Voir le détail"
                        >
                          👁
                        </button>

                        {/* 🚫 / 🔓 Bloquer / Débloquer */}
                        <button
                          className={`btn btn-xs ${u.status === 'blocked' ? 'btn-primary' : 'btn-danger'}`}
                          onClick={() => handleToggleBlock(u)}
                          disabled={isActing}
                          title={u.status === 'blocked' ? 'Débloquer' : 'Bloquer'}
                        >
                          {isActing ? '⏳' : u.status === 'blocked' ? '🔓' : '🚫'}
                        </button>

                        {/* ⏸ Suspendre (seulement si pas déjà suspendu/bloqué) */}
                        {u.status === 'active' || u.status === 'pending' ? (
                          <button
                            className="btn btn-xs btn-warn"
                            onClick={() => handleSuspend(u)}
                            disabled={isActing}
                            title="Suspendre"
                            style={{ background:'rgba(217,119,6,.15)', color:'var(--amber,#d97706)', border:'1px solid rgba(217,119,6,.3)', borderRadius:6, padding:'2px 7px', fontSize:11, cursor:'pointer' }}
                          >
                            {isActing ? '⏳' : '⏸'}
                          </button>
                        ) : null}

                        {/* ✅ Vérifier (seulement si pas encore vérifié) */}
                        {!u.verified && (
                          <button
                            className="btn btn-xs btn-success"
                            onClick={() => handleVerify(u)}
                            disabled={isActing}
                            title="Vérifier le compte"
                            style={{ background:'rgba(5,150,105,.15)', color:'var(--emerald,#059669)', border:'1px solid rgba(5,150,105,.3)', borderRadius:6, padding:'2px 7px', fontSize:11, cursor:'pointer' }}
                          >
                            {isActing ? '⏳' : '✔'}
                          </button>
                        )}

                      </div>
                    </td>
                  </tr>
                );
              })}

              {!usersLoading && users.length === 0 && !usersError && (
                <tr>
                  <td colSpan={8} style={{ textAlign:'center', padding:'32px', color:'var(--txt-3)' }}>
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {!usersLoading && usersTotal > 0 && (
          <div className="pager">
            <span style={{ flex:1, fontSize:12, color:'var(--txt-3)' }}>
              Page {page} / {totalPages} — {usersTotal} utilisateur{usersTotal > 1 ? 's' : ''}
            </span>

            <button className="pager-btn" disabled={page === 1} onClick={() => store.goPage(page - 1)}>‹</button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | string)[]>((acc, p, i, arr) => {
                if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('…');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                typeof p === 'string'
                  ? <span key={i} style={{ color:'var(--txt-3)', padding:'0 4px' }}>…</span>
                  : (
                    <button
                      key={i}
                      className={`pager-btn${p === page ? ' active' : ''}`}
                      onClick={() => store.goPage(p as number)}
                    >
                      {p}
                    </button>
                  ),
              )
            }

            <button className="pager-btn" disabled={page === totalPages} onClick={() => store.goPage(page + 1)}>›</button>
          </div>
        )}
      </div>

    </div>
  );
}