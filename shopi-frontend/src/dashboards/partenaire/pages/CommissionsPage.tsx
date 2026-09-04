/* ================================================================
 * FICHIER : src/dashboards/partenaire/pages/CommissionsPage.tsx
 * Commissions : solde + historique — données réelles.
 * ================================================================ */

import { useState, useEffect } from 'react';
import styles from '../styles/CommissionsPage.module.css';
import KpiCard from '../components/KpiCard';
import WithdrawModal from '../components/WithdrawModal';
import { TYPE_LABEL, TYPE_ICON, fmtGnf } from '../data/partenaireData';
import { apiFetch } from '@/shared/services/apiFetch';
import type { PartenairePage } from '../data/types';

interface Props {
  onNavigate: (p: PartenairePage) => void;
  onToast:    (msg: string, type?: 's' | 'i' | 'w') => void;
}

interface CommissionRow {
  source:  string;
  type:    string;
  detail:  string;
  date:    string;
  montant: number;
  statut:  string;
}

interface CommissionsData {
  balance:          number;
  totalGagne:       number;
  commissionsMonth: number;
  tauxVentes:       number;
  tauxLivraisons:   number;
  historique:       CommissionRow[];
}

export default function CommissionsPage({ onNavigate, onToast }: Props) {
  const [data, setData]       = useState<CommissionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  useEffect(() => {
    apiFetch<CommissionsData>('/dashboard/partenaire/commissions')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
      <i className="fas fa-spinner fa-spin" style={{ fontSize: 24 }} />
    </div>
  );

  const balance          = data?.balance ?? 0;
  const totalGagne       = data?.totalGagne ?? 0;
  const commissionsMonth = data?.commissionsMonth ?? 0;
  const tauxVentes       = data?.tauxVentes ?? 0;
  const tauxLivraisons   = data?.tauxLivraisons ?? 0;
  const historique       = data?.historique ?? [];

  return (
    <div>
      {/* Solde */}
      <div className={styles.bal}>
        <div className={styles.balGlow} />
        <div className={styles.balIn}>
          <div className={styles.balL}>Commissions disponibles</div>
          <div className={styles.balV}>{fmtGnf(balance)}</div>
          <div className={styles.balBtns}>
            <button className={`${styles.cbb} ${styles.w}`} onClick={() => setWithdrawOpen(true)} disabled={balance <= 0}><i className="fas fa-arrow-up-from-bracket" /> Retirer</button>
            <button className={styles.cbb} onClick={() => onNavigate('paiements')}><i className="fas fa-clock-rotate-left" /> Historique</button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className={styles.kpis}>
        <KpiCard variant="k3" icon="fa-coins"         value={fmtGnf(totalGagne)}       label="Total gagné" />
        <KpiCard variant="k2" icon="fa-arrows-rotate" value={fmtGnf(commissionsMonth)} label="Ce mois" />
        <KpiCard variant="k1" icon="fa-store"         value={String(tauxVentes)}     unit="%" label="Sur ventes entreprises" />
        <KpiCard variant="k4" icon="fa-motorcycle"    value={String(tauxLivraisons)} unit="%" label="Sur courses livreurs" />
      </div>

      {/* Historique */}
      <div className={styles.card}>
        <div className={styles.ch}><div className={styles.chT}><i className="fas fa-list-ul" /> Commissions récentes</div></div>
        {historique.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>Aucune commission pour le moment</div>
        ) : (
          <div className={styles.tblWrap}>
            <table className={styles.table}>
              <thead><tr><th>Source</th><th>Type</th><th>Détail</th><th>Date</th><th>Montant</th></tr></thead>
              <tbody>
                {historique.map((c, i) => (
                  <tr key={i}>
                    <td>{c.source}</td>
                    <td><span className={`${styles.typePill} ${styles['t_' + c.type]}`}><i className={`fas ${TYPE_ICON[c.type] ?? 'fa-circle'}`} /> {TYPE_LABEL[c.type] ?? c.type}</span></td>
                    <td>{c.detail}</td>
                    <td>{c.date}</td>
                    <td className={styles.amt}>+{fmtGnf(c.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {withdrawOpen && (
        <WithdrawModal
          balance={balance}
          onClose={() => setWithdrawOpen(false)}
          onToast={onToast}
          onSuccess={newBalance => setData(prev => prev ? { ...prev, balance: newBalance } : prev)}
        />
      )}
    </div>
  );
}
