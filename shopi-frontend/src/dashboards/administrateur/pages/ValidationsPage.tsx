/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/ValidationsPage.tsx
 *
 * Comptes en attente de validation : documents / valider / refuser.
 * En prod : GET /admin/validations + PATCH /admin/validations/:id
 * ================================================================ */

import styles from '../styles/ValidationsPage.module.css';
import { VALIDATIONS, TYPE_LABEL, TYPE_ICON } from '../data/adminData';

interface ValidationsPageProps {
  onToast: (msg: string, type?: 's' | 'i' | 'w') => void;
}

export default function ValidationsPage({ onToast }: ValidationsPageProps) {
  return (
    <div>
      {/* ── Statistiques du mois ── */}
      <div className={styles.stats}>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.va}`}>7</div><div className={styles.cstatL}>En attente de validation</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.vg}`}>142</div><div className={styles.cstatL}>Validés ce mois</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.vr}`}>6</div><div className={styles.cstatL}>Refusés ce mois</div></div>
        <div className={styles.cstat}><div className={styles.cstatV}>&lt; 24h</div><div className={styles.cstatL}>Délai moyen</div></div>
      </div>

      {/* ── Liste des comptes en attente ── */}
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.chT}><i className="fas fa-user-check" /> Comptes en attente de validation</div>
        </div>
        <div className={styles.cb}>
          {VALIDATIONS.map(v => (
            <div key={v.id} className={styles.item}>
              <div className={`${styles.av} ${styles['av_' + v.type]}`}>{v.avatar}</div>
              <div className={styles.main}>
                <div className={styles.top}>
                  <span className={styles.nm}>{v.nom}</span>
                  <span className={`${styles.typePill} ${styles['t_' + v.type]}`}>
                    <i className={`fas ${TYPE_ICON[v.type]}`} /> {TYPE_LABEL[v.type]}
                  </span>
                </div>
                <div className={styles.d}>{v.description}</div>
                <div className={styles.meta}>
                  <span><i className="fas fa-location-dot" /> {v.commune}</span>
                  <span><i className="fas fa-calendar" /> {v.quand}</span>
                  <span><i className="fas fa-user" /> Recruté par : {v.recrutePar}</span>
                </div>
              </div>
              <div className={styles.acts}>
                <button className={`${styles.vbtn} ${styles.doc}`}
                  onClick={() => onToast('📄 Aperçu des documents', 'i')}>
                  <i className="fas fa-file-lines" /> Documents
                </button>
                <button className={`${styles.vbtn} ${styles.ok}`}
                  onClick={() => onToast(`✅ ${v.nom} validé(e)`, 's')}>
                  <i className="fas fa-check" /> Valider
                </button>
                <button className={`${styles.vbtn} ${styles.no}`}
                  onClick={() => onToast('❌ Compte refusé — motif demandé', 'w')}>
                  <i className="fas fa-xmark" /> Refuser
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
