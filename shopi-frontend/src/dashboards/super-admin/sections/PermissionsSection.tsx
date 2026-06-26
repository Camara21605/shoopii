// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/sections/PermissionsSection.tsx
// ─────────────────────────────────────────────────────────────

import React from 'react';
import type { SuperAdminStore } from '../hooks/useSuperAdminState';

interface Props {
  store: SuperAdminStore;
  toast: (type: string, msg: string) => void;
  isActive: boolean;
}

const PERM_COLS: { key: string; label: string }[] = [
  { key: 'partners',   label: 'Partenaires'  },
  { key: 'companies',  label: 'Entreprises'  },
  { key: 'delivery',   label: 'Livreurs'     },
  { key: 'customers',  label: 'Clients'      },
  { key: 'stats',      label: 'Stats'        },
  { key: 'reports',    label: 'Signalements' },
  { key: 'notifs',     label: 'Notifs'       },
  { key: 'support',    label: 'Support'      },
];

export default function PermissionsSection({ store, toast, isActive }: Props) {
  if (!isActive) return null;

  const { admins, adminsLoading, adminsError, reloadAdmins, toggleAdminPerm } = store;

  const handleToggle = async (email: string, perm: string, val: boolean) => {
    const admin = admins.find(a => a.email === email);
    try {
      await toggleAdminPerm(email, perm, val);
      toast('success', `🔐 '${perm}' ${val ? 'accordée' : 'révoquée'} à ${admin?.name || email}`);
    } catch (e: any) {
      toast('error', `❌ ${e?.message ?? 'Erreur'}`);
    }
  };

  return (
    <div className="section active">
      <div className="page-header">
        <div>
          <div className="ph-title">Permissions <mark>Admins</mark></div>
          <div className="ph-sub">Gestion granulaire des droits administrateurs</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost btn-sm" onClick={reloadAdmins} disabled={adminsLoading} title="Actualiser">
            {adminsLoading ? '⏳' : '🔄'}
          </button>
        </div>
      </div>

      {adminsError && (
        <div style={{ margin:'0 0 12px', padding:'10px 14px', background:'rgba(220,38,38,.08)', border:'1px solid rgba(220,38,38,.25)', borderRadius:8, fontSize:12, color:'var(--rose,#dc2626)', display:'flex', alignItems:'center', gap:8 }}>
          <span>⚠️</span> {adminsError}
          <button onClick={reloadAdmins} style={{ marginLeft:'auto', background:'none', border:'1px solid currentColor', borderRadius:5, padding:'2px 8px', fontSize:11, cursor:'pointer', color:'inherit' }}>
            Réessayer
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <div className="card-title">Administrateurs secondaires</div>
          <span className="badge b-sky">Permissions délégables</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="perm-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Administrateur</th>
                {PERM_COLS.map(p => (
                  <th key={p.key}>{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {adminsLoading && (
                <tr>
                  <td colSpan={PERM_COLS.length + 1} style={{ textAlign: 'center', padding: '32px', color: 'var(--txt-3)' }}>
                    ⏳ Chargement des administrateurs…
                  </td>
                </tr>
              )}
              {!adminsLoading && admins.length === 0 && !adminsError && (
                <tr>
                  <td colSpan={PERM_COLS.length + 1} style={{ textAlign: 'center', padding: '32px', color: 'var(--txt-3)' }}>
                    Aucun administrateur secondaire
                  </td>
                </tr>
              )}
              {!adminsLoading && admins.map(admin => {
                const init = admin.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <tr key={admin.email}>
                    <td>
                      <div className="u-cell">
                        <div className="u-av" style={{ background: 'var(--rose-dim)', color: 'var(--rose)' }}>
                          {init}
                        </div>
                        <div className="u-info">
                          <div className="u-name">{admin.name}</div>
                          <div className="u-email">{admin.email}</div>
                        </div>
                      </div>
                    </td>
                    {PERM_COLS.map(p => (
                      <td key={p.key}>
                        <label className="toggle" style={{ margin: '0 auto' }}>
                          <input
                            type="checkbox"
                            checked={!!(admin.perms as Record<string, boolean>)[p.key]}
                            onChange={e => handleToggle(admin.email, p.key, e.target.checked)}
                          />
                          <div className="toggle-track" />
                          <div className="toggle-thumb" />
                        </label>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
