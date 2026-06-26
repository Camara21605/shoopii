// src/dashboards/entreprise/components/parametres/ParamNav.tsx
import React from 'react';
import type { ParamSection } from '../../pages/parametres/types';
import { PARAM_NAV_SECTIONS } from '../../pages/parametres/types';
import styles from '../../styles/parametres/ParamNav.module.css';

interface Props { active: ParamSection; onChange: (s: ParamSection) => void; }

export default function ParamNav({ active, onChange }: Props) {
  return (
    <nav className={styles.nav}>
      {PARAM_NAV_SECTIONS.map(section => (
        <React.Fragment key={section.title}>
          <div className={styles.sect}>{section.title}</div>
          {section.items.map(item => (
            <div
              key={item.id}
              className={`${styles.item} ${active === item.id ? styles.active : ''} ${item.id === 'danger' ? styles.danger : ''}`}
              onClick={() => onChange(item.id)}
            >
              <i className={`fas ${item.icon}`} />
              <span>{item.label}</span>
              {item.pct !== undefined && <span className={styles.pct}>{item.pct}%</span>}
              {item.dot && <span className={`${styles.dot} ${styles[item.dot]}`} />}
            </div>
          ))}
        </React.Fragment>
      ))}
    </nav>
  );
}
