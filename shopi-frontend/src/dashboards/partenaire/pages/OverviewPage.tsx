/* ================================================================
 * FICHIER : src/dashboards/partenaire/pages/OverviewPage.tsx
 * Vue d'ensemble : héro + palier + KPIs + graphe + activité.
 * ================================================================ */

import { useState } from 'react';
import styles from '../styles/OverviewPage.module.css';
import KpiCard from '../components/KpiCard';
import { KPIS, CHART_DATA, ACTIVITE } from '../data/partenaireData';
import type { PartenairePage } from '../data/types';

interface Props {
  onNavigate: (p: PartenairePage) => void;
  onGenerate: () => void;
}

const KPI_VARIANT = ['k1', 'k2', 'k3', 'k4'] as const;
const KPI_ICON = ['fa-users', 'fa-qrcode', 'fa-percent', 'fa-coins'];
type ChartKey = 'semaine' | 'mois' | 'annee';

export default function OverviewPage({ onNavigate, onGenerate }: Props) {
  const [chartKey, setChartKey] = useState<ChartKey>('mois');
  const data = CHART_DATA[chartKey];
  const max = Math.max(...data.map(d => Math.max(d.e, d.l)), 1);

  return (
    <div>
      {/* Héro */}
      <div className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroGrid} />
        <div className={styles.heroIn}>
          <div>
            <div className={styles.eyebrow}><i className="fas fa-bolt" /> Espace Partenaire</div>
            <div className={styles.h}>Bonjour Mohamed,<br />vous avez recruté <em>18 acteurs</em> ce trimestre</div>
            <div className={styles.p}>Continuez à faire grandir le réseau Shopi. Chaque entreprise et livreur que vous recrutez vous rapporte une commission récurrente.</div>
            <div className={styles.btns}>
              <button className={styles.b1} onClick={onGenerate}><i className="fas fa-qrcode" /> Générer un code</button>
              <button className={styles.b2} onClick={() => onNavigate('acteurs')}><i className="fas fa-people-group" /> Voir mes acteurs</button>
            </div>
          </div>

          <div className={styles.tier}>
            <div className={styles.tierRing}><i className="fas fa-award" /></div>
            <div>
              <div className={styles.tierNm}>Partenaire Or</div>
              <div className={styles.tierSub}>Niveau 3 sur 5</div>
              <div className={styles.tierProg}>7 acteurs avant Platine</div>
              <div className={styles.tierBar}><span /></div>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className={styles.kpis}>
        {KPIS.map((k, i) => (
          <KpiCard key={k.cle} variant={KPI_VARIANT[i]} icon={KPI_ICON[i]}
            value={k.valeur} unit={k.unite} label={k.label} delta={k.delta} trend={k.trend} />
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
              {data.map((d, i) => (
                <div key={i} className={styles.cbarWrap}>
                  <div className={styles.cbarPair}>
                    <div className={styles.cbar} style={{ height: `${(d.e / max) * 100}%` }}>
                      <span className={styles.cbarV}>{d.e} ent.</span>
                    </div>
                    <div className={`${styles.cbar} ${styles.cbarAlt}`} style={{ height: `${(d.l / max) * 100}%` }}>
                      <span className={styles.cbarV}>{d.l} liv.</span>
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
            {ACTIVITE.map((a, i) => (
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
            <div className={styles.rep}><div className={styles.repV}>14</div><div className={styles.repL}><i className="fas fa-store" style={{ color: 'var(--blue)' }} /> Entreprises</div></div>
            <div className={styles.rep}><div className={styles.repV}>19</div><div className={styles.repL}><i className="fas fa-motorcycle" style={{ color: 'var(--emerald)' }} /> Livreurs</div></div>
            <div className={styles.rep}><div className={styles.repV}>6</div><div className={styles.repL}><i className="fas fa-map-pin" style={{ color: 'var(--violet)' }} /> Correspondants</div></div>
            <div className={styles.rep}><div className={styles.repV}>3</div><div className={styles.repL}><i className="fas fa-user" style={{ color: 'var(--amber)' }} /> Clients VIP</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
