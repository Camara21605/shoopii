/* ================================================================
 * FICHIER : src/dashboards/partenaire/pages/CommissionsPage.tsx
 * Commissions : solde + KPIs taux + historique.
 * ================================================================ */

import styles from '../styles/CommissionsPage.module.css';
import KpiCard from '../components/KpiCard';
import { COMMISSIONS, TYPE_LABEL, TYPE_ICON, fmtGnf } from '../data/partenaireData';
import type { PartenairePage } from '../data/types';

interface Props {
  onNavigate: (p: PartenairePage) => void;
  onToast:    (msg: string, type?: 's' | 'i' | 'w') => void;
}

export default function CommissionsPage({ onNavigate, onToast }: Props) {
  return (
    <div>
      {/* Solde */}
      <div className={styles.bal}>
        <div className={styles.balGlow} />
        <div className={styles.balIn}>
          <div className={styles.balL}>Commissions disponibles</div>
          <div className={styles.balV}>8 640 000 <small>GNF</small></div>
          <div className={styles.balBtns}>
            <button className={`${styles.cbb} ${styles.w}`} onClick={() => onToast('💸 Demande de retrait envoyée', 's')}><i className="fas fa-arrow-up-from-bracket" /> Retirer</button>
            <button className={styles.cbb} onClick={() => onNavigate('paiements')}><i className="fas fa-clock-rotate-left" /> Historique</button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className={styles.kpis}>
        <KpiCard variant="k3" icon="fa-coins"         value="24,8" unit="M"  label="Total gagné" />
        <KpiCard variant="k2" icon="fa-arrows-rotate" value="1,2"  unit="M"  label="Récurrent / mois" />
        <KpiCard variant="k1" icon="fa-store"         value="5"    unit="%"  label="Sur ventes entreprises" />
        <KpiCard variant="k4" icon="fa-motorcycle"    value="2"    unit="%"  label="Sur courses livreurs" />
      </div>

      {/* Historique */}
      <div className={styles.card}>
        <div className={styles.ch}><div className={styles.chT}><i className="fas fa-list-ul" /> Commissions récentes</div></div>
        <div className={styles.tblWrap}>
          <table className={styles.table}>
            <thead><tr><th>Source</th><th>Type</th><th>Détail</th><th>Date</th><th>Montant</th></tr></thead>
            <tbody>
              {COMMISSIONS.map((c, i) => (
                <tr key={i}>
                  <td>{c.source}</td>
                  <td><span className={`${styles.typePill} ${styles['t_' + c.type]}`}><i className={`fas ${TYPE_ICON[c.type]}`} /> {TYPE_LABEL[c.type]}</span></td>
                  <td>{c.detail}</td>
                  <td>{c.date}</td>
                  <td className={styles.amt}>+{fmtGnf(c.montant)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
