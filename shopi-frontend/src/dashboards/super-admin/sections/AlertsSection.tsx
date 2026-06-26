// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/sections/AlertsSection.tsx
// ─────────────────────────────────────────────────────────────

import React from 'react';
import type { SuperAdminStore } from '../hooks/useSuperAdminState';

interface Props {
  store: SuperAdminStore;
  toast: (type: string, msg: string) => void;
  isActive: boolean;
}

export default function AlertsSection({ store, toast, isActive }: Props) {
  if (!isActive) return null;

  const { alerts, alertsLoading, alertsError, reloadAlerts } = store;

  const criticals  = alerts.filter(a => a.type === 'critical' && !a.resolved).length;
  const warnings   = alerts.filter(a => a.type === 'warning'  && !a.resolved).length;
  const infos      = alerts.filter(a => a.type === 'info'     && !a.resolved).length;
  const resolved7d = alerts.filter(a => a.resolved).length;
  const pending    = alerts.filter(a => !a.resolved).length;

  const TYPE_COLOR: Record<string, string> = {
    critical: 'var(--rose)',
    warning:  'var(--gold)',
    info:     'var(--sky)',
  };
  const TYPE_BORDER: Record<string, string> = {
    critical: 'rgba(255,68,100,.15)',
    warning:  'rgba(245,166,35,.15)',
    info:     'rgba(56,191,255,.15)',
  };

  const handleResolve = async (id: string) => {
    try {
      await store.resolveAlert(id);
      toast('success', '✅ Signalement résolu');
    } catch (e: any) {
      toast('error', `❌ ${e?.message ?? 'Erreur'}`);
    }
  };

  const handleResolveAll = async () => {
    try {
      for (const a of alerts.filter(a => !a.resolved)) {
        await store.resolveAlert(a.id);
      }
      toast('success', '✅ Tous les signalements résolus');
    } catch (e: any) {
      toast('error', `❌ ${e?.message ?? 'Erreur'}`);
    }
  };

  return (
    <div className="section active">
      <div className="page-header">
        <div>
          <div className="ph-title">Signalements <mark>&amp; Sécurité</mark></div>
          <div className="ph-sub">Actions de modération requises</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost btn-sm" onClick={reloadAlerts} disabled={alertsLoading} title="Actualiser">
            {alertsLoading ? '⏳' : '🔄'}
          </button>
          <button className="btn btn-ghost" onClick={handleResolveAll} disabled={alertsLoading || pending === 0}>✅ Tout résoudre</button>
        </div>
      </div>

      {alertsError && (
        <div style={{ margin:'0 0 12px', padding:'10px 14px', background:'rgba(220,38,38,.08)', border:'1px solid rgba(220,38,38,.25)', borderRadius:8, fontSize:12, color:'var(--rose,#dc2626)', display:'flex', alignItems:'center', gap:8 }}>
          <span>⚠️</span> {alertsError}
          <button onClick={reloadAlerts} style={{ marginLeft:'auto', background:'none', border:'1px solid currentColor', borderRadius:5, padding:'2px 8px', fontSize:11, cursor:'pointer', color:'inherit' }}>
            Réessayer
          </button>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
        <div className="fin-card" style={{ borderColor: 'rgba(255,68,100,.15)' }}>
          <div className="fin-label">Critiques</div>
          <div className="fin-val" style={{ color: 'var(--rose)' }}>{criticals}</div>
          <div className="fin-sub">Résolution immédiate</div>
        </div>
        <div className="fin-card" style={{ borderColor: 'rgba(245,166,35,.15)' }}>
          <div className="fin-label">Avertissements</div>
          <div className="fin-val" style={{ color: 'var(--gold)' }}>{warnings}</div>
          <div className="fin-sub">À traiter sous 24h</div>
        </div>
        <div className="fin-card" style={{ borderColor: 'rgba(56,191,255,.15)' }}>
          <div className="fin-label">Informations</div>
          <div className="fin-val" style={{ color: 'var(--sky)' }}>{infos}</div>
          <div className="fin-sub">Pour information</div>
        </div>
        <div className="fin-card" style={{ borderColor: 'rgba(0,200,138,.15)' }}>
          <div className="fin-label">Résolus (7j)</div>
          <div className="fin-val" style={{ color: 'var(--acid)' }}>{resolved7d}</div>
          <div className="fin-sub">Derniers 7 jours</div>
        </div>
      </div>

      {/* Liste complète */}
      <div className="card">
        <div className="card-head">
          <div className="card-title">Signalements en attente</div>
          <span className="badge b-rose">{pending} non traité{pending > 1 ? 's' : ''}</span>
        </div>
        <div className="alert-list">
          {alerts.map(a => (
            <div
              key={a.id}
              className="alert-item"
              style={{ opacity: a.resolved ? 0.45 : 1 }}
            >
              <div
                className="alert-ico"
                style={{
                  background: a.resolved
                    ? 'var(--acid-dim)'
                    : `var(--${a.type === 'critical' ? 'rose' : a.type === 'warning' ? 'gold' : 'sky'}-dim)`,
                }}
              >
                {a.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div className="alert-title">{a.title}</div>
                <div className="alert-sub">{a.sub}</div>
                <div className="alert-time">{a.time}</div>
              </div>
              <div className="alert-actions">
                {!a.resolved ? (
                  <button className="btn btn-ghost btn-xs" onClick={() => handleResolve(a.id)}>
                    ✅ Résoudre
                  </button>
                ) : (
                  <span className="badge b-acid">Résolu</span>
                )}
              </div>
            </div>
          ))}
          {alerts.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--txt-3)' }}>
              ✅ Aucun signalement
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
