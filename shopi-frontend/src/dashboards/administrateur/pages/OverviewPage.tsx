/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/OverviewPage.tsx
 * ================================================================ */

import { useState, useEffect } from 'react';
import styles from '../styles/OverviewPage.module.css';
import KpiCard from '../components/KpiCard';
import type { AdminPage } from '../data/types';
import { apiFetch } from '../../../shared/services/apiFetch';

interface OverviewPageProps {
  onNavigate: (page: AdminPage) => void;
}

type ChartKey = 'semaine' | 'mois' | 'annee';

const TYPE_LABEL: Record<string, string> = { par: 'Partenaire', ent: 'Entreprise', lvr: 'Livreur', cor: 'Correspondant' };
const TYPE_ICON:  Record<string, string> = { par: 'fa-handshake', ent: 'fa-store', lvr: 'fa-motorcycle', cor: 'fa-map-pin' };
const KPI_VARIANT = ['k1', 'k2', 'k3', 'k4'] as const;
const KPI_ICON    = ['fa-users', 'fa-box', 'fa-sack-dollar', 'fa-triangle-exclamation'];
const ROLE_COLOR: Record<string, string> = { par: 'var(--teal)', ent: 'var(--blue)', lvr: 'var(--emerald)', cor: 'var(--violet)' };

export default function OverviewPage({ onNavigate }: OverviewPageProps) {
  const [chartKey, setChartKey] = useState<ChartKey>('mois');
  const [overview, setOverview] = useState<any>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    apiFetch('/dashboard/admin/overview')
      .then(d => setOverview(d as any))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
      <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', opacity: .4 }} />
    </div>
  );

  if (!overview) return null;

  const zone   = overview.zone   ?? {};
  const kpis   = overview.kpis   ?? [];
  const queue  = overview.queue  ?? [];
  const chart  = overview.chart  ?? { semaine: [], mois: [], annee: [] };
  const communes = overview.communes ?? [];
  const roles  = overview.rolesRepartition ?? [];
  const activite = overview.activite ?? [];

  const data = chart[chartKey] ?? [];
  const max  = Math.max(...data.map((d: any) => Math.max(d.a, d.c)), 1);

  const adminPrenom = (zone.adminName ?? 'Administrateur').split(' ')[0];
  const totalActeurs = kpis[0]?.valeur ?? '—';
  const pendingV = queue[0]?.v ?? 0;
  const pendingS = queue[1]?.v ?? 0;
  const cmdSem   = kpis[1]?.valeur ?? '—';

  return (
    <div>
      {/* ── Héro zone ── */}
      <div className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroGrid} />
        <div className={styles.heroIn}>
          <div>
            <div className={styles.eyebrow}><i className="fas fa-map-location-dot" /> {zone.nom}</div>
            <div className={styles.heroH}>
              Bonjour {adminPrenom},<br />votre zone compte <em>{totalActeurs} acteurs actifs</em>
            </div>
            <p className={styles.heroP}>
              {pendingV} compte{pendingV !== 1 ? 's' : ''} attend{pendingV !== 1 ? 'ent' : ''} votre validation
              et {pendingS} signalement{pendingS !== 1 ? 's' : ''} {pendingS !== 1 ? 'sont' : 'est'} à traiter.
              La zone a enregistré {cmdSem} commandes cette semaine.
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

          {/* Anneau santé */}
          <div className={styles.zoneHealth}>
            <div className={styles.zhRing} style={{ background: `conic-gradient(#34D399 0% ${zone.sante ?? 95}%, rgba(255,255,255,.1) ${zone.sante ?? 95}% 100%)` }}>
              <div className={styles.zhRingV}><b>{zone.sante ?? 95}%</b><span>Santé</span></div>
            </div>
            <div>
              <div className={styles.zhNm}>Santé de la zone</div>
              <div className={styles.zhSub}>Fiabilité livraisons · litiges · fraude</div>
              <div className={styles.zhAlerts}><i className="fas fa-triangle-exclamation" /> {pendingS} signalement{pendingS !== 1 ? 's' : ''} en attente</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── File d'attente ── */}
      <div className={styles.queue}>
        {queue.map((q: any) => (
          <div key={q.label} className={styles.qItem} onClick={() => onNavigate(q.nav as AdminPage)}>
            <div className={`${styles.qIc} ${styles['q_' + q.kind]}`}><i className={`fas ${q.icone}`} /></div>
            <div>
              <div className={styles.qV}>{q.v}</div>
              <div className={styles.qL}>{q.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── KPIs ── */}
      <div className={styles.kpis}>
        {kpis.map((k: any, i: number) => (
          <KpiCard key={k.cle} variant={KPI_VARIANT[i]} icon={KPI_ICON[i]}
            value={k.valeur} unit={k.unite} label={k.label} delta={k.delta} trend={k.trend} />
        ))}
      </div>

      {/* ── Graphe + activité ── */}
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
              {data.map((d: any) => (
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
            {activite.length === 0 && <p style={{ opacity: .5, padding: '1rem' }}>Aucune activité récente.</p>}
            {activite.map((a: any, i: number) => (
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

      {/* ── Communes + répartition ── */}
      <div className={styles.g2}>
        <div className={styles.card}>
          <div className={styles.ch}>
            <div className={styles.chT}><i className="fas fa-map" /> Couverture par commune</div>
          </div>
          <div className={styles.cb}>
            {communes.length === 0 && <p style={{ opacity: .5, padding: '1rem' }}>Aucune donnée de commune.</p>}
            {communes.map((c: any) => (
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
              {roles.map((r: any) => (
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
