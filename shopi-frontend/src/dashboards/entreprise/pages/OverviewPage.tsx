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
import { useTeamPermissions } from '../hooks/useTeamPermissions';
import './OverviewPage.css';
import st from './OverviewDash.module.css';

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
  activite: { icon: string; txt: string; highlight?: string; time: string }[];
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

/** Montant lisible : 450 000 · 12,5 M · 1,2 Md (le CA d'un petit mois reste exact). */
function fmtMontant(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace('.', ',').replace(',0', '')} Md`;
  if (n >= 10_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '')} M`;
  return fmt(n);
}

/** Nuances de l'anneau de répartition (monochrome, lisibles en clair comme en sombre). */
const DONUT = ['var(--t1)', 'var(--t3)', 'var(--t4)', 'var(--g300)', 'var(--g200)'];

interface KpiCard {
  ico: string; lbl: string; val: string; unit: string; go: EntreprisePage;
  trend?: { type: 'up' | 'dn' | 'neu'; label: string }; star?: boolean; note?: string;
}

function Empty({ ico, txt }: { ico: string; txt: string }) {
  return (
    <div className={st.empty}>
      <span className={st.emptyIco}><i className={`fas ${ico}`} aria-hidden="true" /></span>
      {txt}
    </div>
  );
}

/* Met en gras `highlight` dans `texte` via JSX (échappé par React) — pas de
 * dangerouslySetInnerHTML : le texte peut contenir le nom d'un client saisi
 * librement sur son avis (voir entreprise-dashboard.service.ts::buildActivite). */
function ActiviteTxt({ txt, highlight }: { txt: string; highlight?: string }) {
  if (!highlight) return <>{txt}</>;
  const idx = txt.indexOf(highlight);
  if (idx === -1) return <>{txt}</>;
  return <>{txt.slice(0, idx)}<b>{highlight}</b>{txt.slice(idx + highlight.length)}</>;
}

