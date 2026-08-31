/*
 * FICHIER: src/dashboards/entreprise/pages/OverviewPage.tsx
 * Page principale "Vue d'ensemble" du dashboard Entreprise
 * Contient: Hero, KPIs, Graphiques CA, Top produits, Alertes, Activité
 * Toutes les données viennent de GET /dashboard/entreprise/overview (réel).
 */

import { useState, useEffect } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { EntreprisePage } from '../types';
import { useToast } from '../../../shared/context/ToastContext';
import { apiFetch } from '../../../shared/services/apiFetch';
import './OverviewPage.css';

interface OverviewPageProps {
  onNavigate: (page: EntreprisePage) => void;
}

interface OverviewData {
  zoneNom: string;
  kpis: {
    caCeMois: number; croissanceCA: number;
    commandesCeMois: number; commandesCroissance: number;
    enAttente: number; enCours: number; livrees: number;
    noteMoyenne: number; totalAvis: number;
    abonnes: number;
    retoursCeMois: number; retoursEnTraitement: number; retoursRembourses: number;
    beneficeNet: number; margePct: number; commissionCeMois: number;
  };
  caData: { m: string; v: number }[];
  topProduits: { em: string; nm: string; ventes: number; ca: string; trend: 'up' | 'dn' | 'neu' }[];
  categoryBreakdown: { label: string; pct: number }[];
  dernieresCommandes: { id: string; uuid?: string; em: string; nm: string; vt: string; client: string; price: number; status: string; date: string }[];
  stockAlertes: { em: string; nm: string; qty: number; min: number; type: 'red' | 'amber' }[];
  activite: { icon: string; txt: string; time: string }[];
}

const EMPTY: OverviewData = {
  zoneNom: 'Boutique',
  kpis: {
    caCeMois: 0, croissanceCA: 0, commandesCeMois: 0, commandesCroissance: 0,
    enAttente: 0, enCours: 0, livrees: 0, noteMoyenne: 0, totalAvis: 0,
    abonnes: 0, retoursCeMois: 0, retoursEnTraitement: 0, retoursRembourses: 0,
    beneficeNet: 0, margePct: 0, commissionCeMois: 0,
  },
  caData: [], topProduits: [], categoryBreakdown: [], dernieresCommandes: [],
  stockAlertes: [], activite: [],
};

/** Formate un nombre avec espaces insécables (ex: 12500000 → 12 500 000) */
function fmt(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** KPI card individuelle (sans sparkline — pas de série journalière réelle disponible) */
function KpiCard({
  variant, icon, badge, badgeType, value, label, sub,
}: {
  variant: string; icon: string; badge: string; badgeType: 'up' | 'dn' | 'neu';
  value: string; label: string; sub: string;
}) {
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
    </div>
  );
}

