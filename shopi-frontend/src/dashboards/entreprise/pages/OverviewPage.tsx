/*
 * FICHIER: src/dashboards/entreprise/pages/OverviewPage.tsx
 * Page principale "Vue d'ensemble" du dashboard Entreprise
 * Contient: Hero, KPIs, Graphiques CA, Top produits, Alertes, Activité
 */

import React from 'react';
import type { EntreprisePage } from '../types';
import { useToast } from '../../../shared/context/ToastContext';
import { CA_DATA, TOP_PRODS, ORDERS, STOCK_ALERTS, ACTIVITY } from '../data/mockData';
import './OverviewPage.css';

interface OverviewPageProps {
  onNavigate: (page: EntreprisePage) => void;
}

/** Formate un nombre avec espaces insécables (ex: 12500000 → 12 500 000) */
function fmt(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F');
}

/** KPI card individuelle */
function KpiCard({
  variant, icon, badge, badgeType, value, label, sub, sparkData, sparkColor
}: {
  variant: string; icon: string; badge: string; badgeType: 'up'|'dn'|'neu';
  value: string; label: string; sub: string;
  sparkData?: number[]; sparkColor?: string;
}) {
  const max = sparkData ? Math.max(...sparkData) : 1;
  return (
    <div className={`kpi ${variant}`}>
      <div className="kpi-stripe"></div>
      <div className="kpi-top">
        <div className="kpi-icon">{icon}</div>
        <span className={`kpi-badge ${badgeType}`}>{badge}</span>
      </div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-lbl">{label}</div>
      <div className="kpi-sub">{sub}</div>
      {sparkData && (
        <div className="kpi-spark">
          {sparkData.map((v, i) => (
            <div
              key={i}
              className="kpi-sp-b"
              style={{ height: `${(v / max) * 100}%`, background: sparkColor }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OverviewPage({ onNavigate }: OverviewPageProps) {
  const { pop } = useToast();

  // Données sparklines KPIs
  const SPARK1 = [60,72,65,90,82,89,98,112,89,135,118,145];
  const SPARK2 = [180,210,195,240,220,260,245,270,255,290,280,287];
  const SPARK3 = [8000,9200,8800,10200,9800,10900,11100,11400,11000,11800,11900,12429];
  const SPARK4 = [4.6,4.7,4.7,4.8,4.7,4.8,4.8,4.9,4.8,4.9,4.9,4.9];

  // Calcul des barres CA
  const maxCA = Math.max(...CA_DATA.map(d => d.v));

  // Répartition des ventes (donut)
  const CATS: [string, number, string][] = [
    ['Smartphones', 38, 'var(--blue)'],
    ['Ordinateurs',  27, 'var(--violet)'],
    ['Audio & Vidéo',18, 'var(--teal)'],
    ['Gaming',       10, 'var(--amber)'],
    ['Accessoires',   7, 'var(--rose)'],
  ];
  let deg = 0;
  const segments = CATS.map(([, p, c]) => {
    const start = deg; deg += p * 3.6;
    return `${c} ${start}deg ${deg}deg`;
  });

  const STATUS_LABELS: Record<string, JSX.Element> = {
    new:  <span className="s-pill s-new">● Nouveau</span>,
    prep: <span className="s-pill s-prep">⚙ En prépa</span>,
    ship: <span className="s-pill s-ship">🚚 Livraison</span>,
    del:  <span className="s-pill s-del">✓ Livré</span>,
    can:  <span className="s-pill s-can">✕ Annulé</span>,
  };

  return (
    <div className="page on" id="p-overview">

      {/* ── HERO ── */}
      <div className="hero">
        <div className="hero-bg"></div>
        <div className="hero-grid"></div>
        <div className="hero-left">
          <div className="hero-badge">
            <span></span>
            Boutique active · 12 429 abonnés · Rang #3 Électronique
          </div>
          <div className="hero-title">
            Bonjour, <em>TechStore</em> 👋<br />
            Performances excellentes ce mois.
          </div>
          <div className="hero-sub">
            +23% de chiffre d'affaires · 14 commandes à traiter · 3 retours en attente · Score SEO 78/100
          </div>
          <div className="hero-btns">
            <button className="hb1" onClick={() => onNavigate('commandes')}>
              <i className="fas fa-box"></i> Traiter les commandes
            </button>
            <button className="hb2" onClick={() => onNavigate('analytics')}>
              <i className="fas fa-chart-line"></i> Voir analytics
            </button>
            <button className="hb2" onClick={() => onNavigate('promotions')}>
              <i className="fas fa-percent"></i> Promotions
            </button>
          </div>
        </div>
        <div className="hero-right">
          {[
            { v: '145', u: 'GNF', l: 'CA ce mois', trend: '+23%', up: true, suffix: 'M' },
            { v: '287', u: 'cmds', l: 'Commandes',  trend: '+18%', up: true },
            { v: '4.9', u: '⭐',  l: 'Note moy.',  trend: 'Stable', up: true },
            { v: '78',  u: 'SEO', l: 'Score santé', trend: '+5pts', up: true, suffix: '%' },
          ].map((s, i) => (
            <div className="hs" key={i}>
              <div className="hs-v">
                {s.v}
                {s.suffix && <span style={{ fontSize: 14 }}>{s.suffix}</span>}
              </div>
              <div className="hs-u">{s.u}</div>
              <div className="hs-l">{s.l}</div>
              <div className={`hs-trend ${s.up ? 'up' : 'dn'}`}>
                <i className={`fas ${s.up ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}`}></i>
                {s.trend}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── KPI GRID ── */}
      <div className="kpi-grid">
        <KpiCard
          variant="k1" icon="💰" badge="↑ +23%" badgeType="up"
          value="145 250 000" label="Chiffre d'affaires — Janvier 2025" sub="GNF · vs 118M en décembre"
          sparkData={SPARK1} sparkColor="var(--blue)"
        />
        <KpiCard
          variant="k2" icon="📦" badge="↑ +18%" badgeType="up"
          value="287" label="Commandes ce mois" sub="14 en attente · 243 livrées · 30 en cours"
          sparkData={SPARK2} sparkColor="var(--emerald)"
        />
        <KpiCard
          variant="k3" icon="🛍️" badge="↑ +11%" badgeType="up"
          value="12 429" label="Abonnés boutique" sub="+1 240 nouveaux ce mois"
          sparkData={SPARK3} sparkColor="var(--amber)"
        />
        <KpiCard
          variant="k4" icon="⭐" badge="+0.1 pts" badgeType="up"
          value="4.9" label="Note moyenne clients" sub="248 avis · 97% satisfaction"
          sparkData={SPARK4} sparkColor="var(--violet)"
        />
        <KpiCard
          variant="k5" icon="🔄" badge="2.1%" badgeType="neu"
          value="6" label="Retours ce mois" sub="3 en traitement · 3 remboursés"
        />
        <KpiCard
          variant="k6" icon="💸" badge="↑ +31%" badgeType="up"
          value="58 200 000" label="Bénéfice net estimé" sub="Marge: 40% · Commissions: 4 350 000 GNF"
        />
      </div>

      {/* ── CA + TOP PRODUITS ── */}
      <div className="g3">
        {/* Graphique CA mensuel */}
        <div className="card">
          <div className="ch">
            <div className="ch-t"><i className="fas fa-chart-line"></i> Chiffre d'affaires mensuel</div>
            <div className="sh-tabs">
              {['6 mois','12 mois','Tout'].map(t => (
                <button
                  key={t}
                  className={`sh-tab${t === '6 mois' ? ' on' : ''}`}
                  onClick={e => {
                    document.querySelectorAll('.sh-tabs .sh-tab').forEach(b => b.classList.remove('on'));
                    (e.target as HTMLButtonElement).classList.add('on');
                    pop('📊 Période mise à jour', 'i');
                  }}
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
              <div className="cl-item"><div className="cl-dot" style={{ background: 'var(--blue)' }}></div>CA mensuel (Millions GNF)</div>
              <div className="cl-item"><div className="cl-dot" style={{ background: 'var(--sky-3)' }}></div>Périodes précédentes</div>
            </div>
          </div>
        </div>

        {/* Top produits */}
        <div className="card">
          <div className="ch">
            <div className="ch-t"><i className="fas fa-trophy"></i> Top produits</div>
            <span className="ch-badge">Jan 2025</span>
          </div>
          <div className="cb">
            {TOP_PRODS.map((p, i) => {
              const mx = Math.max(...TOP_PRODS.map(x => x.ventes));
              return (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--t4)', width:14, textAlign:'right' }}>{i+1}</div>
                  <div style={{ width:30, height:30, borderRadius:8, background:'linear-gradient(135deg,#EEF3FD,#DAE4FF)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>{p.em}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--navy)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.nm}</div>
                    <div style={{ background:'var(--g200)', borderRadius:'var(--pill)', height:4, marginTop:4, overflow:'hidden' }}>
                      <div style={{ width:`${(p.ventes/mx)*100}%`, height:'100%', background:'var(--blue-3)', borderRadius:'var(--pill)' }} />
                    </div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:11.5, fontWeight:700, color:'var(--navy)', fontFamily:'var(--fd)' }}>{p.ventes} ventes</div>
                    <div style={{ fontSize:10, color: p.trend==='up'?'var(--green)':p.trend==='dn'?'var(--red)':'var(--t3)' }}>
                      {p.trend==='up'?'↑':p.trend==='dn'?'↓':'—'} {p.ca}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── ALERTES + DONUT + COMMANDES + ACTIVITÉ ── */}
      <div className="g3r">
        <div>
          {/* Alertes de stock */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-triangle-exclamation"></i> Alertes prioritaires</div>
              <span className="ch-badge" style={{ background:'var(--rs-bg)', color:'var(--rose)', borderColor:'rgba(225,29,72,.2)' }}>
                9 alertes
              </span>
            </div>
            <div className="cb">
              <div className="alert-list">
                {STOCK_ALERTS.slice(0, 5).map((a, i) => (
                  <div key={i} className={`alert-item ${a.type}`}>
                    <div className="alert-ic"><i className={`fas ${a.type==='red'?'fa-circle-xmark':'fa-triangle-exclamation'}`}></i></div>
                    <div>
                      <div className="alert-nm">{a.em} {a.nm}</div>
                      <div className="alert-sub">Stock: {a.qty} · Min requis: {a.min}</div>
                    </div>
                    <button className="alert-fix" onClick={() => pop('📦 Réappro lancée', 's')}>
                      Réappro
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Donut répartition */}
          <div className="card">
            <div className="ch"><div className="ch-t"><i className="fas fa-chart-pie"></i> Répartition des ventes</div></div>
            <div className="cb">
              <div className="donut-wrap">
                <div
                  className="donut"
                  style={{ background: `conic-gradient(${segments.join(',')})` }}
                ></div>
                <div className="donut-legend">
                  {CATS.map(([l, p, c]) => (
                    <div className="dl-item" key={l}>
                      <div className="dl-left"><div className="dl-dot" style={{ background: c }}></div>{l}</div>
                      <div className="dl-pct">{p}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          {/* Dernières commandes */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-box"></i> Dernières commandes</div>
              <button className="sh-action" onClick={() => onNavigate('commandes')}>
                Tout voir <i className="fas fa-arrow-right"></i>
              </button>
            </div>
            <div className="tbl-wrap">
              <table>
                <tbody>
                  {ORDERS.slice(0, 4).map(o => (
                    <tr key={o.id} onClick={() => pop(`📦 Commande ${o.id}`, 'i')}>
                      <td>
                        <div className="td-prod">
                          <div className="td-em">{o.em}</div>
                          <div>
                            <div className="td-nm">{o.nm}</div>
                            <div className="td-var">{o.vt}</div>
                          </div>
                        </div>
                      </td>
                      <td><div className="td-client">{o.client}</div></td>
                      <td><div className="td-price">{fmt(o.price)} GNF</div></td>
                      <td>{STATUS_LABELS[o.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Activité récente */}
          <div className="card">
            <div className="ch"><div className="ch-t"><i className="fas fa-timeline"></i> Activité récente</div></div>
            <div className="cb">
              <div className="act-list">
                {ACTIVITY.map((a, i) => (
                  <div key={i} className="act-item">
                    <div className={`act-dot ${a.type}`}><i className={`fas ${a.icon}`}></i></div>
                    <div className="act-txt" dangerouslySetInnerHTML={{ __html: a.txt }} />
                    <div className="act-time">{a.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}