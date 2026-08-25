/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/CommandesPage.tsx
 * ================================================================ */

import { useState, useEffect } from 'react';
import styles from '../styles/CommandesPage.module.css';
import { apiFetch } from '../../../shared/services/apiFetch';
import Pagination from '../components/Pagination';

interface CommandesPageProps {
  onToast: (msg: string, type?: 's' | 'i' | 'w') => void;
}

const fmtGnf = (n: number) => n.toLocaleString('fr-FR') + ' GNF';

const ST_LABEL: Record<string, string> = {
  paid: 'Payée', prep: 'Préparation', ship: 'En livraison',
  relay: 'Au relais', done: 'Livrée', dispute: 'Litige',
};

type Onglet = 'toutes' | 'encours' | 'litiges';

export default function CommandesPage({ onToast }: CommandesPageProps) {
  const [onglet,  setOnglet]  = useState<Onglet>('toutes');
  const [page,    setPage]    = useState(1);
  const [data,    setData]    = useState<{ list: any[]; stats: any; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch('/dashboard/admin/commandes', { params: { onglet, page: String(page), limit: '20' } })
      .then(d => setData(d as any))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [onglet, page]);

  const changeOnglet = (o: Onglet) => { setOnglet(o); setPage(1); };

  const stats     = data?.stats ?? { total: 0, reussies: 0, tauxReussite: 0, enCours: 0, litiges: 0 };
  const commandes = data?.list  ?? [];
  const total     = data?.total ?? 0;

  return (
    <div>
      {/* ── Stats ── */}
      <div className={styles.stats}>
        <div className={styles.cstat}><div className={styles.cstatV}>{stats.total.toLocaleString('fr-FR')}</div><div className={styles.cstatL}>Commandes (total)</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.vg}`}>{stats.tauxReussite}%</div><div className={styles.cstatL}>Livrées avec succès</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.va}`}>{stats.enCours}</div><div className={styles.cstatL}>En cours de livraison</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.vr}`}>{stats.litiges}</div><div className={styles.cstatL}>Litiges ouverts</div></div>
      </div>

      {/* ── Tableau ── */}
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.chT}><i className="fas fa-box" /> Commandes récentes de la zone</div>
          <div className={styles.chRight}>
            <div className={styles.chTabs}>
              {(['toutes', 'encours', 'litiges'] as Onglet[]).map(o => (
                <button key={o} className={`${styles.chTab} ${onglet === o ? styles.chTabOn : ''}`}
                  onClick={() => changeOnglet(o)}>
                  {o === 'toutes' ? 'Toutes' : o === 'encours' ? 'En cours' : 'Litiges'}
                </button>
              ))}
            </div>
            <button className={styles.exportBtn} onClick={() => onToast('📄 Export CSV des commandes', 'i')}>
              <i className="fas fa-download" />
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
                <tr><th>Commande</th><th>Client</th><th>Entreprise</th><th>Montant</th><th>Chaîne de validation</th><th>Statut</th><th></th></tr>
              </thead>
              <tbody>
                {commandes.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', opacity: .5, padding: '2rem' }}>Aucune commande.</td></tr>
                )}
                {commandes.map((c: any) => (
                  <tr key={c.id}>
                    <td><b>{c.id}</b><div className={styles.uMeta}>{c.quand}</div></td>
                    <td>{c.client}</td>
                    <td>{c.entreprise}</td>
                    <td>{fmtGnf(c.montant)}</td>
                    <td>
                      <div className={styles.miniProg}>
                        {[0, 1, 2, 3].map(i => (
                          <span key={i} className={i < c.progression ? styles.done : ''} />
                        ))}
                      </div>
                    </td>
                    <td><span className={`${styles.ordSt} ${styles['ord_' + c.statut]}`}>{ST_LABEL[c.statut] ?? c.statut}</span></td>
                    <td>
                      {c.statut === 'dispute' ? (
                        <button className={styles.arbBtn} onClick={() => onToast('⚖️ Arbitrage du litige ouvert', 'i')}>
                          <i className="fas fa-scale-balanced" /> Arbitrer
                        </button>
                      ) : c.statut === 'done' ? (
                        <button className={styles.raBtn} title="Facture"
                          onClick={() => onToast('🧾 Facture ' + c.id, 'i')}>
                          <i className="fas fa-file-invoice" />
                        </button>
                      ) : (
                        <button className={styles.raBtn} title="Suivre"
                          onClick={() => onToast('📦 Chaîne de validation ' + c.id, 'i')}>
                          <i className="fas fa-eye" />
                        </button>
                      )}
                    </td>
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