export default function OverviewPage({ onNavigate }: OverviewPageProps) {
  const { t } = useTranslation();
  const { pop } = useToast();
  const navigate = useNavigate();
  const [data, setData]       = useState<OverviewData>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<OverviewData>('/dashboard/entreprise/overview')
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const { kpis, caData, topProduits, categoryBreakdown, dernieresCommandes, stockAlertes, activite } = data;

  /** "Stable" dépend de t(), donc fonction locale plutôt que module-level. */
  function trendBadge(pct: number) {
    if (pct > 0) return { type: 'up' as const, label: `↑ +${pct}%` };
    if (pct < 0) return { type: 'dn' as const, label: `↓ ${pct}%` };
    return { type: 'neu' as const, label: t('overview.hero.stable') };
  }

  const maxCA = Math.max(1, ...caData.map(d => d.v));
  const caTrend = trendBadge(kpis.croissanceCA);
  const cmdTrend = trendBadge(kpis.commandesCroissance);

  let deg = 0;
  const segments = categoryBreakdown.map(c => {
    const start = deg; deg += c.pct * 3.6;
    return `var(--t2) ${start}deg ${deg}deg`;
  });

  const STATUS_LABELS: Record<string, ReactElement> = {
    new:  <span className="s-pill s-new">● {t('overview.orders.status.new')}</span>,
    prep: <span className="s-pill s-prep">⚙ {t('overview.orders.status.prep')}</span>,
    ship: <span className="s-pill s-ship">🚚 {t('overview.orders.status.ship')}</span>,
    del:  <span className="s-pill s-del">✓ {t('overview.orders.status.del')}</span>,
    can:  <span className="s-pill s-can">✕ {t('overview.orders.status.can')}</span>,
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
            {t('overview.hero.badgeActive', { count: kpis.abonnes })}
          </div>
          <div className="hero-title">
            {t('overview.hero.greeting')} <em>{data.zoneNom}</em> 👋<br />
            {loading ? t('overview.hero.loading') : t('overview.hero.ready')}
          </div>
          <div className="hero-sub">
            {caTrend.label} {t('overview.hero.subCA')} · {t('overview.hero.subCommandes', { count: kpis.enAttente })} · {t('overview.hero.subRetours', { count: kpis.retoursEnTraitement })}
          </div>
          <div className="hero-btns">
            <button className="hb1" onClick={() => onNavigate('commandes')}>
              <i className="fas fa-box"></i> {t('overview.hero.btnCommandes')}
            </button>
            <button className="hb2" onClick={() => onNavigate('analytics')}>
              <i className="fas fa-chart-line"></i> {t('overview.hero.btnAnalytics')}
            </button>
            <button className="hb2" onClick={() => onNavigate('promotions')}>
              <i className="fas fa-percent"></i> {t('overview.hero.btnPromotions')}
            </button>
          </div>
        </div>
        <div className="hero-right">
          {[
            { v: fmt(kpis.caCeMois / 1_000_000), u: 'M GNF', l: t('overview.hero.statCA'),        trend: caTrend },
            { v: String(kpis.commandesCeMois),    u: 'cmds', l: t('overview.hero.statCommandes'), trend: cmdTrend },
            { v: kpis.noteMoyenne.toFixed(1),      u: '⭐',   l: t('overview.hero.statNote'),      trend: { type: 'neu' as const, label: t('overview.hero.avis', { count: kpis.totalAvis }) } },
            { v: String(kpis.abonnes),             u: '',     l: t('overview.hero.statAbonnes'),   trend: { type: 'neu' as const, label: t('overview.hero.total') } },
          ].map((s, i) => (
            <div className="hs" key={i}>
              <div className="hs-v">{s.v}</div>
              <div className="hs-u">{s.u}</div>
              <div className="hs-l">{s.l}</div>
              <div className={`hs-trend ${s.trend.type === 'dn' ? 'dn' : 'up'}`}>
                <i className={`fas ${s.trend.type === 'dn' ? 'fa-arrow-trend-down' : 'fa-arrow-trend-up'}`}></i>
                {s.trend.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── KPI GRID ── */}
      <div className="kpi-grid">
        <KpiCard
          variant="k1" icon="💰" badge={caTrend.label} badgeType={caTrend.type}
          value={fmt(kpis.caCeMois)} label={t('overview.kpi.ca')} sub="GNF"
        />
        <KpiCard
          variant="k2" icon="📦" badge={cmdTrend.label} badgeType={cmdTrend.type}
          value={String(kpis.commandesCeMois)} label={t('overview.kpi.commandes')}
          sub={t('overview.kpi.commandesSub', { enAttente: kpis.enAttente, livrees: kpis.livrees, enCours: kpis.enCours })}
        />
        <KpiCard
          variant="k3" icon="🛍️" badge={t('overview.hero.total')} badgeType="neu"
          value={fmt(kpis.abonnes)} label={t('overview.kpi.abonnes')} sub={t('overview.kpi.abonnesSub')}
        />
        <KpiCard
          variant="k4" icon="⭐" badge={t('overview.hero.avis', { count: kpis.totalAvis })} badgeType="neu"
          value={kpis.noteMoyenne.toFixed(1)} label={t('overview.kpi.note')} sub={t('overview.kpi.noteSub', { count: kpis.totalAvis })}
        />
        <KpiCard
          variant="k5" icon="🔄" badge={String(kpis.retoursCeMois)} badgeType="neu"
          value={String(kpis.retoursCeMois)} label={t('overview.kpi.retours')}
          sub={t('overview.kpi.retoursSub', { enTraitement: kpis.retoursEnTraitement, rembourses: kpis.retoursRembourses })}
        />
        <KpiCard
          variant="k6" icon="💸" badge={t('overview.kpi.margeBadge', { marge: kpis.margePct })} badgeType="neu"
          value={fmt(kpis.beneficeNet)} label={t('overview.kpi.benefice')}
          sub={t('overview.kpi.beneficeSub', { marge: kpis.margePct, commission: fmt(kpis.commissionCeMois) })}
        />
      </div>

      {/* ── CA + TOP PRODUITS ── */}
      <div className="g3">
        <div className="card">
          <div className="ch">
            <div className="ch-t"><i className="fas fa-chart-line"></i> {t('overview.charts.caMensuel')}</div>
          </div>
          <div className="cb">
            {caData.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--t3)' }}>{t('overview.charts.noSalesDelivered')}</div>
            )}
            <div className="chart-bars">
              {caData.map((d, i) => (
                <div className="c-bar-wrap" key={i}>
                  <div
                    className="c-bar"
                    style={{
                      height: `${(d.v / maxCA) * 100}%`,
                      background: i === caData.length - 1 ? 'var(--t2)' : 'var(--sky-3)',
                    }}
                  >
                    <div className="c-bar-v">{d.v}M</div>
                  </div>
                  <div className="c-lbl">{d.m}</div>
                </div>
              ))}
            </div>
            <div className="chart-legend">
              <div className="cl-item"><div className="cl-dot" style={{ background: 'var(--t2)' }}></div>{t('overview.charts.legendCurrent')}</div>
              <div className="cl-item"><div className="cl-dot" style={{ background: 'var(--sky-3)' }}></div>{t('overview.charts.legendPrevious')}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="ch">
            <div className="ch-t"><i className="fas fa-trophy"></i> {t('overview.charts.topProduits')}</div>
          </div>
          <div className="cb">
            {topProduits.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--t3)' }}>{t('overview.charts.noSales')}</div>
            )}
            {topProduits.map((p, i) => {
              const mx = Math.max(1, ...topProduits.map(x => x.ventes));
              return (
                <div key={i} className="tp-row">
                  <div className="tp-rank">{i + 1}</div>
                  <div className="tp-em">{p.em}</div>
                  <div className="tp-info">
                    <div className="tp-nm">{p.nm}</div>
                    <div className="tp-bar">
                      <div className="tp-bar-fill" style={{ width: `${(p.ventes / mx) * 100}%` }} />
                    </div>
                  </div>
                  <div className="tp-stats">
                    <div className="tp-ventes">{t('overview.charts.ventes', { count: p.ventes })}</div>
                    <div className={`tp-trend ${p.trend === 'up' ? 'up' : p.trend === 'dn' ? 'dn' : 'neu'}`}>
                      {p.trend === 'up' ? '↑' : p.trend === 'dn' ? '↓' : '—'} {p.ca}
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
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-triangle-exclamation"></i> {t('overview.alerts.title')}</div>
              <span className="ch-badge" style={{ background: 'var(--g100)', color: 'var(--t2)', borderColor: 'rgba(128,128,128,.2)' }}>
                {t('overview.alerts.count', { count: stockAlertes.length })}
              </span>
            </div>
            <div className="cb">
              {stockAlertes.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: 16, color: 'var(--t3)' }}>{t('overview.alerts.empty')}</div>
              )}
              <div className="alert-list">
                {stockAlertes.slice(0, 5).map((a, i) => (
                  <div key={i} className={`alert-item ${a.type}`}>
                    <div className="alert-ic"><i className={`fas ${a.type === 'red' ? 'fa-circle-xmark' : 'fa-triangle-exclamation'}`}></i></div>
                    <div>
                      <div className="alert-nm">{a.em} {a.nm}</div>
                      <div className="alert-sub">{t('overview.alerts.stockInfo', { qty: a.qty, min: a.min })}</div>
                    </div>
                    <button className="alert-fix" onClick={() => onNavigate('produits')}>
                      {t('overview.alerts.fix')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="ch"><div className="ch-t"><i className="fas fa-chart-pie"></i> {t('overview.donut.title')}</div></div>
            <div className="cb">
              {categoryBreakdown.length === 0 && !loading ? (
                <div style={{ textAlign: 'center', padding: 16, color: 'var(--t3)' }}>{t('overview.charts.noSales')}</div>
              ) : (
                <div className="donut-wrap">
                  <div className="donut" style={{ background: `conic-gradient(${segments.join(',')})` }}></div>
                  <div className="donut-legend">
                    {categoryBreakdown.map(c => (
                      <div className="dl-item" key={c.label}>
                        <div className="dl-left"><div className="dl-dot" style={{ background: 'var(--t2)' }}></div>{c.label}</div>
                        <div className="dl-pct">{c.pct}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-box"></i> {t('overview.orders.title')}</div>
              <button className="sh-action" onClick={() => onNavigate('commandes')}>
                {t('overview.orders.seeAll')} <i className="fas fa-arrow-right"></i>
              </button>
            </div>
            <div className="tbl-wrap">
              <table>
                <tbody>
                  {dernieresCommandes.map(o => (
                    <tr
                      key={o.id}
                      onClick={() => o.uuid ? navigate(`/commande/${o.uuid}/suivi`) : pop(`📦 Commande ${o.id}`, 'i')}
                      style={{ cursor: 'pointer' }}
                    >
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
                      <td>{STATUS_LABELS[o.status] ?? o.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {dernieresCommandes.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: 16, color: 'var(--t3)' }}>{t('overview.orders.empty')}</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="ch"><div className="ch-t"><i className="fas fa-timeline"></i> {t('overview.activity.title')}</div></div>
            <div className="cb">
              {activite.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: 16, color: 'var(--t3)' }}>{t('overview.activity.empty')}</div>
              )}
              <div className="act-list">
                {activite.map((a, i) => (
                  <div key={i} className="act-item">
                    <div className="act-dot order"><i className={`fas ${a.icon}`}></i></div>
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
