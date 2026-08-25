/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/StatsPage.tsx
 *
 * Statistiques complémentaires — ne duplique pas Vue d'ensemble
 * (santé, KPIs 7j, top 6 communes, rôles, activité) ni Finances
 * (volume GNF, commissions). Ici : liste complète des communes,
 * tendance des litiges, activité par rôle dans le temps, débit de
 * traitement des validations.
 * ================================================================ */

import { useState, useEffect } from 'react';
import styles from '../styles/StatsPage.module.css';
import KpiCard from '../components/KpiCard';
import { apiFetch } from '../../../shared/services/apiFetch';

interface StatsPageProps {
  onToast: (msg: string, type?: 's' | 'i' | 'w') => void;
}

type Role = 'par' | 'ent' | 'lvr' | 'cor';
const ROLE_LABEL: Record<Role, string> = { par: 'Partenaires', ent: 'Entreprises', lvr: 'Livreurs', cor: 'Correspondants' };
const ROLE_COLOR: Record<Role, string> = { par: 'var(--teal)', ent: 'var(--blue)', lvr: 'var(--emerald)', cor: 'var(--violet)' };

export default function StatsPage({ onToast }: StatsPageProps) {
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [role,    setRole]    = useState<Role>('par');

  useEffect(() => {
    apiFetch('/dashboard/admin/stats')
      .then(d => setData(d as any))
      .catch(() => onToast('Erreur lors du chargement des statistiques', 'w'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
      <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', opacity: .4 }} />
    </div>
  );
  if (!data) return null;

  const communes    = data.communes    ?? [];
  const litiges     = data.litiges     ?? [];
  const roles       = data.roles       ?? [];
  const validations = data.validations ?? { enAttente: 0, approuves: 0, refuses: 0 };

  const litMax  = Math.max(...litiges.map((d: any) => d.n), 1);
  const roleMax = Math.max(...roles.map((d: any) => d[role]), 1);

  return (
    <div>
      {/* ── KPIs validations ── */}
      <div className={styles.kpis}>
        <KpiCard variant="k1" icon="fa-hourglass-half" value={String(validations.enAttente)} label="Comptes en attente" />
        <KpiCard variant="k3" icon="fa-check" value={String(validations.approuves)} label="Comptes validés (total)" />
        <KpiCard variant="k4" icon="fa-xmark" value={String(validations.refuses)} label="Comptes refusés (total)" />
      </div>

      {/* ── Litiges + Communes ── */}
      <div className={styles.g2}>
        <div className={styles.card}>
          <div className={styles.ch}>
            <div className={styles.chT}><i className="fas fa-triangle-exclamation" /> Litiges par semaine</div>
          </div>
          <div className={styles.cb}>
            <div className={styles.chart}>
              {litiges.map((d: any) => (
                <div key={d.x} className={styles.cbarWrap}>
                  <div className={styles.cbarSolo}>
                    <div className={styles.cbar} style={{ height: `${(d.n / litMax) * 100}%` }}>
                      <span className={styles.cbarV}>{d.n}</span>
                    </div>
                  </div>
                  <div className={styles.cbarL}>{d.x}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.ch}>
            <div className={styles.chT}><i className="fas fa-map" /> Toutes les communes</div>
            <span className={styles.total}>{communes.length}</span>
          </div>
          <div className={`${styles.cb} ${styles.scrollCb}`}>
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
      </div>

      {/* ── Nouveaux acteurs par rôle ── */}
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.chT}><i className="fas fa-arrow-trend-up" /> Nouveaux acteurs par rôle (12 semaines)</div>
          <div className={styles.chTabs}>
            {(Object.keys(ROLE_LABEL) as Role[]).map(r => (
              <button key={r} className={`${styles.chTab} ${role === r ? styles.chTabOn : ''}`} onClick={() => setRole(r)}>
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.cb}>
          <div className={styles.chart}>
            {roles.map((d: any) => (
              <div key={d.x} className={styles.cbarWrap}>
                <div className={styles.cbarSolo}>
                  <div className={styles.cbar} style={{ height: `${(d[role] / roleMax) * 100}%`, background: ROLE_COLOR[role] }}>
                    <span className={styles.cbarV}>{d[role]}</span>
                  </div>
                </div>
                <div className={styles.cbarL}>{d.x}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
