/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/CodesPage.tsx
 * ================================================================ */

import { useState, useEffect } from 'react';
import styles from '../styles/CodesPage.module.css';
import { apiFetch } from '../../../shared/services/apiFetch';
import Pagination from '../components/Pagination';

interface CodesPageProps {
  onGenerate: () => void;
  onToast:    (msg: string, type?: 's' | 'i' | 'w') => void;
}

const TYPE_LABEL: Record<string, string> = { par: 'Partenaire', ent: 'Entreprise', lvr: 'Livreur', cor: 'Correspondant' };
const TYPE_ICON:  Record<string, string> = { par: 'fa-handshake', ent: 'fa-store', lvr: 'fa-motorcycle', cor: 'fa-map-pin' };
const ST_LABEL:   Record<string, string> = { used: 'Utilisé', sent: 'Envoyé', expired: 'Expiré' };

export default function CodesPage({ onGenerate, onToast }: CodesPageProps) {
  const [page,    setPage]    = useState(1);
  const [data,    setData]    = useState<{ stats: any; list: any[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    apiFetch('/dashboard/admin/codes', { params: { page: String(page), limit: '20' } })
      .then(d => setData(d as any))
      .catch(() => onToast('Erreur lors du chargement des codes', 'w'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page]);

  const copier = (code: string) => {
    navigator.clipboard?.writeText(code);
    onToast('📋 Code copié : ' + code, 's');
  };

  const revoquer = async (id: string, code: string) => {
    try {
      await apiFetch(`/dashboard/admin/codes/${id}`, { method: 'DELETE' });
      onToast('🚫 Code ' + code + ' révoqué', 'w');
      load();
    } catch {
      onToast('Impossible de révoquer ce code', 'w');
    }
  };

  const stats  = data?.stats  ?? { generated: 0, used: 0, pending: 0, expired: 0 };
  const codes  = data?.list   ?? [];
  const total  = data?.total  ?? 0;

  return (
    <div>
      {/* ── Héro ── */}
      <div className={styles.codeHero}>
        <div className={styles.glow} />
        <div className={styles.heroIn}>
          <h3>Codes de création — Zone</h3>
          <p>
            En tant qu&apos;administrateur, vous pouvez créer des comptes de tout type, y compris
            des <b>partenaires</b>. L&apos;acteur qui s&apos;inscrit avec votre code est rattaché à votre zone.
          </p>
        </div>
        <button className={styles.heroBtn} onClick={onGenerate}>
          <i className="fas fa-plus" /> Générer un code
        </button>
      </div>

      {/* ── Stats ── */}
      <div className={styles.stats}>
        <div className={styles.cstat}><div className={styles.cstatV}>{stats.generated}</div><div className={styles.cstatL}>Codes générés</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.vg}`}>{stats.used}</div><div className={styles.cstatL}>Utilisés (compte créé)</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.va}`}>{stats.pending}</div><div className={styles.cstatL}>En attente</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.vr}`}>{stats.expired}</div><div className={styles.cstatL}>Expirés / révoqués</div></div>
      </div>

      {/* ── Tableau ── */}
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.chT}><i className="fas fa-qrcode" /> Historique des codes</div>
          <button className={styles.exportBtn} onClick={() => onToast('📄 Export CSV des codes lancé', 'i')}>
            <i className="fas fa-download" /> Exporter
          </button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', opacity: .4 }}>
            <i className="fas fa-spinner fa-spin fa-2x" />
          </div>
        ) : (
          <div className={styles.tblWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Code</th><th>Type</th><th>Destinataire</th><th>Statut</th><th>Créé le</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {codes.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', opacity: .5, padding: '2rem' }}>Aucun code généré.</td></tr>
                )}
                {codes.map((c: any) => (
                  <tr key={c.id}>
                    <td>
                      <span className={styles.codePill} style={c.statut === 'expired' ? { opacity: .55 } : undefined}>
                        {c.code}
                        <i className={`fas fa-copy ${styles.codeCopy}`} onClick={() => copier(c.code)} />
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.typePill} ${styles['t_' + c.type]}`}>
                        <i className={`fas ${TYPE_ICON[c.type] ?? 'fa-user'}`} /> {TYPE_LABEL[c.type] ?? c.type}
                      </span>
                    </td>
                    <td>{c.destinataire ?? '—'}</td>
                    <td><span className={`${styles.stPill} ${styles['st_' + c.statut]}`}>{ST_LABEL[c.statut] ?? c.statut}</span></td>
                    <td>{c.creeLe}</td>
                    <td>
                      <div className={styles.rowAct}>
                        {c.statut === 'sent' && (
                          <>
                            <button className={`${styles.raBtn} ${styles.wa}`} title="WhatsApp"
                              onClick={() => onToast('📱 Renvoyé via WhatsApp', 's')}>
                              <i className="fab fa-whatsapp" />
                            </button>
                            <button className={styles.raBtn} title="SMS"
                              onClick={() => onToast('✉️ Renvoyé par SMS', 's')}>
                              <i className="fas fa-comment-sms" />
                            </button>
                            <button className={`${styles.raBtn} ${styles.danger}`} title="Révoquer"
                              onClick={() => revoquer(c.id, c.code)}>
                              <i className="fas fa-ban" />
                            </button>
                          </>
                        )}
                        {c.statut === 'used' && (
                          <button className={styles.raBtn} title="Détails"
                            onClick={() => onToast('👤 Compte créé le ' + c.creeLe, 'i')}>
                            <i className="fas fa-eye" />
                          </button>
                        )}
                        {c.statut === 'expired' && (
                          <button className={styles.raBtn} title="Régénérer" onClick={onGenerate}>
                            <i className="fas fa-rotate" />
                          </button>
                        )}
                      </div>
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
