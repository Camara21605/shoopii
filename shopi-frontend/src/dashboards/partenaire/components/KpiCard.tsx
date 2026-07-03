/* ================================================================
 * FICHIER : src/dashboards/partenaire/components/KpiCard.tsx
 * Carte KPI réutilisable (overview, commissions...).
 * ================================================================ */

import styles from '../styles/KpiCard.module.css';

interface KpiCardProps {
  variant: 'k1' | 'k2' | 'k3' | 'k4';
  icon:    string;
  value:   string;
  unit?:   string;
  label:   string;
  delta?:  string;
  trend?:  'up' | 'down';
}

export default function KpiCard({ variant, icon, value, unit, label, delta, trend }: KpiCardProps) {
  return (
    <div className={`${styles.kpi} ${styles[variant]}`}>
      <div className={styles.stripe} />
      <div className={styles.top}>
        <div className={styles.ic}><i className={`fas ${icon}`} /></div>
        {delta && (
          <span className={`${styles.badge} ${trend === 'down' ? styles.dn : styles.up}`}>
            <i className={`fas ${trend === 'down' ? 'fa-arrow-down' : 'fa-arrow-up'}`} /> {delta}
          </span>
        )}
      </div>
      <div className={styles.v}>{value}{unit && <small> {unit}</small>}</div>
      <div className={styles.l}>{label}</div>
    </div>
  );
}
