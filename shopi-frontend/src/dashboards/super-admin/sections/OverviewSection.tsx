// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/sections/OverviewSection.tsx
//
// Section "Vue d'ensemble" : KPIs utilisateurs, KPIs produits/commandes,
// graphique inscriptions 14j, répartition par rôle (bar + donut),
// alertes récentes, accès rapides.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import type { SuperAdminStore } from '../hooks/useSuperAdminState';

interface Props {
  store: SuperAdminStore;
  toast: (type: string, msg: string) => void;
  isActive: boolean;
}

const ROLE_LBL: Record<string, string> = {
  company: '🏪 Entreprise', delivery: '🛵 Livreur', customer: '🛒 Client',
  partner: '🤝 Partenaire', admin: '🛡 Admin', correspondent: '📦 Correspondant',
};
const AV_COLORS: Record<string, [string, string]> = {
  company: ['#38BFFF', '#07243A'], delivery: ['#F5A623', '#301E05'],
  customer: ['#00C88A', '#052818'], partner: ['#BF7FFF', '#1E0D33'],
  admin: ['#FF4464', '#330B14'], correspondent: ['#607898', '#0F1824'],
};
const FLAGS: Record<string, string> = { GN: '🇬🇳', SN: '🇸🇳', ML: '🇲🇱', CI: '🇨🇮' };

