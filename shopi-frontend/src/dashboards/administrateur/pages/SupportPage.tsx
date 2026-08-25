/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/SupportPage.tsx
 *
 * File d'attente support de la zone — agent complet (répondre,
 * statut, priorité, assignation). Consomme /support/agent/* déjà
 * scopé zone côté backend (SupportPermissionService, aucune
 * modification backend nécessaire — voir plan).
 * ================================================================ */

import { useState, useEffect, useCallback } from 'react';
import styles from '../styles/SupportPage.module.css';
import KpiCard from '../components/KpiCard';
import TicketDetailModal from '../components/TicketDetailModal';
import { apiFetch } from '../../../shared/services/apiFetch';
import { useAppContext } from '../../../shared/context/AppContext';

interface SupportPageProps {
  onToast: (msg: string, type?: 's' | 'i' | 'w') => void;
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Ouvert', in_progress: 'En cours', waiting_user: 'Attente client', resolved: 'Résolu', closed: 'Fermé',
};
const PRIORITY_LABEL: Record<string, string> = { low: 'Basse', normal: 'Normale', high: 'Haute', urgent: 'Urgente' };
const STATUS_FILTERS = ['', 'open', 'in_progress', 'waiting_user', 'resolved', 'closed'];

interface SupportOverview {
  total: number;
  byStatus: { status: string; count: number }[];
  avgResponseTime: number | null;
  csat: number | null;
  slaViolations: number;
}

export default function SupportPage({ onToast }: SupportPageProps) {
  const { user } = useAppContext();
  const [stats,      setStats]      = useState<SupportOverview | null>(null);
  const [tickets,    setTickets]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [statusF,    setStatusF]    = useState('');
  const [search,     setSearch]     = useState('');
  const [openTicket, setOpenTicket] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch<SupportOverview>('/support/agent/stats'),
      apiFetch<{ data: any[]; total: number }>('/support/agent/tickets', {
        params: { limit: '50', status: statusF || undefined, search: search || undefined },
      }),
    ])
      .then(([s, t]) => { setStats(s); setTickets(t.data ?? []); })
      .catch(() => onToast('Erreur lors du chargement du support', 'w'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusF, search]);

  useEffect(load, [load]);

  const exportCsv = () => {
    const a = document.createElement('a');
    a.href = `${(import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001/api'}/support/agent/export`;
    a.click();
    a.remove();
    onToast('📄 Export CSV lancé', 'i');
  };

  const activeCount = stats
    ? (stats.byStatus.find(b => b.status === 'open')?.count ?? 0)
    + (stats.byStatus.find(b => b.status === 'in_progress')?.count ?? 0)
    + (stats.byStatus.find(b => b.status === 'waiting_user')?.count ?? 0)
    : 0;

  return (
    <div>
      {/* ── KPIs ── */}
      {stats && (
        <div className={styles.kpis}>
          <KpiCard variant="k1" icon="fa-headset" value={String(stats.total)} label="Total tickets" />
          <KpiCard variant="k2" icon="fa-fire" value={String(activeCount)} label="Tickets actifs" />
          <KpiCard variant="k4" icon="fa-clock" value={String(stats.slaViolations)} label="SLA dépassés" />
          <KpiCard variant="k3" icon="fa-star" value={stats.csat != null ? stats.csat.toFixed(1) : '—'} unit="/5" label="Satisfaction (CSAT)" />
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.chT}><i className="fas fa-headset" /> File d'attente support</div>
          <div className={styles.filters}>
            <select value={statusF} onChange={e => setStatusF(e.target.value)}>
              {STATUS_FILTERS.map(s => <option key={s} value={s}>{s ? STATUS_LABEL[s] : 'Tous statuts'}</option>)}
            </select>
            <div className={styles.searchIn}>
              <i className="fas fa-magnifying-glass" />
              <input placeholder="Référence, sujet…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className={styles.exportBtn} onClick={exportCsv}>
              <i className="fas fa-download" /> Exporter
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', opacity: .4 }}>
            <i className="fas fa-spinner fa-spin fa-2x" />
          </div>
        ) : (
          <div className={styles.tblWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Référence</th><th>Sujet</th><th>Statut</th><th>Priorité</th><th>Créé le</th></tr>
              </thead>
              <tbody>
                {tickets.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', opacity: .5, padding: '2rem' }}>Aucun ticket.</td></tr>
                )}
                {tickets.map(t => (
                  <tr key={t.id} className={styles.row} onClick={() => setOpenTicket(t.id)}>
                    <td className={styles.refCell}>{t.reference}</td>
                    <td>{t.subject}</td>
                    <td><span className={`${styles.stPill} ${styles['st_' + t.status]}`}>{STATUS_LABEL[t.status] ?? t.status}</span></td>
                    <td><span className={`${styles.prPill} ${styles['pr_' + t.priority]}`}>{PRIORITY_LABEL[t.priority] ?? t.priority}</span></td>
                    <td>{new Date(t.createdAt).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openTicket && user && (
        <TicketDetailModal
          ticketId={openTicket}
          currentUserId={user.id}
          onClose={() => setOpenTicket(null)}
          onToast={onToast}
          onChanged={load}
        />
      )}
    </div>
  );
}
