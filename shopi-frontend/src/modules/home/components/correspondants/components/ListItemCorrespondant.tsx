/* ================================================================
 * FICHIER : correspondants/components/ListItemCorrespondant.tsx
 *
 * Ligne d'un correspondant (vue liste).
 * ================================================================ */

import React from 'react';
import styles from '../styles/Correspondants.module.css';
import type { Correspondant } from '../data/types';

const AVA_BG: Record<string, string> = {
  regional: 'linear-gradient(135deg,#3B0764,#7C3AED)',
  zonal:    'linear-gradient(135deg,#1e3a8a,#1549B8)',
  national: 'linear-gradient(135deg,#78350F,#B45309)',
};
const TYPE_LABEL: Record<string, string> = {
  regional: '🏠 Régional', zonal: '🗺️ Zonal', national: '🌍 National',
};

interface Props {
  c:        Correspondant;
  onToggle: (id: string) => void;
  onView:   (id: string) => void;
}

export default function ListItemCorrespondant({ c, onToggle, onView }: Props) {
  return (
    <div className={styles.listItem} onClick={() => onView(c.id)}>
      <div className={styles.liAva} style={{ background: AVA_BG[c.type] }}>
        {c.initiales}
        {c.enLigne && <div className={styles.liDot} />}
      </div>
      <div className={styles.liInf}>
        <div className={styles.liNm}>{c.nom}</div>
        <div className={styles.liMeta}>
          <span><i className="fas fa-map-pin" /> {c.zone}</span>
          <span>{TYPE_LABEL[c.type]}</span>
          <span><i className="fas fa-star" style={{ color: '#F59E0B' }} /> {c.note.toFixed(1)}</span>
          <span><i className="fas fa-box" /> {c.missions.toLocaleString('fr-FR')} missions</span>
        </div>
      </div>
      <div className={styles.liR}>
        <button
          className={`${styles.liFlw} ${c.suivi ? styles.fbOn : styles.fbOff}`}
          onClick={e => { e.stopPropagation(); onToggle(c.id); }}
        >
          {c.suivi ? <><i className="fas fa-user-check" /> Abonné</> : <><i className="fas fa-plus" /> Suivre</>}
        </button>
      </div>
    </div>
  );
}