export default function OverviewSection({ store, toast, isActive }: Props) {
  const mainChartRef = useRef<SVGSVGElement>(null);
  const donutRef = useRef<SVGSVGElement>(null);

  const users = store.users;
  const total = users.length;
  const companies = users.filter(u => u.role === 'company' && u.status === 'active').length;
  const deliverers = users.filter(u => u.role === 'delivery' && u.status === 'active').length;
  const customers = users.filter(u => u.role === 'customer').length;
  const blocked = users.filter(u => u.status === 'blocked' || u.status === 'suspended').length;
  const partners = users.filter(u => u.role === 'partner').length;
  const active = users.filter(u => u.status === 'active').length;

  const roles = [
    { key: 'customer', label: 'Clients', icon: '🛒', color: 'var(--acid)' },
    { key: 'company', label: 'Entreprises', icon: '🏪', color: 'var(--sky)' },
    { key: 'delivery', label: 'Livreurs', icon: '🛵', color: 'var(--gold)' },
    { key: 'partner', label: 'Partenaires', icon: '🤝', color: 'var(--violet)' },
    { key: 'correspondent', label: 'Correspondants', icon: '📦', color: 'var(--coral)' },
    { key: 'admin', label: 'Admins', icon: '🛡', color: 'var(--rose)' },
  ];

  // Draw main chart
  useEffect(() => {
    if (!isActive || !mainChartRef.current) return;
    const svg = mainChartRef.current;
    const W = 760, H = 180, pL = 10, pR = 10, pT = 20, pB = 10;
    const gW = W - pL - pR, gH = H - pT - pB, days = 14;
    const data = Array.from({ length: days }, () => 3 + Math.floor(Math.random() * 14));
    data[days - 1] = 9;
    const mx = Math.max(...data) + 3;
    const toX = (i: number) => pL + (i / (days - 1)) * gW;
    const toY = (v: number) => pT + gH - (v / mx) * gH;
    const path = 'M' + data.map((d, i) => `${toX(i)},${toY(d)}`).join('L');
    const area = path + `L${toX(days - 1)},${pT + gH}L${toX(0)},${pT + gH}Z`;
    svg.innerHTML = `
      <defs>
        <linearGradient id="ga1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#00C88A" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#00C88A" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="gl1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#38BFFF"/>
          <stop offset="100%" stop-color="#00C88A"/>
        </linearGradient>
      </defs>
      ${[0, .25, .5, .75, 1].map(p => `<line x1="${pL}" y1="${pT + gH * p}" x2="${W - pR}" y2="${pT + gH * p}" stroke="rgba(128,128,128,0.07)" stroke-width="1"/>`).join('')}
      <path d="${area}" fill="url(#ga1)"/>
      <path d="${path}" fill="none" stroke="url(#gl1)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${data.map((d, i) => {
        const x = toX(i), y = toY(d), last = i === days - 1;
        return `<circle cx="${x}" cy="${y}" r="${last ? 5 : 2.5}" fill="${last ? '#00C88A' : 'var(--surface)'}" stroke="${last ? '#00C88A' : '#38BFFF'}" stroke-width="${last ? 0 : 1.5}"/>
          ${last ? `<circle cx="${x}" cy="${y}" r="12" fill="rgba(0,200,138,0.12)"/><text x="${x}" y="${y - 12}" text-anchor="middle" fill="#00C88A" font-size="10" font-family="Space Mono" font-weight="700">${d}</text>` : ''}`;
      }).join('')}
    `;
  }, [isActive]);

  // Draw donut
  useEffect(() => {
    if (!isActive || !donutRef.current) return;
    const donutRoles = [
      { key: 'customer', color: '#00C88A' }, { key: 'company', color: '#38BFFF' },
      { key: 'delivery', color: '#F5A623' }, { key: 'partner', color: '#BF7FFF' },
      { key: 'admin', color: '#FF4464' }, { key: 'correspondent', color: '#FF7043' },
    ];
    const R = 50, cx = 60, cy = 60, stroke = 14;
    let offset = 0;
    const circ = 2 * Math.PI * R;
    let segs = '';
    donutRoles.forEach(r => {
      const cnt = users.filter(u => u.role === r.key).length;
      const pct = total ? cnt / total : 0;
      const dash = pct * circ;
      const gap = circ - dash;
      segs += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${r.color}" stroke-width="${stroke}"
        stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-offset * circ}" transform="rotate(-90 ${cx} ${cy})" opacity="0.85"/>`;
      offset += pct;
    });
    donutRef.current.innerHTML = segs + `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="var(--txt-1)" font-family="Cabinet Grotesk" font-weight="900" font-size="16">${total}</text>`;
  }, [isActive, users, total]);

  const chartLabels = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  });

  const pendingAlerts = store.alerts.filter(a => !a.resolved).slice(0, 3);

  if (!isActive) return null;

  return (
    <div className="section active">
      <div className="page-header">
        <div>
          <div className="ph-title">Vue <mark>d'Ensemble</mark></div>
          <div className="ph-sub">Tableau de bord Shopi Africa — temps réel</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => toast('success', '⬇ Export CSV en cours…')}>
            ⬇ Export CSV
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => store.navigate('invitations')}>
            + Code d'invitation
          </button>
        </div>
      </div>

      {/* KPI row utilisateurs */}
      <div className="kpi-row">
        {[
          { id: 'total', label: 'Total Comptes', ico: '👥', val: total, color: 'acid', trend: '↑ +3% cette semaine', tClass: 'up' },
          { id: 'comp', label: 'Entreprises', ico: '🏪', val: companies, color: 'sky', trend: '↑ actives', tClass: 'up' },
          { id: 'del', label: 'Livreurs', ico: '🛵', val: deliverers, color: 'gold', trend: '↑ en service', tClass: 'up' },
          { id: 'cust', label: 'Clients', ico: '🛒', val: customers, color: 'acid', trend: `↑ +2 aujourd'hui`, tClass: 'up' },
          { id: 'blocked', label: 'Bloqués', ico: '🚫', val: blocked, color: 'rose', trend: blocked ? `⚠️ ${blocked} actifs` : 'Aucun', tClass: 'flat' },
          { id: 'partner', label: 'Partenaires', ico: '🤝', val: partners, color: 'violet', trend: 'zones couvertes', tClass: 'up' },
        ].map(k => (
          <div key={k.id} className={`kpi ${k.color}`}>
            <div className="kpi-top">
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-ico">{k.ico}</div>
            </div>
            <div className="kpi-val">{k.val.toLocaleString('fr')}</div>
            <div className="kpi-foot">
              <span className={`kpi-trend ${k.tClass}`}>{k.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Produits & Commandes */}
      <div className="prod-order-row">
        <div className="stat-big-card green">
          <div className="stat-big-label">Total Produits</div>
          <div className="stat-big-val" style={{ color: 'var(--acid)' }}>1 247</div>
          <div className="stat-big-sub">Produits actifs sur la plateforme</div>
          <div className="stat-big-trend" style={{ color: 'var(--acid)' }}>↑ +47 ce mois</div>
          <div className="stat-big-ico">📦</div>
        </div>
        <div className="stat-big-card blue">
          <div className="stat-big-label">Total Commandes</div>
          <div className="stat-big-val" style={{ color: 'var(--sky)' }}>8 432</div>
          <div className="stat-big-sub">Commandes depuis le lancement</div>
          <div className="stat-big-trend" style={{ color: 'var(--sky)' }}>↑ +238 cette semaine</div>
          <div className="stat-big-ico">🛍</div>
        </div>
      </div>

      {/* Graphique + Répartition */}
      <div className="overview-grid">
        <div className="overview-left">
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Inscriptions — 14 derniers jours</div>
                <div className="card-sub">{total} inscrits</div>
              </div>
              <span className="badge b-acid">{active} actifs</span>
            </div>
            <div className="chart-wrap">
              <svg ref={mainChartRef} className="svg-chart" viewBox="0 0 760 180" height={180} preserveAspectRatio="none" />
            </div>
            <div className="chart-labels">
              {chartLabels.map((l, i) => <span key={i}>{l}</span>)}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="card-title">Répartition par rôle</div>
              <span className="badge b-sky">Tous les comptes</span>
            </div>
            <div className="role-breakdown">
              {roles.map(r => {
                const cnt = users.filter(u => u.role === r.key).length;
                const pct = total ? Math.round(cnt / total * 100) : 0;
                return (
                  <div key={r.key} className="rb-item">
                    <span className="rb-ico">{r.icon}</span>
                    <span className="rb-name">{r.label}</span>
                    <div className="rb-bar">
                      <div className="rb-fill" style={{ background: r.color, width: `${pct}%` }} />
                    </div>
                    <span className="rb-val">{cnt}</span>
                    <span className="rb-pct">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="overview-right">
          <div className="card">
            <div className="card-head">
              <div className="card-title">Répartition rôles</div>
              <span className="badge b-muted">Donut</span>
            </div>
            <div className="donut-wrap">
              <svg ref={donutRef} viewBox="0 0 120 120" width={120} height={120} />
              <div className="donut-legend">
                {[
                  { key: 'customer', color: '#00C88A' }, { key: 'company', color: '#38BFFF' },
                  { key: 'delivery', color: '#F5A623' }, { key: 'partner', color: '#BF7FFF' },
                  { key: 'admin', color: '#FF4464' }, { key: 'correspondent', color: '#FF7043' },
                ].map(r => (
                  <div key={r.key} className="donut-leg-item">
                    <div className="donut-leg-left">
                      <div className="donut-leg-dot" style={{ background: r.color }} />
                      <span>{ROLE_LBL[r.key] || r.key}</span>
                    </div>
                    <span className="donut-leg-val">{users.filter(u => u.role === r.key).length}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Alertes récentes */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">Signalements récents</div>
              <span className="badge b-rose">{pendingAlerts.length}</span>
            </div>
            <div>
              {pendingAlerts.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 14 }}>{a.icon}</span>
                  <div style={{ flex: 1, fontSize: 11.5 }}>
                    <div style={{ fontWeight: 700 }}>{a.title}</div>
                    <div style={{ color: 'var(--txt-3)', fontSize: 10, marginTop: 2 }}>{a.time}</div>
                  </div>
                  <button className="btn btn-ghost btn-xs" onClick={() => store.resolveAlert(a.id)}>✓</button>
                </div>
              ))}
              {!pendingAlerts.length && (
                <div style={{ padding: '16px 20px', fontSize: 12, color: 'var(--txt-2)' }}>
                  ✅ Aucun signalement en attente
                </div>
              )}
            </div>
          </div>

          {/* Accès rapides */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">Accès rapides</div>
            </div>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => store.navigate('invitations')}>
                🎫 Générer codes invitation
              </button>
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => store.navigate('messaging')}>
                💬 Messagerie admin
              </button>
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => toast('success', '⬇ Export utilisateurs CSV')}>
                ⬇ Export utilisateurs CSV
              </button>
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => store.navigate('audit')}>
                📜 Journal d'audit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}