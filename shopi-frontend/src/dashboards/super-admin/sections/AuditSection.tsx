// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/sections/AuditSection.tsx
// ─────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import type { SuperAdminStore } from '../hooks/useSuperAdminState';

interface Props {
  store: SuperAdminStore;
  isActive: boolean;
}

const ACTION_FILTERS = [
  { value: 'all',          label: 'Toutes les actions' },
  { value: 'connexion',    label: 'Connexions'          },
  { value: 'inscription',  label: 'Inscriptions'        },
  { value: 'bloqué',       label: 'Blocages'            },
  { value: 'code',         label: 'Codes invitation'    },
  { value: 'message',      label: 'Messages'            },
];

export default function AuditSection({ store, isActive }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  if (!isActive) return null;

  const { auditLog, auditLoading, auditError, reloadAudit } = store;

  let logs = [...auditLog];
  if (search) {
    const q = search.toLowerCase();
    logs = logs.filter(l =>
      l.user.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q)
    );
  }
  if (filter !== 'all') {
    logs = logs.filter(l => l.action.toLowerCase().includes(filter));
  }

  return (
    <div className="section active">
      <div className="page-header">
        <div>
          <div className="ph-title">Journal <mark>d'Audit</mark></div>
          <div className="ph-sub">Toutes les actions traçables — immuable</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost btn-sm" onClick={reloadAudit} disabled={auditLoading} title="Actualiser">
            {auditLoading ? '⏳' : '🔄'}
          </button>
          <button className="btn btn-ghost">⬇ Exporter logs</button>
        </div>
      </div>

      {auditError && (
        <div style={{ margin:'0 0 12px', padding:'10px 14px', background:'rgba(220,38,38,.08)', border:'1px solid rgba(220,38,38,.25)', borderRadius:8, fontSize:12, color:'var(--rose,#dc2626)', display:'flex', alignItems:'center', gap:8 }}>
          <span>⚠️</span> {auditError}
          <button onClick={reloadAudit} style={{ marginLeft:'auto', background:'none', border:'1px solid currentColor', borderRadius:5, padding:'2px 8px', fontSize:11, cursor:'pointer', color:'inherit' }}>
            Réessayer
          </button>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        {/* Contrôles */}
        <div className="tbl-controls">
          <div className="tbl-search">
            <span style={{ color: 'var(--txt-3)' }}>🔍</span>
            <input
              type="text"
              placeholder="Rechercher dans les logs…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="sel" value={filter} onChange={e => setFilter(e.target.value)}>
            {ACTION_FILTERS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <span style={{ fontSize: 11, color: 'var(--txt-3)', whiteSpace: 'nowrap' }}>
            {logs.length} entrée{logs.length > 1 ? 's' : ''}
          </span>
        </div>

        {/* Entrées */}
        <div>
          {auditLoading && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--txt-3)' }}>
              ⏳ Chargement du journal…
            </div>
          )}
          {!auditLoading && logs.map((entry, i) => (
            <div key={i} className="audit-item">
              <span className="audit-ico">{entry.icon}</span>
              <span className="audit-text">
                <span className="audit-user">{entry.user}</span>{' '}
                <span className="audit-action">{entry.action}</span>
              </span>
              <span className="audit-time">{entry.time}</span>
            </div>
          ))}
          {!auditLoading && logs.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--txt-3)' }}>
              Aucun résultat
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
