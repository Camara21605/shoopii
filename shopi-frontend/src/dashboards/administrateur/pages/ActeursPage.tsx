/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/ActeursPage.tsx
 * ================================================================ */

import { useState, useEffect } from 'react';
import styles from '../styles/ActeursPage.module.css';
import { apiFetch } from '../../../shared/services/apiFetch';
import type { ActeurType } from '../data/types';

interface ActeursPageProps {
  onSanction: (cible: string) => void;
  onToast:    (msg: string, type?: 's' | 'i' | 'w') => void;
}

const TYPE_LABEL: Record<string, string> = { par: 'Partenaire', ent: 'Entreprise', lvr: 'Livreur', cor: 'Correspondant' };
const TYPE_ICON:  Record<string, string> = { par: 'fa-handshake', ent: 'fa-store', lvr: 'fa-motorcycle', cor: 'fa-map-pin' };
const STATUT_LABEL: Record<string, string> = { act: 'Actif', pend: 'En attente', susp: 'Suspendu' };

export default function ActeursPage({ onSanction, onToast }: ActeursPageProps) {
  const [filtre,    setFiltre]    = useState<'all' | ActeurType>('all');
  const [recherche, setRecherche] = useState('');
  const [data,      setData]      = useState<{ list: any[]; counts: Record<string, number> } | null>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    apiFetch('/dashboard/admin/acteurs')
      .then(d => setData(d as any))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const counts  = data?.counts ?? { all: 0, par: 0, ent: 0, lvr: 0, cor: 0 };
  const acteurs = (data?.list ?? []).filter((a: any) =>
    (filtre === 'all' || a.type === filtre) &&
    a.nom.toLowerCase().includes(recherche.toLowerCase())
  );

  const FILTRES = [
    { id: 'all', label: 'Tous',           n: counts.all, icon: undefined },
    { id: 'par', label: 'Partenaires',    n: counts.par, icon: 'fa-handshake' },
    { id: 'ent', label: 'Entreprises',    n: counts.ent, icon: 'fa-store' },
    { id: 'lvr', label: 'Livreurs',       n: counts.lvr, icon: 'fa-motorcycle' },
    { id: 'cor', label: 'Correspondants', n: counts.cor, icon: 'fa-map-pin' },
  ] as const;

  return (
    <div>
      {/* ── Filtres + recherche ── */}
      <div className={styles.filterBar}>
        {FILTRES.map(f => (
          <button key={f.id} className={`${styles.fchip} ${filtre === f.id ? styles.fon : ''}`}
            onClick={() => setFiltre(f.id as 'all' | ActeurType)}>
            {f.icon && <i className={`fas ${f.icon}`} />} {f.label} <span className={styles.n}>{f.n}</span>
          </button>
        ))}
        <div className={styles.searchIn}>
          <i className="fas fa-magnifying-glass" />
          <input placeholder="Nom, téléphone, ID…" value={recherche}
            onChange={e => setRecherche(e.target.value)} />
        </div>
      </div>

      {/* ── Tableau ── */}
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.chT}><i className="fas fa-people-group" /> Tous les acteurs</div>
          <button className={styles.exportBtn} onClick={() => onToast('📄 Export CSV des acteurs lancé', 'i')}>
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
                <tr><th>Acteur</th><th>Rôle</th><th>Commune</th><th>Recruté par</th><th>Activité</th><th>Statut</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {acteurs.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', opacity: .5, padding: '2rem' }}>Aucun acteur trouvé.</td></tr>
                )}
                {acteurs.map((a: any) => (
                  <tr key={a.id}>
                    <td>
                      <div className={styles.uCell}>
                        <div className={`${styles.uAv} ${styles['av_' + a.type]}`}
                          style={a.statut === 'susp' ? { opacity: .6 } : undefined}>
                          {a.avatar}
                        </div>
                        <div>
                          <div className={styles.uNm} style={a.statut === 'susp' ? { color: 'var(--t3)' } : undefined}>
                            {a.nom}
                          </div>
                          <div className={styles.uMeta}>{a.telephone}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.typePill} ${styles['t_' + a.type]}`}>
                        <i className={`fas ${TYPE_ICON[a.type] ?? 'fa-user'}`} /> {TYPE_LABEL[a.type] ?? a.type}
                      </span>
                    </td>
                    <td>{a.commune}</td>
                    <td>{a.recrutePar}</td>
                    <td>{a.activite}</td>
                    <td><span className={`${styles.state} ${styles['state_' + a.statut]}`}>{STATUT_LABEL[a.statut] ?? a.statut}</span></td>
                    <td>
                      <div className={styles.rowAct}>
                        {a.statut === 'susp' ? (
                          <>
                            <button className={styles.raBtn} title="Dossier"
                              onClick={() => onToast('📁 Dossier de suspension', 'i')}>
                              <i className="fas fa-folder-open" />
                            </button>
                            <button className={styles.raBtn} title="Réactiver"
                              onClick={() => onToast('✅ Compte réactivé', 's')}>
                              <i className="fas fa-rotate-left" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button className={styles.raBtn} title="Profil"
                              onClick={() => onToast('👤 Profil ' + a.nom, 'i')}>
                              <i className="fas fa-eye" />
                            </button>
                            <button className={`${styles.raBtn} ${styles.danger}`} title="Suspendre"
                              onClick={() => onSanction(a.nom)}>
                              <i className="fas fa-ban" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
