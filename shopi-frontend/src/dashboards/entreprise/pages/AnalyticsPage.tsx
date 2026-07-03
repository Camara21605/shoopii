/*
 * FICHIER: src/dashboards/entreprise/pages/AnalyticsPage.tsx
 * Page Analytics avancées — graphiques de performance, conversions,
 * trafic, canaux d'acquisition, comparaison périodes.
 */

import React, { useState } from 'react';
import { useToast } from '../../../shared/context/ToastContext';
import { CA_DATA, TOP_PRODS } from '../data/mockData';

/** Données de trafic mensuel (visites) */
const TRAFFIC_DATA = [
  { m: 'Aoû', visites: 3200, conv: 2.1 },
  { m: 'Sep', visites: 4100, conv: 2.4 },
  { m: 'Oct', visites: 3800, conv: 2.2 },
  { m: 'Nov', visites: 5200, conv: 2.8 },
  { m: 'Déc', visites: 4900, conv: 2.6 },
  { m: 'Jan', visites: 6100, conv: 3.1 },
];

/** Sources de trafic */
const SOURCES: [string, number, string, string][] = [
  ['Recherche organique', 38, 'var(--blue)',    '↑ +12%'],
  ['Réseaux sociaux',     26, 'var(--violet)',  '↑ +28%'],
  ['Accès direct',        19, 'var(--emerald)', '→ Stable'],
  ['Publicité payante',   11, 'var(--amber)',   '↑ +5%'],
  ['Email marketing',      6, 'var(--rose)',    '↓ −3%'],
];

/** Performances par catégorie */
const PERF_CATS = [
  { cat: 'Smartphones',   ca: 55.1, orders: 109, conv: 3.8, trend: 'up' },
  { cat: 'Ordinateurs',   ca: 39.2, orders:  75, conv: 2.9, trend: 'up' },
  { cat: 'Audio & Vidéo', ca: 26.3, orders:  52, conv: 3.2, trend: 'up' },
  { cat: 'Gaming',        ca: 14.5, orders:  30, conv: 2.1, trend: 'dn' },
  { cat: 'Accessoires',   ca: 10.1, orders:  21, conv: 4.1, trend: 'neu'},
];

