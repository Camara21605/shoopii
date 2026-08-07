/* ================================================================
 * FICHIER : correspondants/components/ListItemCorrespondant.tsx
 *
 * Ligne d'un correspondant (vue liste).
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import styles from '../styles/Correspondants.module.css';
import type { Correspondant } from '../data/types';

const AVA_BG: Record<string, string> = {
  regional: 'linear-gradient(135deg,#3B0764,#7C3AED)',
  zonal:    'linear-gradient(135deg,#1e3a8a,#1549B8)',
  national: 'linear-gradient(135deg,#78350F,#B45309)',
};

interface Props {
  c:        Correspondant;
  onToggle: (id: string) => void;
  onView:   (id: string) => void;
}

export default function ListItemCorrespondant({ c, onToggle, onView }: Props) {
  const { t } = useTranslation();
  const TYPE_LABEL: Record<string, string> = {
    regional: t('correspondantsPage.typeLabel.regional'),
    zonal: t('correspondantsPage.typeLabel.zonal'),
    national: t('correspondantsPage.typeLabel.national'),
  };
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
          <span><i className="fas fa-box" /> {t('correspondantsPage.listItem.missionsCount', { count: c.missions.toLocaleString('fr-FR') })}</span>
        </div>
      </div>
      <div className={styles.liR}>
        <button
          className={`${styles.liFlw} ${c.suivi ? styles.fbOn : styles.fbOff}`}
          onClick={e => { e.stopPropagation(); onToggle(c.id); }}
        >
          {c.suivi ? <><i className="fas fa-user-check" /> {t('correspondantsPage.listItem.abonne')}</> : <><i className="fas fa-plus" /> {t('correspondantsPage.listItem.suivre')}</>}
        </button>
      </div>
    </div>
  );
}