/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/OverviewPage.tsx
 *
 * Vue d'ensemble de la zone : héro (santé de la zone),
 * file d'attente du jour (cliquable), KPI, graphe de croissance,
 * activité, couverture par commune, répartition par rôle.
 * ================================================================ */

import { useState } from 'react';
import styles from '../styles/OverviewPage.module.css';
import KpiCard from '../components/KpiCard';
import type { AdminPage } from '../data/types';
import {
  ZONE, KPIS, QUEUE, CHART_DATA, COMMUNES, ROLES_REPARTITION,
  ACTIVITE, TYPE_LABEL, TYPE_ICON,
} from '../data/adminData';

interface OverviewPageProps {
  onNavigate: (page: AdminPage) => void;
}

type ChartKey = keyof typeof CHART_DATA;

const KPI_VARIANT = ['k1', 'k2', 'k3', 'k4'] as const;
const KPI_ICON    = ['fa-users', 'fa-box', 'fa-sack-dollar', 'fa-triangle-exclamation'];

/* Couleur d'icône par rôle dans la répartition */
const ROLE_COLOR: Record<string, string> = {
  par: 'var(--teal)', ent: 'var(--blue)', lvr: 'var(--emerald)', cor: 'var(--violet)',
};

export default function OverviewPage({ onNavigate }: OverviewPageProps) {
  const [chartKey, setChartKey] = useState<ChartKey>('mois');

  const data = CHART_DATA[chartKey];
  const max  = Math.max(...data.map(d => Math.max(d.a, d.c)), 1);

  return (
    <div>
      {/* ── Héro zone ── */}
      <div className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroGrid} />
        <div className={styles.heroIn}>
          <div>
            <div className={styles.eyebrow}><i className="fas fa-map-location-dot" /> {ZONE.nom}</div>
            <div className={styles.heroH}>
              Bonjour Aïssatou,<br />votre zone compte <em>486 acteurs actifs</em>
            </div>
            <p className={styles.heroP}>
              7 comptes attendent votre validation et 4 signalements sont à traiter.
              La zone a enregistré 1 240 commandes cette semaine.
            </p>
            <div className={styles.heroBtns}>
              <button className={styles.hbtn1} onClick={() => onNavigate('validations')}>
                <i className="fas fa-user-check" /> Traiter les validations
              </button>
              <button className={styles.hbtn2} onClick={() => onNavigate('signalements')}>
                <i className="fas fa-shield-halved" /> Voir les signalements
              </button>
            </div>
          </div>

          {/* Anneau de santé de la zone */}
          <div className={styles.zoneHealth}>
            <div className={styles.zhRing} style={{ background: `conic-gradient(#34D399 0% ${ZONE.sante}%, rgba(255,255,255,.1) ${ZONE.sante}% 100%)` }}>
              <div className={styles.zhRingV}><b>{ZONE.sante}%</b><span>Santé</span></div>
            </div>
            <div>
              <div className={styles.zhNm}>Santé de la zone</div>
              <div className={styles.zhSub}>Fiabilité livraisons · litiges · fraude</div>
              <div className={styles.zhAlerts}><i className="fas fa-triangle-exclamation" /> 4 signalements en attente</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── File d'attente du jour (chaque item mène à la page correspondante) ── */}
      <div className={styles.queue}>
        {QUEUE.map(q => (
          <div key={q.label} className={styles.qItem} onClick={() => onNavigate(q.nav as AdminPage)}>
            <div className={`${styles.qIc} ${styles['q_' + q.kind]}`}><i className={`fas ${q.icone}`} /></div>
            <div>
              <div className={styles.qV}>{q.v}</div>
              <div className={styles.qL}>{q.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Grille KPI ── */}
      <div className={styles.kpis}>
        {KPIS.map((k, i) => (
          <KpiCard key={k.cle} variant={KPI_VARIANT[i]} icon={KPI_ICON[i]}
            value={k.valeur} unit={k.unite} label={k.label} delta={k.delta} trend={k.trend} />
        ))}
      </div>

      {/* ── Graphe de croissance + activité récente ── */}
      <div className={styles.g2}>
        <div className={styles.card}>
          <div className={styles.ch}>
            <div className={styles.chT}><i className="fas fa-chart-column" /> Croissance de la zone</div>
            <div className={styles.chTabs}>
              {(['semaine', 'mois', 'annee'] as ChartKey[]).map(key => (
                <button key={key}
                  className={`${styles.chTab} ${chartKey === key ? styles.chTabOn : ''}`}
                  onClick={() => setChartKey(key)}>
                  {key === 'semaine' ? 'Semaine' : key === 'mois' ? 'Mois' : 'Année'}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.cb}>
            <div className={styles.chart}>
              {data.map(d => (
                <div key={d.x} className={styles.cbarWrap}>
                  <div className={styles.cbarPair}>
                    <div className={styles.cbar} style={{ height: `${(d.a / max) * 100}%` }}>
                      <span className={styles.cbarV}>{d.a} acteurs</span>
                    </div>
                    <div className={`${styles.cbar} ${styles.cbarAlt}`} style={{ height: `${(d.c / max) * 100}%` }}>
                      <span className={styles.cbarV}>{d.c}00 cmd</span>
                    </div>
                  </div>
                  <div className={styles.cbarL}>{d.x}</div>
                </div>
              ))}
            </div>
            <div className={styles.legend}>
              <div className={styles.cleg}><span className={styles.clegD} style={{ background: 'var(--blue)' }} /> Nouveaux acteurs</div>
              <div className={styles.cleg}><span className={styles.clegD} style={{ background: 'var(--teal)' }} /> Commandes (×100)</div>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.ch}>
            <div className={styles.chT}><i className="fas fa-clock-rotate-left" /> Activité de la zone</div>
          </div>
          <div className={styles.cb}>
            {ACTIVITE.map((a, i) => (
              <div key={i} className={styles.act}>
                <div className={`${styles.actIc} ${styles['act_' + a.kind]}`}><i className={`fas ${a.icone}`} /></div>
                <div>
                  {/* Texte avec balises <b> — données internes controlées */}
                  <div className={styles.actT} dangerouslySetInnerHTML={{ __html: a.texte }} />
                  <div className={styles.actW}>{a.when}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Communes + répartition par rôle ── */}
      <div className={styles.g2}>
        <div className={styles.card}>
          <div className={styles.ch}>
            <div className={styles.chT}><i className="fas fa-map" /> Couverture par commune</div>
          </div>
          <div className={styles.cb}>
            {COMMUNES.map(c => (
              <div key={c.nom} className={styles.commune}>
                <div className={styles.communeTop}>
                  <b>{c.nom}</b><span>{c.acteurs} acteurs · {c.pct}%</span>
                </div>
                <div className={styles.communeBar}><span style={{ width: `${c.pct}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.ch}>
            <div className={styles.chT}><i className="fas fa-layer-group" /> Acteurs par rôle</div>
            <button className={styles.chLink} onClick={() => onNavigate('acteurs')}>
              Voir tout <i className="fas fa-arrow-right" />
            </button>
          </div>
          <div className={styles.cb}>
            <div className={styles.roles}>
              {ROLES_REPARTITION.map(r => (
                <div key={r.type} className={styles.roleStat}>
                  <div className={styles.roleV}>{r.n}</div>
                  <div className={styles.roleL}>
                    <i className={`fas ${TYPE_ICON[r.type]}`} style={{ color: ROLE_COLOR[r.type] }} /> {TYPE_LABEL[r.type]}s
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
