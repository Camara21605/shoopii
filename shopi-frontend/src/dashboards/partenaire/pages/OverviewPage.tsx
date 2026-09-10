/* ================================================================
 * FICHIER : src/dashboards/partenaire/pages/OverviewPage.tsx
 * Vue d'ensemble : héro + KPIs + graphe + activité — données réelles.
 * ================================================================ */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/OverviewPage.module.css';
import KpiCard from '../components/KpiCard';
import { apiFetch } from '@/shared/services/apiFetch';
import type { PartenairePage } from '../data/types';

interface Props {
  onNavigate: (p: PartenairePage) => void;
  onGenerate: () => void;
}

interface OverviewData {
  partenaire: { name: string; zone: string; status: string };
  kpis: {
    totalActeurs: number;
    codesActifs: number;
    tauxConversion: number;
    commissionsMonth: number;
  };
  reseau: { entreprises: number; livreurs: number; correspondants: number };
  chart: {
    semaine: { x: string; e: number; l: number }[];
    mois:    { x: string; e: number; l: number }[];
    annee:   { x: string; e: number; l: number }[];
  };
  activiteRecente: { icone: string; kind: string; texte: string; highlight?: string; when: string }[];
}

/* Met en gras `highlight` dans `texte` via JSX (échappé par React) — pas de
 * dangerouslySetInnerHTML : `highlight` peut contenir un nom saisi librement
 * par un utilisateur à l'inscription (voir partenaire-dashboard.service.ts). */
function ActiviteTexte({ texte, highlight }: { texte: string; highlight?: string }) {
  if (!highlight) return <>{texte}</>;
  const idx = texte.indexOf(highlight);
  if (idx === -1) return <>{texte}</>;
  return (
    <>
      {texte.slice(0, idx)}
      <b>{highlight}</b>
      {texte.slice(idx + highlight.length)}
    </>
  );
}

const KPI_VARIANT = ['k1', 'k2', 'k3', 'k4'] as const;
const KPI_ICON    = ['fa-users', 'fa-qrcode', 'fa-percent', 'fa-coins'];
type ChartKey = 'semaine' | 'mois' | 'annee';

const fmtGnf = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M GNF`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)} K GNF`;
  return `${n.toLocaleString('fr-FR')} GNF`;
};

