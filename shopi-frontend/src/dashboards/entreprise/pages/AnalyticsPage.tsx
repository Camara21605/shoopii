/*
 * FICHIER: src/dashboards/entreprise/pages/AnalyticsPage.tsx
 * Page Analytics — chiffre d'affaires, top produits et performances
 * par catégorie (données réelles). Le trafic/sources/entonnoir de
 * conversion nécessiterait un système de tracking de pages vues qui
 * n'existe pas dans le backend — affiché comme "bientôt disponible".
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../../shared/services/apiFetch';

interface AnalyticsData {
  caData: { m: string; v: number }[];
  topProduits: { em: string; nm: string; ventes: number; ca: string; trend: 'up' | 'dn' | 'neu' }[];
  categoryPerf: { cat: string; ca: number; commandes: number }[];
}

const EMPTY: AnalyticsData = { caData: [], topProduits: [], categoryPerf: [] };

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const [data, setData]       = useState<AnalyticsData>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<AnalyticsData>('/dashboard/entreprise/analytics')
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const { caData, topProduits, categoryPerf } = data;
  const maxCA = Math.max(1, ...caData.map(d => d.v));

  return (
    <div className="page on" id="p-analytics">

      {/* ── Graphique CA ── */}
      <div className="card">
        <div className="ch">
          <div className="ch-t"><i className="fas fa-chart-line"></i> {t('analytics.ca.title')}</div>
        </div>
        <div className="cb">
          {caData.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--t3)' }}>{t('analytics.ca.empty')}</div>
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
            <div className="cl-item"><div className="cl-dot" style={{ background: 'var(--t2)' }}></div>{t('analytics.ca.legendCurrent')}</div>
            <div className="cl-item"><div className="cl-dot" style={{ background: 'var(--sky-3)' }}></div>{t('analytics.ca.legendPrevious')}</div>
          </div>
        </div>
      </div>

      {/* ── Performances par catégorie + Top produits ── */}
      <div className="g2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="ch">
            <div className="ch-t"><i className="fas fa-table-list"></i> {t('analytics.categoryPerf.title')}</div>
          </div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('analytics.categoryPerf.categorie')}</th>
                  <th>{t('analytics.categoryPerf.caMillions')}</th>
                  <th>{t('analytics.categoryPerf.commandes')}</th>
                </tr>
              </thead>
              <tbody>
                {categoryPerf.map((c, i) => (
                  <tr key={i}>
                    <td><div className="td-nm">{c.cat}</div></td>
                    <td><div className="td-price">{c.ca}M</div></td>
                    <td style={{ fontSize: 12, color: 'var(--t2)' }}>{c.commandes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {categoryPerf.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: 16, color: 'var(--t3)' }}>{t('analytics.categoryPerf.empty')}</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="ch">
            <div className="ch-t"><i className="fas fa-trophy"></i> {t('analytics.topProduits.title')}</div>
          </div>
          <div className="cb">
            {topProduits.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: 16, color: 'var(--t3)' }}>{t('analytics.topProduits.empty')}</div>
            )}
            {topProduits.map((p, i) => {
              const mx = Math.max(1, ...topProduits.map(x => x.ventes));
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--t2)', width: 18, textAlign: 'right', fontFamily: 'var(--fd)' }}>
                    #{i + 1}
                  </div>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,var(--g100),var(--g200))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{p.em}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>{p.nm}</div>
                    <div style={{ background: 'var(--g200)', borderRadius: 'var(--pill)', height: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${(p.ventes / mx) * 100}%`, height: '100%', background: 'var(--t2)', borderRadius: 'var(--pill)', transition: 'width 0.8s var(--ease)' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 70 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)', fontFamily: 'var(--fd)' }}>{t('analytics.topProduits.ventes', { count: p.ventes })}</div>
                    <div style={{ fontSize: 10, color: p.trend === 'up' ? 'var(--green)' : p.trend === 'dn' ? 'var(--red)' : 'var(--t3)' }}>{p.ca}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Trafic — aucun système de tracking de pages vues n'existe encore ── */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="ch">
          <div className="ch-t"><i className="fas fa-chart-bar"></i> {t('analytics.trafic.title')}</div>
        </div>
        <div className="cb" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--t3)' }}>
          <i className="fas fa-chart-simple" style={{ fontSize: 28, opacity: .4, marginBottom: 10, display: 'block' }} />
          {t('analytics.trafic.sub')}
        </div>
      </div>
    </div>
  );
}