export default function OverviewPage({ onNavigate }: OverviewPageProps) {
  const { t } = useTranslation();
  const { pop } = useToast();
  const { can } = useTeamPermissions();
  const navigate = useNavigate();
  const [data, setData]       = useState<OverviewData>(EMPTY);
  const [loading, setLoading] = useState(true);
  /* Page à onglets — trop d'informations à la fois perdait l'utilisateur
   * (retours utilisateur) : seuls le héro + les KPIs restent toujours
   * visibles, le reste (graphiques, commandes, activité) est réparti
   * dans 3 onglets consultés un par un. */
  const [tab, setTab] = useState<'ventes' | 'commandes' | 'activite'>('ventes');

  /* Boutique sans position GPS : la distance montrée aux clients part du centre de sa ville (≈) */
  const [sansPosition, setSansPosition] = useState(false);
  useEffect(() => {
    apiFetch<{ latitude?: number | string | null; longitude?: number | string | null }>('/dashboard/entreprise/parametres/apercu')
      .then(d => setSansPosition(!!d && (d.latitude == null || d.longitude == null)))
      .catch(() => {});
    const onSet = () => setSansPosition(false);
    window.addEventListener('company-location-set', onSet);
    return () => window.removeEventListener('company-location-set', onSet);
  }, []);

  useEffect(() => {
    apiFetch<OverviewData>('/dashboard/entreprise/overview')
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const { kpis, caData, topProduits, categoryBreakdown, dernieresCommandes, stockAlertes, activite } = data;

  /** "Stable" dépend de t(), donc fonction locale plutôt que module-level. */
  function trendBadge(pct: number) {
    if (pct > 0) return { type: 'up' as const, label: `+${pct}%` };
    if (pct < 0) return { type: 'dn' as const, label: `${pct}%` };
    return { type: 'neu' as const, label: t('overview.hero.stable') };
  }

  const maxCA = Math.max(1, ...caData.map(d => d.v));
  const caTrend = trendBadge(kpis.croissanceCA);
  const cmdTrend = trendBadge(kpis.commandesCroissance);

  const segments = categoryBreakdown.map((c, i) => {
    const start = categoryBreakdown.slice(0, i).reduce((a, x) => a + x.pct * 3.6, 0);
    return `${DONUT[i % DONUT.length]} ${start}deg ${start + c.pct * 3.6}deg`;
  });
  const maxVentes = Math.max(1, ...topProduits.map(x => x.ventes));

  const STATUS_LABELS: Record<string, ReactElement> = {
    new:  <span className="s-pill s-new">● {t('overview.orders.status.new')}</span>,
    prep: <span className="s-pill s-prep">⚙ {t('overview.orders.status.prep')}</span>,
    ship: <span className="s-pill s-ship">🚚 {t('overview.orders.status.ship')}</span>,
    del:  <span className="s-pill s-del">✓ {t('overview.orders.status.del')}</span>,
    can:  <span className="s-pill s-can">✕ {t('overview.orders.status.can')}</span>,
  };

  return (
    <div className="page on" id="p-overview">

      {sansPosition && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', marginBottom: 14, background: 'var(--g50)', border: '1px solid var(--bdr2)', borderRadius: 12 }}>
          <i className="fas fa-location-crosshairs" style={{ color: 'var(--blue)', fontSize: 18, flexShrink: 0 }} aria-hidden="true" />
          <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.4, color: 'var(--t2)' }}>
            <strong style={{ display: 'block', color: 'var(--t1)' }}>{t('overview.position.titre')}</strong>
            {t('overview.position.texte')}
          </div>
          <button type="button" className="hb1" style={{ flexShrink: 0 }} onClick={() => onNavigate('boutique-preview')}>
            {t('overview.position.action')}
          </button>
        </div>
      )}

      {/* ── EN-TÊTE : salutation, état de la boutique, actions ── */}
      <header className={st.head}>
        <div className={st.headText}>
          <div className={st.status}>
            <span className={st.statusDot} aria-hidden="true" />
            {t('overview.hero.badgeActive', { count: kpis.abonnes })}
          </div>
          <h1 className={st.title}>
            {t('overview.hero.greeting')} <em>{data.zoneNom}</em>
          </h1>
          <div className={st.sub}>
            {loading ? (
              <span className={st.subItem}>{t('overview.hero.loading')}</span>
            ) : (
              <>
                <span className={st.subItem}>
                  <i className="fas fa-box" aria-hidden="true" />
                  {t('overview.hero.subCommandes', { count: kpis.enAttente })}
                </span>
                <span className={st.subItem}>
                  <i className="fas fa-rotate-left" aria-hidden="true" />
                  {t('overview.hero.subRetours', { count: kpis.retoursEnTraitement })}
                </span>
              </>
            )}
          </div>
        </div>
        <div className={st.actions}>
          <button type="button" className={`${st.btn} ${st.btnPrimary}`} onClick={() => onNavigate('commandes')}>
            <i className="fas fa-box" aria-hidden="true" /> {t('overview.hero.btnCommandes')}
            {kpis.enAttente > 0 && <span className={st.count}>{kpis.enAttente}</span>}
          </button>
          {can('statistics', 'view') && (
            <button type="button" className={`${st.btn} ${st.btnGhost}`} onClick={() => onNavigate('analytics')}>
              <i className="fas fa-chart-line" aria-hidden="true" /> {t('overview.hero.btnAnalytics')}
            </button>
          )}
          <button type="button" className={`${st.btn} ${st.btnGhost}`} onClick={() => onNavigate('promotions')}>
            <i className="fas fa-percent" aria-hidden="true" /> {t('overview.hero.btnPromotions')}
          </button>
        </div>
      </header>

      {/* ── INDICATEURS ── */}
      <div className={st.kpis}>
        {([
          {
            ico: 'fa-sack-dollar', lbl: t('overview.kpi.ca'),
            val: fmtMontant(kpis.caCeMois), unit: 'GNF', trend: caTrend,
            go: (can('statistics', 'view') ? 'analytics' : 'finances') as EntreprisePage,
          },
          {
            ico: 'fa-bag-shopping', lbl: t('overview.kpi.commandes'),
            val: fmt(kpis.commandesCeMois), unit: '', trend: cmdTrend, go: 'commandes' as EntreprisePage,
          },
          {
            ico: 'fa-star', lbl: t('overview.kpi.note'),
            val: kpis.totalAvis > 0 ? kpis.noteMoyenne.toFixed(1) : '—', unit: '/ 5', star: kpis.totalAvis > 0,
            note: t('overview.hero.avis', { count: kpis.totalAvis }), go: 'avis' as EntreprisePage,
          },
          {
            ico: 'fa-users', lbl: t('overview.kpi.abonnes'),
            val: fmt(kpis.abonnes), unit: '', note: t('overview.kpi.abonnesSub'), go: 'clients' as EntreprisePage,
          },
        ] as KpiCard[]).map(k => (
          <button type="button" className={st.kpi} key={k.ico} onClick={() => onNavigate(k.go)}>
            <span className={st.kpiTop}>
              <span className={st.kpiIco}><i className={`fas ${k.ico}`} aria-hidden="true" /></span>
              <span className={st.kpiLbl}>{k.lbl}</span>
            </span>
            <span className={st.kpiVal}>
              {loading ? '—' : k.val}
              {k.star && <i className={`fas fa-star ${st.kpiStar}`} aria-hidden="true" />}
              {k.unit && <span className={st.kpiUnit}>{k.unit}</span>}
            </span>
            <span className={st.kpiFoot}>
              {k.trend && (
                <span className={`${st.trend} ${k.trend.type === 'up' ? st.trendUp : k.trend.type === 'dn' ? st.trendDown : st.trendFlat}`}>
                  <i className={`fas ${k.trend.type === 'up' ? 'fa-arrow-trend-up' : k.trend.type === 'dn' ? 'fa-arrow-trend-down' : 'fa-minus'}`} aria-hidden="true" />
                  {k.trend.label}
                </span>
              )}
              {k.note && <span className={st.kpiNote}>{k.note}</span>}
            </span>
          </button>
        ))}
      </div>

      {/* ── ONGLETS ── */}
      <div className={st.tabs} role="tablist">
        {([
          ['ventes', 'fa-chart-line', t('overview.tabs.ventes'), 0],
          ['commandes', 'fa-box', t('overview.tabs.commandes'), stockAlertes.length],
          ['activite', 'fa-timeline', t('overview.tabs.activite'), 0],
        ] as const).map(([key, ico, lbl, badge]) => (
          <button
            type="button" role="tab" aria-selected={tab === key} key={key}
            className={`${st.tab} ${tab === key ? st.tabOn : ''}`}
            onClick={() => setTab(key)}
          >
            <i className={`fas ${ico}`} aria-hidden="true" /> {lbl}
            {badge > 0 && <span className={st.tabBadge}>{badge}</span>}
          </button>
        ))}
      </div>

      {/* ── ONGLET VENTES : CA + TOP PRODUITS + RÉPARTITION ── */}
      {tab === 'ventes' && (
        <>
          <div className={st.summary}>
            <span className={st.summaryIco}><i className="fas fa-wallet" aria-hidden="true" /></span>
            <div className={st.summaryTxt}>
              <div className={st.summaryLbl}>{t('overview.kpi.benefice')}</div>
              <div className={st.summaryVal}>{fmt(kpis.beneficeNet)} GNF</div>
            </div>
            <div className={st.summarySub}>{t('overview.kpi.beneficeSub', { marge: kpis.margePct, commission: fmt(kpis.commissionCeMois) })}</div>
          </div>

          <div className={st.grid}>
            <section className={st.card}>
              <div className={st.cardHd}>
                <div className={st.cardTitle}><i className="fas fa-chart-column" aria-hidden="true" /> {t('overview.charts.caMensuel')}</div>
              </div>
              <div className={st.cardBody}>
                {caData.length === 0 && !loading ? (
                  <Empty ico="fa-chart-column" txt={t('overview.charts.noSalesDelivered')} />
                ) : (
                  <>
                    <div className={st.bars}>
                      {caData.map((d, i) => {
                        const now = i === caData.length - 1;
                        return (
                          <div className={st.barCol} key={i}>
                            <div className={st.barTrack}>
                              <div className={`${st.bar} ${now ? st.barNow : ''}`} style={{ height: `${(d.v / maxCA) * 100}%` }} />
                              <span className={st.barVal} style={{ bottom: `calc(${(d.v / maxCA) * 100}% + 4px)` }}>{d.v}M</span>
                            </div>
                            <div className={`${st.barLbl} ${now ? st.barLblNow : ''}`}>{d.m}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className={st.legend}>
                      <span className={st.legendItem}><span className={`${st.legendDot} ${st.legendDotNow}`} />{t('overview.charts.legendCurrent')}</span>
                      <span className={st.legendItem}><span className={st.legendDot} />{t('overview.charts.legendPrevious')}</span>
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className={st.card}>
              <div className={st.cardHd}>
                <div className={st.cardTitle}><i className="fas fa-trophy" aria-hidden="true" /> {t('overview.charts.topProduits')}</div>
                <button type="button" className={st.cardLink} onClick={() => onNavigate('produits')}>
                  <i className="fas fa-arrow-right" aria-hidden="true" />
                </button>
              </div>
              <div className={st.cardBody}>
                {topProduits.length === 0 && !loading && <Empty ico="fa-trophy" txt={t('overview.charts.noSales')} />}
                {topProduits.map((p, i) => (
                  <div key={i} className={st.tp}>
                    <div className={st.tpRank}>{i + 1}</div>
                    <div className={st.tpEm}>{p.em}</div>
                    <div className={st.tpInfo}>
                      <div className={st.tpName}>{p.nm}</div>
                      <div className={st.tpTrack}><div className={st.tpFill} style={{ width: `${(p.ventes / maxVentes) * 100}%` }} /></div>
                    </div>
                    <div className={st.tpStats}>
                      <div className={st.tpSales}>{t('overview.charts.ventes', { count: p.ventes })}</div>
                      <div className={`${st.tpCa} ${p.trend === 'up' ? st.tpUp : p.trend === 'dn' ? st.tpDown : ''}`}>
                        {p.trend === 'up' ? '↑' : p.trend === 'dn' ? '↓' : '—'} {p.ca}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className={st.card}>
            <div className={st.cardHd}>
              <div className={st.cardTitle}><i className="fas fa-chart-pie" aria-hidden="true" /> {t('overview.donut.title')}</div>
            </div>
            <div className={st.cardBody}>
              {categoryBreakdown.length === 0 && !loading ? (
                <Empty ico="fa-chart-pie" txt={t('overview.charts.noSales')} />
              ) : (
                <div className={st.donutWrap}>
                  <div className={st.donut} style={{ background: `conic-gradient(${segments.join(',')})` }} />
                  <div className={st.dl}>
                    {categoryBreakdown.map((c, i) => (
                      <div className={st.dlItem} key={c.label}>
                        <div className={st.dlLeft}><span className={st.dlDot} style={{ background: DONUT[i % DONUT.length] }} />{c.label}</div>
                        <div className={st.dlPct}>{c.pct}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* ── ONGLET COMMANDES : ALERTES + DERNIÈRES COMMANDES ── */}
      {tab === 'commandes' && (
        <>
          <div className={st.summary}>
            <span className={st.summaryIco}><i className="fas fa-rotate-left" aria-hidden="true" /></span>
            <div className={st.summaryTxt}>
              <div className={st.summaryLbl}>{t('overview.kpi.retours')}</div>
              <div className={st.summaryVal}>{kpis.retoursCeMois}</div>
            </div>
            <div className={st.summarySub}>{t('overview.kpi.retoursSub', { enTraitement: kpis.retoursEnTraitement, rembourses: kpis.retoursRembourses })}</div>
          </div>
          <section className={st.card} style={{ marginBottom: 14 }}>
            <div className={st.cardHd}>
              <div className={st.cardTitle}><i className="fas fa-triangle-exclamation" aria-hidden="true" /> {t('overview.alerts.title')}</div>
              <span className={st.pill}>{t('overview.alerts.count', { count: stockAlertes.length })}</span>
            </div>
            <div className={st.cardBody}>
              {stockAlertes.length === 0 && !loading && <Empty ico="fa-boxes-stacked" txt={t('overview.alerts.empty')} />}
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
          </section>

          <section className={st.card}>
            <div className={st.cardHd}>
              <div className={st.cardTitle}><i className="fas fa-box" aria-hidden="true" /> {t('overview.orders.title')}</div>
              <button type="button" className={st.cardLink} onClick={() => onNavigate('commandes')}>
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
              {dernieresCommandes.length === 0 && !loading && <Empty ico="fa-box-open" txt={t('overview.orders.empty')} />}
            </div>
          </section>
        </>
      )}

      {/* ── ONGLET ACTIVITÉ ── */}
      {tab === 'activite' && (
        <section className={st.card}>
          <div className={st.cardHd}><div className={st.cardTitle}><i className="fas fa-timeline" aria-hidden="true" /> {t('overview.activity.title')}</div></div>
          <div className={st.cardBody}>
            {activite.length === 0 && !loading && <Empty ico="fa-timeline" txt={t('overview.activity.empty')} />}
            <div className="act-list">
              {activite.map((a, i) => (
                <div key={i} className="act-item">
                  <div className="act-dot order"><i className={`fas ${a.icon}`}></i></div>
                  <div className="act-txt"><ActiviteTxt txt={a.txt} highlight={a.highlight} /></div>
                  <div className="act-time">{a.time}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