export default function AnalyticsPage() {
  const { pop } = useToast();
  const [period, setPeriod] = useState('6 mois');

  const maxTraffic = Math.max(...TRAFFIC_DATA.map(d => d.visites));
  const maxCA      = Math.max(...CA_DATA.map(d => d.v));

  // Calcul donut sources
  let deg = 0;
  const srcSegments = SOURCES.map(([, pct, color]) => {
    const start = deg; deg += pct * 3.6;
    return `${color} ${start}deg ${deg}deg`;
  });

  return (
    <div className="page on" id="p-analytics">

      {/* ── KPIs ── */}
      <div className="kpi-grid">
        {[
          { ic: '👁️',  v: '6 100',     l: 'Visites ce mois',    sub: '+24% vs déc.',  color: 'var(--blue)',    k: 'k1' },
          { ic: '🛒',  v: '3.1%',      l: 'Taux de conversion', sub: '+0.5 pts',      color: 'var(--emerald)', k: 'k2' },
          { ic: '⏱️',  v: '3m 42s',    l: 'Durée moy. session', sub: '+18s vs déc.',  color: 'var(--amber)',   k: 'k3' },
          { ic: '📉',  v: '41.2%',     l: 'Taux de rebond',     sub: '↓ −3.1 pts',   color: 'var(--violet)',  k: 'k4' },
        ].map((s, i) => (
          <div key={i} className={`kpi ${s.k}`}>
            <div className="kpi-stripe"></div>
            <div className="kpi-top">
              <div className="kpi-icon">{s.ic}</div>
              <span className="kpi-badge up">{s.sub}</span>
            </div>
            <div className="kpi-val">{s.v}</div>
            <div className="kpi-lbl">{s.l}</div>
          </div>
        ))}
      </div>

      {/* ── Graphiques CA + Trafic ── */}
      <div className="g2">
        {/* CA mensuel */}
        <div className="card">
          <div className="ch">
            <div className="ch-t"><i className="fas fa-chart-line"></i> Chiffre d'affaires</div>
            <div className="sh-tabs">
              {['6 mois', '12 mois', 'Tout'].map(t => (
                <button
                  key={t}
                  className={`sh-tab${period === t ? ' on' : ''}`}
                  onClick={() => { setPeriod(t); pop('📊 Période mise à jour', 'i'); }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="cb">
            <div className="chart-bars">
              {CA_DATA.map((d, i) => (
                <div className="c-bar-wrap" key={i}>
                  <div
                    className="c-bar"
                    style={{
                      height: `${(d.v / maxCA) * 100}%`,
                      background: i === CA_DATA.length - 1 ? 'var(--blue)' : 'var(--sky-3)',
                    }}
                  >
                    <div className="c-bar-v">{d.v}M</div>
                  </div>
                  <div className="c-lbl">{d.m}</div>
                </div>
              ))}
            </div>
            <div className="chart-legend">
              <div className="cl-item"><div className="cl-dot" style={{ background: 'var(--blue)' }}></div>CA mensuel (M GNF)</div>
              <div className="cl-item"><div className="cl-dot" style={{ background: 'var(--sky-3)' }}></div>Périodes passées</div>
            </div>
          </div>
        </div>

        {/* Trafic mensuel */}
        <div className="card">
          <div className="ch">
            <div className="ch-t"><i className="fas fa-chart-bar"></i> Trafic — Visites</div>
            <span className="ch-badge">Jan 2025</span>
          </div>
          <div className="cb">
            <div className="chart-bars">
              {TRAFFIC_DATA.map((d, i) => (
                <div className="c-bar-wrap" key={i}>
                  <div
                    className="c-bar"
                    style={{
                      height: `${(d.visites / maxTraffic) * 100}%`,
                      background: i === TRAFFIC_DATA.length - 1 ? 'var(--violet)' : 'rgba(124,58,237,.3)',
                    }}
                  >
                    <div className="c-bar-v">{d.visites.toLocaleString()}</div>
                  </div>
                  <div className="c-lbl">{d.m}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>
              <span>Taux de conversion moyen: <strong style={{ color: 'var(--navy)' }}>3.1%</strong></span>
              <span>+24% de visites vs déc.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sources + Performances catégories ── */}
      <div className="g3r">
        {/* Sources de trafic */}
        <div className="card">
          <div className="ch">
            <div className="ch-t"><i className="fas fa-chart-pie"></i> Sources de trafic</div>
          </div>
          <div className="cb">
            <div className="donut-wrap" style={{ marginBottom: 18 }}>
              <div
                className="donut"
                style={{ background: `conic-gradient(${srcSegments.join(',')})` }}
              ></div>
              <div className="donut-legend">
                {SOURCES.map(([label, pct, color, trend]) => (
                  <div className="dl-item" key={label}>
                    <div className="dl-left">
                      <div className="dl-dot" style={{ background: color }}></div>
                      {label}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: trend.startsWith('↑') ? 'var(--emerald)' : trend.startsWith('↓') ? 'var(--red)' : 'var(--t3)' }}>{trend}</span>
                      <div className="dl-pct">{pct}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Performances par catégorie */}
        <div className="card">
          <div className="ch">
            <div className="ch-t"><i className="fas fa-table-list"></i> Performances par catégorie</div>
            <button className="sh-action" onClick={() => pop('📥 Export analytics', 's')}>
              <i className="fas fa-download"></i> Exporter
            </button>
          </div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Catégorie</th>
                  <th>CA (M GNF)</th>
                  <th>Commandes</th>
                  <th>Conv. %</th>
                  <th>Tendance</th>
                </tr>
              </thead>
              <tbody>
                {PERF_CATS.map((c, i) => (
                  <tr key={i} onClick={() => pop(`📊 Analyse: ${c.cat}`, 'i')}>
                    <td><div className="td-nm">{c.cat}</div></td>
                    <td><div className="td-price">{c.ca}M</div></td>
                    <td style={{ fontSize: 12, color: 'var(--t2)' }}>{c.orders}</td>
                    <td>
                      <span style={{
                        background: c.conv >= 3 ? 'var(--em-bg)' : 'var(--am-bg)',
                        color: c.conv >= 3 ? 'var(--emerald)' : 'var(--amber)',
                        padding: '2px 8px', borderRadius: 'var(--pill)', fontSize: 11, fontWeight: 700,
                      }}>{c.conv}%</span>
                    </td>
                    <td>
                      <span style={{
                        color: c.trend === 'up' ? 'var(--emerald)' : c.trend === 'dn' ? 'var(--red)' : 'var(--t3)',
                        fontWeight: 700, fontSize: 12,
                      }}>
                        {c.trend === 'up' ? '↑ Hausse' : c.trend === 'dn' ? '↓ Baisse' : '→ Stable'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Top produits + Funnel ── */}
      <div className="g2">
        {/* Top produits vue analytics */}
        <div className="card">
          <div className="ch">
            <div className="ch-t"><i className="fas fa-trophy"></i> Top produits — Ventes</div>
          </div>
          <div className="cb">
            {TOP_PRODS.map((p, i) => {
              const mx = Math.max(...TOP_PRODS.map(x => x.ventes));
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--blue)', width: 18, textAlign: 'right', fontFamily: 'var(--fd)' }}>
                    #{i + 1}
                  </div>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#EEF3FD,#DAE4FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{p.em}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>{p.nm}</div>
                    <div style={{ background: 'var(--g200)', borderRadius: 'var(--pill)', height: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${(p.ventes / mx) * 100}%`, height: '100%', background: 'var(--blue)', borderRadius: 'var(--pill)', transition: 'width 0.8s var(--ease)' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 70 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)', fontFamily: 'var(--fd)' }}>{p.ventes} ventes</div>
                    <div style={{ fontSize: 10, color: p.trend === 'up' ? 'var(--green)' : p.trend === 'dn' ? 'var(--red)' : 'var(--t3)' }}>{p.ca}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Funnel de conversion */}
        <div className="card">
          <div className="ch">
            <div className="ch-t"><i className="fas fa-filter"></i> Entonnoir de conversion</div>
            <span className="ch-badge">Janv. 2025</span>
          </div>
          <div className="cb">
            {[
              { label: 'Visites totales',     n: 6100,  pct: 100, color: 'var(--blue)' },
              { label: 'Pages produit vues',  n: 3050,  pct:  50, color: 'var(--violet)' },
              { label: 'Ajouts au panier',    n:  890,  pct:  14, color: 'var(--amber)' },
              { label: 'Passages en caisse',  n:  380,  pct: 6.2, color: 'var(--teal)' },
              { label: 'Commandes validées',  n:  189,  pct: 3.1, color: 'var(--emerald)' },
            ].map((f, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                  <span style={{ fontWeight: 600, color: 'var(--t2)' }}>{f.label}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontWeight: 800, color: f.color, fontFamily: 'var(--fd)' }}>{f.n.toLocaleString()}</span>
                    <span style={{ color: 'var(--t3)', fontSize: 10 }}>{f.pct}%</span>
                  </div>
                </div>
                <div style={{ background: 'var(--g100)', borderRadius: 'var(--pill)', height: 9, overflow: 'hidden' }}>
                  <div style={{ width: `${f.pct}%`, height: '100%', background: f.color, borderRadius: 'var(--pill)', transition: 'width 0.9s var(--ease)', opacity: 0.85 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}