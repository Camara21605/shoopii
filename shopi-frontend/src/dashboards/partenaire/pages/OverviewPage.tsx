/* ================================================================
 * FICHIER : src/dashboards/partenaire/pages/OverviewPage.tsx
 * Vue d'ensemble : héro + KPIs + graphe + activité — données réelles.
 * ================================================================ */

import { useState, useEffect } from 'react';
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
  activiteRecente: { icone: string; kind: string; texte: string; when: string }[];
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
      <i className="fas fa-circle-exclamation" /> Impossible de charger le tableau de bord
    </div>
  );

  const chartData = data.chart[chartKey];
  const max       = Math.max(...chartData.map(d => Math.max(d.e, d.l)), 1);
  const { kpis, reseau, activiteRecente, partenaire } = data;

  const kpiCards = [
    { value: String(kpis.totalActeurs),     label: 'Acteurs recrutés (total)' },
    { value: String(kpis.codesActifs),       label: 'Codes actifs' },
    { value: `${kpis.tauxConversion}`,       label: 'Taux de conversion', unit: '%' },
    { value: fmtGnf(kpis.commissionsMonth),  label: 'Commissions ce mois' },
  ];

  return (
    <div>
      {/* Héro */}
      <div className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroGrid} />
        <div className={styles.heroIn}>
          <div>
            <div className={styles.eyebrow}><i className="fas fa-bolt" /> Espace Partenaire</div>
            <div className={styles.h}>
              Bonjour {partenaire.name},<br />
              vous avez recruté <em>{kpis.totalActeurs} acteurs</em> au total
            </div>
            <div className={styles.p}>
              Continuez à faire grandir le réseau Shoneya. Chaque entreprise et livreur que vous recrutez vous rapporte une commission récurrente.
            </div>
            <div className={styles.btns}>
              <button className={styles.b1} onClick={onGenerate}><i className="fas fa-qrcode" /> Générer un code</button>
              <button className={styles.b2} onClick={() => onNavigate('acteurs')}><i className="fas fa-people-group" /> Voir mes acteurs</button>
            </div>
          </div>

          <div className={styles.tier}>
            <div className={styles.tierRing}><i className="fas fa-award" /></div>
            <div>
              <div className={styles.tierNm}>Partenaire {partenaire.zone ?? 'Shoneya'}</div>
              <div className={styles.tierSub}>Statut : {partenaire.status}</div>
              <div className={styles.tierProg}>{kpis.totalActeurs} acteurs dans votre réseau</div>
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
            <div className={styles.chT}><i className="fas fa-chart-column" /> Recrutements</div>
            <div className={styles.tabs}>
              {(['semaine', 'mois', 'annee'] as ChartKey[]).map(k => (
                <button key={k} className={`${styles.tab} ${chartKey === k ? styles.tabOn : ''}`}
                  onClick={() => setChartKey(k)}>
                  {k === 'semaine' ? 'Semaine' : k === 'mois' ? 'Mois' : 'Année'}
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
              <div className={styles.leg}><span className={styles.legD} style={{ background: 'var(--blue)' }} /> Entreprises</div>
              <div className={styles.leg}><span className={styles.legD} style={{ background: 'var(--violet)' }} /> Livreurs & correspondants</div>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.ch}><div className={styles.chT}><i className="fas fa-clock-rotate-left" /> Activité récente</div></div>
          <div className={styles.cb}>
            {activiteRecente.length === 0 ? (
              <div style={{ color: 'var(--muted)', padding: '16px 0', textAlign: 'center', fontSize: 14 }}>Aucune activité récente</div>
            ) : activiteRecente.map((a, i) => (
              <div key={i} className={styles.act}>
                <div className={`${styles.actIc} ${styles['act_' + a.kind]}`}><i className={`fas ${a.icone}`} /></div>
                <div>
                  <div className={styles.actT} dangerouslySetInnerHTML={{ __html: a.texte }} />
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
          <div className={styles.chT}><i className="fas fa-layer-group" /> Répartition de votre réseau</div>
          <button className={styles.chLink} onClick={() => onNavigate('acteurs')}>Voir tout <i className="fas fa-arrow-right" /></button>
        </div>
        <div className={styles.cb}>
          <div className={styles.repartition}>
            <div className={styles.rep}><div className={styles.repV}>{reseau.entreprises}</div><div className={styles.repL}><i className="fas fa-store" style={{ color: 'var(--blue)' }} /> Entreprises</div></div>
            <div className={styles.rep}><div className={styles.repV}>{reseau.livreurs}</div><div className={styles.repL}><i className="fas fa-motorcycle" style={{ color: 'var(--emerald)' }} /> Livreurs</div></div>
            <div className={styles.rep}><div className={styles.repV}>{reseau.correspondants}</div><div className={styles.repL}><i className="fas fa-map-pin" style={{ color: 'var(--violet)' }} /> Correspondants</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
