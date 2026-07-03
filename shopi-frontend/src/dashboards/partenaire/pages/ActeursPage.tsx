/* ================================================================
 * FICHIER : src/dashboards/partenaire/pages/ActeursPage.tsx
 * Mes acteurs : grille filtrable + bouton signaler par carte.
 * ================================================================ */

import { useState } from 'react';
import styles from '../styles/ActeursPage.module.css';
import { ACTEURS } from '../data/partenaireData';
import type { ActeurType } from '../data/types';

interface Props {
  onReport: (cible: string) => void;
  onToast:  (msg: string, type?: 's' | 'i' | 'w') => void;
}

type Filter = 'all' | ActeurType;
const FILTERS: { id: Filter; icon?: string; label: string; n: number }[] = [
  { id: 'all', label: 'Tous', n: 39 },
  { id: 'ent', icon: 'fa-store',      label: 'Entreprises',    n: 14 },
  { id: 'lvr', icon: 'fa-motorcycle', label: 'Livreurs',       n: 19 },
  { id: 'cor', icon: 'fa-map-pin',    label: 'Correspondants', n: 6 },
];

export default function ActeursPage({ onReport, onToast }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const list = ACTEURS.filter(a => filter === 'all' || a.type === filter);

  return (
    <div>
      <div className={styles.filterBar}>
        {FILTERS.map(f => (
          <button key={f.id}
            className={`${styles.fchip} ${filter === f.id ? styles.on : ''}`}
            onClick={() => setFilter(f.id)}>
            {f.icon && <i className={`fas ${f.icon}`} />} {f.label} <span className={styles.n}>{f.n}</span>
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        {list.map(a => (
          <div key={a.id} className={styles.acard}>
            <div className={styles.top}>
              <div className={`${styles.av} ${styles['av_' + a.type]}`}>
                {a.avatar}<span className={`${styles.on2} ${styles['on_' + a.statut]}`} />
              </div>
              <div style={{ flex: 1 }}>
                <div className={styles.nm}>{a.nom}</div>
                <div className={styles.meta}>{a.meta}</div>
              </div>
              <span className={`${styles.state} ${styles['state_' + a.statut]}`}>
                {a.statut === 'act' ? 'Actif' : 'En attente'}
              </span>
            </div>

            <div className={styles.body}>
              <div className={styles.stat}><div className={styles.sv}>{a.stat1.valeur}</div><div className={styles.sl}>{a.stat1.label}</div></div>
              <div className={styles.stat}><div className={styles.sv}>{a.stat2.valeur}</div><div className={styles.sl}>{a.stat2.label}</div></div>
            </div>

            <div className={styles.foot}>
              <div className={styles.commission}><i className="fas fa-coins" /> {a.commission}</div>
              <div className={styles.footActs}>
                <button className={styles.gerer} onClick={() => onToast(`👤 Profil de ${a.nom}`, 'i')}>Gérer</button>
                <button className={styles.flag} title="Signaler cet acteur" onClick={() => onReport(a.nom)}><i className="fas fa-flag" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
