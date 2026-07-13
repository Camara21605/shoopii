/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/ActeursPage.tsx
 *
 * Tous les acteurs de la zone : filtres par rôle + recherche +
 * tableau avec suspension / réactivation.
 * ================================================================ */

import { useState } from 'react';
import styles from '../styles/ActeursPage.module.css';
import { ACTEURS, TYPE_LABEL, TYPE_ICON } from '../data/adminData';
import type { ActeurType } from '../data/types';

interface ActeursPageProps {
  onSanction: (cible: string) => void;
  onToast:    (msg: string, type?: 's' | 'i' | 'w') => void;
}

/* Filtres disponibles (all + les 4 types d'acteur) */
const FILTRES: { id: 'all' | ActeurType; label: string; n: number; icon?: string }[] = [
  { id: 'all', label: 'Tous',           n: 486 },
  { id: 'par', label: 'Partenaires',    n: 12,  icon: 'fa-handshake' },
  { id: 'ent', label: 'Entreprises',    n: 148, icon: 'fa-store' },
  { id: 'lvr', label: 'Livreurs',       n: 262, icon: 'fa-motorcycle' },
  { id: 'cor', label: 'Correspondants', n: 64,  icon: 'fa-map-pin' },
];

const STATUT_LABEL: Record<string, string> = { act: 'Actif', pend: 'En attente', susp: 'Suspendu' };

export default function ActeursPage({ onSanction, onToast }: ActeursPageProps) {
  const [filtre, setFiltre]       = useState<'all' | ActeurType>('all');
  const [recherche, setRecherche] = useState('');

  const visibles = ACTEURS.filter(a =>
    (filtre === 'all' || a.type === filtre) &&
    a.nom.toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <div>
      {/* ── Barre de filtres + recherche ── */}
      <div className={styles.filterBar}>
        {FILTRES.map(f => (
          <button key={f.id} className={`${styles.fchip} ${filtre === f.id ? styles.fon : ''}`}
            onClick={() => setFiltre(f.id)}>
            {f.icon && <i className={`fas ${f.icon}`} />} {f.label} <span className={styles.n}>{f.n}</span>
          </button>
        ))}
        <div className={styles.searchIn}>
          <i className="fas fa-magnifying-glass" />
          <input placeholder="Nom, téléphone, ID…" value={recherche}
            onChange={e => setRecherche(e.target.value)} />
        </div>
      </div>

      {/* ── Tableau des acteurs ── */}
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.chT}><i className="fas fa-people-group" /> Tous les acteurs</div>
          <button className={styles.exportBtn} onClick={() => onToast('📄 Export CSV des acteurs lancé', 'i')}>
            <i className="fas fa-download" /> Exporter
          </button>
        </div>
        <div className={styles.tblWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Acteur</th><th>Rôle</th><th>Commune</th><th>Recruté par</th><th>Activité</th><th>Statut</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {visibles.map(a => (
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
                      <i className={`fas ${TYPE_ICON[a.type]}`} /> {TYPE_LABEL[a.type]}
                    </span>
                  </td>
                  <td>{a.commune}</td>
                  <td>{a.recrutePar}</td>
                  <td>{a.activite}</td>
                  <td><span className={`${styles.state} ${styles['state_' + a.statut]}`}>{STATUT_LABEL[a.statut]}</span></td>
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
      </div>
    </div>
  );
}
