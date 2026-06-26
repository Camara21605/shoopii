// src/dashboards/entreprise/components/parametres/FormCard.tsx
import React from 'react';
import styles from '../../styles/parametres/FormCard.module.css';

interface Props {
  title: string; icon: string; subtitle?: string;
  action?: React.ReactNode; danger?: boolean; children: React.ReactNode;
}

export default function FormCard({ title, icon, subtitle, action, danger, children }: Props) {
  return (
    <div className={`${styles.card} ${danger ? styles.dangerCard : ''}`}>
      <div className={`${styles.hd} ${danger ? styles.dangerHd : ''}`}>
        <div>
          <div className={styles.title}><i className={`fas ${icon}`} />{title}</div>
          {subtitle && <div className={styles.sub}>{subtitle}</div>}
        </div>
        {action}
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
