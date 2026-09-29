// src/dashboards/livreur/components/ParamNav.tsx
// Navigation secondaire gauche de la page Paramètres
// 10 items groupés : Identité / Activité / Finances / Compte

import { useTranslation } from 'react-i18next';
import { buildGroups, type ParamSectionId } from '../data/parametresData';
import styles from '../styles/ParamNav.module.css';

interface Props {
  active:   ParamSectionId;
  onSelect: (s: ParamSectionId) => void;
  onBack:   () => void;
}

export default function ParamNav({ active, onSelect, onBack }: Props) {
  const { t } = useTranslation();
  const GROUPS = buildGroups(t);
  return (
    <nav className={styles.nav}>
      {/* Retour dashboard */}
      {/* Vrais boutons (avant : <div> cliquables, inaccessibles au clavier) */}
      <button type="button" className={styles.back} onClick={onBack}>
        <i className="fas fa-arrow-left" />
        <span>{t('livreurParametres.nav.tableauDeBord')}</span>
      </button>

      {GROUPS.map(grp => (
        <div key={grp.title} className={styles.group}>
          <div className={styles.sect}>{grp.title}</div>
          {grp.items.map(item => (
            <button
              type="button"
              key={item.id}
              aria-current={active === item.id ? 'page' : undefined}
              className={`${styles.item} ${active === item.id ? styles.on : ''} ${item.warn === 'r' ? styles.dangerItem : ''}`}
              onClick={() => onSelect(item.id)}
            >
              <i className={`fas ${item.icon} ${styles.icon} ${active === item.id ? styles.iconOn : ''} ${item.warn === 'r' ? styles.iconDanger : ''}`} />
              <span>{item.label}</span>
              {item.warn && (
                <div className={`${styles.dot} ${item.warn === 'r' ? styles.dotR : styles.dotA}`} />
              )}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}