/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/ClientsPage.tsx
 *
 * Liste (lecture seule) des clients ayant commandé auprès d'une
 * entreprise de la zone. Un client n'appartient à aucune zone en
 * propre (voir admin-clients.service.ts) — cette page montre donc
 * "les clients actifs dans cette zone", pas une propriété exclusive.
 * ================================================================ */

import { useState, useEffect } from 'react';
import styles from '../styles/ClientsPage.module.css';
import { apiFetch } from '../../../shared/services/apiFetch';
import Pagination from '../components/Pagination';

interface ClientsPageProps {
  onToast: (msg: string, type?: 's' | 'i' | 'w') => void;
}

const STATUT_LABEL: Record<string, string> = { act: 'Actif', pend: 'Inactif', susp: 'Suspendu' };

interface ClientRow {
  id: string;
  nom: string;
  avatar: string;
  telephone: string;
  statut: string;
  nbCommandes: number;
  montantTotal: number;
  derniereCommande: string;
}

export default function ClientsPage({ onToast }: ClientsPageProps) {
  const [recherche, setRecherche] = useState('');
  const [page,      setPage]      = useState(1);
  const [data,      setData]      = useState<{ list: ClientRow[]; stats: { total: number }; total: number } | null>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      apiFetch('/dashboard/admin/clients', {
        params: { search: recherche.trim() || undefined, page: String(page), limit: '20' },
      })
        .then(d => setData(d as any))
        .catch(() => onToast('Erreur lors du chargement des clients', 'w'))
        .finally(() => setLoading(false));
    }, recherche ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche, page]);

  const changeRecherche = (v: string) => { setRecherche(v); setPage(1); };

  const clients = data?.list  ?? [];
  const total   = data?.total ?? 0;

  return (
    <div>
      <div className={styles.filterBar}>
        <div className={styles.hint}>
          <i className="fas fa-circle-info" /> Clients ayant passé au moins une commande dans votre zone.
        </div>
        <div className={styles.searchIn}>
          <i className="fas fa-magnifying-glass" />
          <input placeholder="Nom, téléphone…" value={recherche}
            onChange={e => changeRecherche(e.target.value)} />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.chT}><i className="fas fa-users" /> Clients de la zone</div>
          <span className={styles.total}>{data?.stats.total ?? 0} client{(data?.stats.total ?? 0) > 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', opacity: .4 }}>
            <i className="fas fa-spinner fa-spin fa-2x" />
          </div>
        ) : (
          <div className={styles.tblWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Client</th><th>Téléphone</th><th>Commandes (zone)</th><th>Montant total (zone)</th><th>Dernière commande</th><th>Statut</th></tr>
              </thead>
              <tbody>
                {clients.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', opacity: .5, padding: '2rem' }}>Aucun client trouvé.</td></tr>
                )}
                {clients.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div className={styles.uCell}>
                        <div className={styles.uAv}>{c.avatar}</div>
                        <div className={styles.uNm}>{c.nom}</div>
                      </div>
                    </td>
                    <td>{c.telephone}</td>
                    <td>{c.nbCommandes}</td>
                    <td>{c.montantTotal.toLocaleString('fr-FR')} GNF</td>
                    <td>{c.derniereCommande}</td>
                    <td><span className={`${styles.state} ${styles['state_' + c.statut]}`}>{STATUT_LABEL[c.statut] ?? c.statut}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} limit={20} total={total} onChange={setPage} />
      </div>
    </div>
  );
}