export default function OverviewPage({ onNavigate, onGenerate }: Props) {
  const { t } = useTranslation();
  const [data, setData]         = useState<OverviewData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [chartKey, setChartKey] = useState<ChartKey>('mois');

  useEffect(() => {
    apiFetch<OverviewData>('/dashboard/partenaire/overview')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
      <i className="fas fa-spinner fa-spin" style={{ fontSize: 24 }} />
    </div>
  );

  if (!data) return (
    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--danger)' }}>
      <i className="fas fa-circle-exclamation" /> {t('partenaireOverview.loadError')}
    </div>
  );

  const chartData = data.chart[chartKey];
  const max       = Math.max(...chartData.map(d => Math.max(d.e, d.l)), 1);
  const { kpis, reseau, activiteRecente, partenaire } = data;

  const kpiCards = [
    { value: String(kpis.totalActeurs),     label: t('partenaireOverview.kpis.totalActeurs') },
    { value: String(kpis.codesActifs),       label: t('partenaireOverview.kpis.codesActifs') },
    { value: `${kpis.tauxConversion}`,       label: t('partenaireOverview.kpis.tauxConversion'), unit: '%' },
    { value: fmtGnf(kpis.commissionsMonth),  label: t('partenaireOverview.kpis.commissionsMonth') },
  ];

  return (
    <div>
      {/* Héro */}
      <div className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroGrid} />
        <div className={styles.heroIn}>
          <div>
            <div className={styles.eyebrow}><i className="fas fa-bolt" /> {t('partenaireOverview.hero.eyebrow')}</div>
            <div className={styles.h}>
              {t('partenaireOverview.hero.greeting', { name: partenaire.name })}<br />
              {t('partenaireOverview.hero.recruitedPrefix')} <em>{t('partenaireOverview.hero.recruitedCount', { count: kpis.totalActeurs })}</em> {t('partenaireOverview.hero.recruitedSuffix')}
            </div>
            <div className={styles.p}>
              {t('partenaireOverview.hero.paragraph')}
            </div>
            <div className={styles.btns}>
              <button className={styles.b1} onClick={onGenerate}><i className="fas fa-qrcode" /> {t('partenaireOverview.hero.generateBtn')}</button>
              <button className={styles.b2} onClick={() => onNavigate('acteurs')}><i className="fas fa-people-group" /> {t('partenaireOverview.hero.voirActeursBtn')}</button>
            </div>
          </div>

          <div className={styles.tier}>
            <div className={styles.tierRing}><i className="fas fa-award" /></div>
            <div>
              <div className={styles.tierNm}>{t('partenaireOverview.hero.tierName', { zone: partenaire.zone ?? 'Shoneya' })}</div>
              <div className={styles.tierSub}>{t('partenaireOverview.hero.tierStatus', { status: partenaire.status })}</div>
              <div className={styles.tierProg}>{t('partenaireOverview.hero.tierProgress', { count: kpis.totalActeurs })}</div>
              <div className={styles.tierBar}><span /></div>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className={styles.kpis}>
        {kpiCards.map((k, i) => (
          <KpiCard key={i} variant={KPI_VARIANT[i]} icon={KPI_ICON[i]}
            value={k.value} unit={k.unit} label={k.label} />
        ))}
      </div>

      {/* Graphe + activité */}
      <div className={styles.g2}>
        <div className={styles.card}>
          <div className={styles.ch}>
            <div className={styles.chT}><i className="fas fa-chart-column" /> {t('partenaireOverview.chart.title')}</div>
            <div className={styles.tabs}>
              {(['semaine', 'mois', 'annee'] as ChartKey[]).map(k => (
                <button key={k} className={`${styles.tab} ${chartKey === k ? styles.tabOn : ''}`}
                  onClick={() => setChartKey(k)}>
                  {t(`partenaireOverview.chart.${k}`)}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.cb}>
            <div className={styles.chart}>
              {chartData.map((d, i) => (
                <div key={i} className={styles.cbarWrap}>
                  <div className={styles.cbarPair}>
                    <div className={styles.cbar} style={{ height: `${(d.e / max) * 100}%` }}>
                      <span className={styles.cbarV}>{d.e}</span>
                    </div>
                    <div className={`${styles.cbar} ${styles.cbarAlt}`} style={{ height: `${(d.l / max) * 100}%` }}>
                      <span className={styles.cbarV}>{d.l}</span>
                    </div>
                  </div>
                  <div className={styles.cbarL}>{d.x}</div>
                </div>
              ))}
            </div>
            <div className={styles.legend}>
              <div className={styles.leg}><span className={styles.legD} style={{ background: 'var(--blue)' }} /> {t('partenaireOverview.chart.legendEntreprises')}</div>
              <div className={styles.leg}><span className={styles.legD} style={{ background: 'var(--violet)' }} /> {t('partenaireOverview.chart.legendLivreurs')}</div>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.ch}><div className={styles.chT}><i className="fas fa-clock-rotate-left" /> {t('partenaireOverview.activite.title')}</div></div>
          <div className={styles.cb}>
            {activiteRecente.length === 0 ? (
              <div style={{ color: 'var(--muted)', padding: '16px 0', textAlign: 'center', fontSize: 14 }}>{t('partenaireOverview.activite.empty')}</div>
            ) : activiteRecente.map((a, i) => (
              <div key={i} className={styles.act}>
                <div className={`${styles.actIc} ${styles['act_' + a.kind]}`}><i className={`fas ${a.icone}`} /></div>
                <div>
                  <div className={styles.actT}><ActiviteTexte texte={a.texte} highlight={a.highlight} /></div>
                  <div className={styles.actW}>{a.when}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Répartition réseau */}
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.chT}><i className="fas fa-layer-group" /> {t('partenaireOverview.repartition.title')}</div>
          <button className={styles.chLink} onClick={() => onNavigate('acteurs')}>{t('partenaireOverview.repartition.voirTout')} <i className="fas fa-arrow-right" /></button>
        </div>
        <div className={styles.cb}>
          <div className={styles.repartition}>
            <div className={styles.rep}><div className={styles.repV}>{reseau.entreprises}</div><div className={styles.repL}><i className="fas fa-store" style={{ color: 'var(--blue)' }} /> {t('partenaireOverview.repartition.entreprises')}</div></div>
            <div className={styles.rep}><div className={styles.repV}>{reseau.livreurs}</div><div className={styles.repL}><i className="fas fa-motorcycle" style={{ color: 'var(--emerald)' }} /> {t('partenaireOverview.repartition.livreurs')}</div></div>
            <div className={styles.rep}><div className={styles.repV}>{reseau.correspondants}</div><div className={styles.repL}><i className="fas fa-map-pin" style={{ color: 'var(--violet)' }} /> {t('partenaireOverview.repartition.correspondants')}</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
