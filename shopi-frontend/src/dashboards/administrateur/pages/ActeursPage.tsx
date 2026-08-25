/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/ActeursPage.tsx
 * ================================================================ */

import { useState, useEffect } from 'react';
import styles from '../styles/ActeursPage.module.css';
import { apiFetch } from '../../../shared/services/apiFetch';
import Pagination from '../components/Pagination';
import type { ActeurType } from '../data/types';

interface ActeursPageProps {
  onSanction: (cible: string) => void;
  onToast:    (msg: string, type?: 's' | 'i' | 'w') => void;
  /* Permissions "Modules généraux" de l'admin connecté (super-admin →
   * Permissions Admins). Un type d'acteur sans permission correspondante
   * accordée n'apparaît ni dans les filtres ni dans la liste. */
  geoPerms?:  Record<string, boolean | string | null>;
}

const TYPE_LABEL: Record<string, string> = { par: 'Partenaire', ent: 'Entreprise', lvr: 'Livreur', cor: 'Correspondant' };
const TYPE_ICON:  Record<string, string> = { par: 'fa-handshake', ent: 'fa-store', lvr: 'fa-motorcycle', cor: 'fa-map-pin' };
const STATUT_LABEL: Record<string, string> = { act: 'Actif', pend: 'En attente', susp: 'Suspendu' };

/* Type d'acteur → clé de permission "Modules généraux" requise.
 * 'cor' (correspondant) n'a pas d'équivalent dans les 8 permissions
 * générales — toujours visible, comme avant ce chantier. */
const TYPE_PERM: Partial<Record<ActeurType, string>> = {
  par: 'partners', ent: 'companies', lvr: 'delivery',
};

export default function ActeursPage({ onSanction, onToast, geoPerms }: ActeursPageProps) {
  const [filtre,    setFiltre]    = useState<'all' | ActeurType>('all');
  const [recherche, setRecherche] = useState('');
  const [page,      setPage]      = useState(1);
  const [data,      setData]      = useState<{ list: any[]; counts: Record<string, number>; total: number } | null>(null);
  const [loading,   setLoading]   = useState(true);

  /* Filtre, recherche et pagination sont appliqués côté backend —
   * débounce léger sur la recherche pour ne pas relancer une requête
   * à chaque frappe. */
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      apiFetch('/dashboard/admin/acteurs', {
        params: {
          role:   filtre !== 'all' ? filtre : undefined,
          search: recherche.trim() || undefined,
          page:   String(page),
          limit:  '20',
        },
      })
        .then(d => setData(d as any))
        .catch(console.error)
        .finally(() => setLoading(false));
    }, recherche ? 300 : 0);
    return () => clearTimeout(t);
  }, [filtre, recherche, page]);

  /* Changer de filtre ou de recherche revient à la page 1 — géré ici
   * (plutôt qu'un useEffect séparé) pour éviter un double fetch : un
   * effet réactif sur [filtre, recherche] qui appelle setPage(1)
   * déclencherait une 1ère requête avec l'ancienne page, puis une 2e
   * après le reset. */
  const changeFiltre = (f: 'all' | ActeurType) => { setFiltre(f); setPage(1); };
  const changeRecherche = (v: string) => { setRecherche(v); setPage(1); };

  /* true si permission absente de TYPE_PERM (ex: 'cor') ou explicitement
   * accordée — cohérent avec le comportement "toujours visible avant"
   * pour les types qui n'ont jamais eu de permission dédiée. */
  const typeAllowed = (type: ActeurType) => {
    const perm = TYPE_PERM[type];
    return perm === undefined || geoPerms?.[perm] === true;
  };

  /* Si le filtre actif devient inaccessible (permission retirée pendant
   * que l'admin est sur cette page), on revient sur "Tous" plutôt que
   * de laisser un filtre fantôme actif sans chip correspondant. */
  useEffect(() => {
    if (filtre !== 'all' && !typeAllowed(filtre)) setFiltre('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoPerms, filtre]);

  const counts  = data?.counts ?? { all: 0, par: 0, ent: 0, lvr: 0, cor: 0 };
  const total   = data?.total  ?? 0;
  // Rôle + recherche sont déjà appliqués côté backend — ne reste que le
  // filtre de permission (frontend-only, voir typeAllowed ci-dessus).
  const acteurs = (data?.list ?? []).filter((a: any) => typeAllowed(a.type));

  const FILTRES = ([
    { id: 'all', label: 'Tous',           n: counts.all, icon: undefined },
    { id: 'par', label: 'Partenaires',    n: counts.par, icon: 'fa-handshake' },
    { id: 'ent', label: 'Entreprises',    n: counts.ent, icon: 'fa-store' },
    { id: 'lvr', label: 'Livreurs',       n: counts.lvr, icon: 'fa-motorcycle' },
    { id: 'cor', label: 'Correspondants', n: counts.cor, icon: 'fa-map-pin' },
  ] as const).filter(f => f.id === 'all' || typeAllowed(f.id as ActeurType));

  return (
    <div>
      {/* ── Filtres + recherche ── */}
      <div className={styles.filterBar}>
        {FILTRES.map(f => (
          <button key={f.id} className={`${styles.fchip} ${filtre === f.id ? styles.fon : ''}`}
            onClick={() => changeFiltre(f.id as 'all' | ActeurType)}>
            {f.icon && <i className={`fas ${f.icon}`} />} {f.label} <span className={styles.n}>{f.n}</span>
          </button>
        ))}
        <div className={styles.searchIn}>
          <i className="fas fa-magnifying-glass" />
          <input placeholder="Nom, téléphone, ID…" value={recherche}
            onChange={e => changeRecherche(e.target.value)} />
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
        <Pagination page={page} limit={20} total={total} onChange={setPage} />
      </div>
    </div>
  );
}
