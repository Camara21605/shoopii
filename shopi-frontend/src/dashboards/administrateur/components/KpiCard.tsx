/* ================================================================
 * FICHIER : src/dashboards/administrateur/components/KpiCard.tsx
 *
 * Carte KPI réutilisable.
 * Variantes : k1 (teal), k2 (blue), k3 (emerald), k4 (amber).
 * ================================================================ */

import styles from '../styles/KpiCard.module.css';

interface KpiCardProps {
  variant: 'k1' | 'k2' | 'k3' | 'k4';
  icon:    string;   // classe Font Awesome, ex. "fa-users"
  value:   string;   // valeur principale, ex. "486"
  unit?:   string;   // unité optionnelle, ex. "M GNF"
  label:   string;   // libellé sous la valeur
  delta?:  string;   // variation, ex. "+24" ou "+18%"
  trend?:  'up' | 'down';
}

export default function KpiCard({ variant, icon, value, unit, label, delta, trend }: KpiCardProps) {
  return (
    <div className={`${styles.kpi} ${styles[variant]}`}>
      {/* Barre colorée à gauche (couleur selon la variante) */}
      <div className={styles.stripe} />

      {/* En-tête : icône + badge de variation */}
      <div className={styles.top}>
        <div className={styles.ic}><i className={`fas ${icon}`} /></div>
        {delta && (
          <span className={`${styles.badge} ${trend === 'down' ? styles.dn : styles.up}`}>
            <i className={`fas ${trend === 'down' ? 'fa-arrow-down' : 'fa-arrow-up'}`} /> {delta}
          </span>
        )}
      </div>

      {/* Valeur principale */}
      <div className={styles.v}>{value}{unit && <small> {unit}</small>}</div>

      {/* Libellé */}
      <div className={styles.l}>{label}</div>
    </div>
  );
}
