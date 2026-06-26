/* ================================================================
 * FICHIER : src/modules/commande/sections/ActorsList.tsx
 * Liste des acteurs avec état de validation + note étoile attribuée.
 * ================================================================ */

import styles from '../styles/ActorsList.module.css';
import type { Acteur, EtapeStatut, Notation } from '../data/types';

interface Props {
  acteurs:    Acteur[];
  statuts:    EtapeStatut[];
  notations?: Record<string, Notation>;
}

const ROLE_LABEL: Record<string, string> = {
  entreprise:    'Vendeur',
  livreur:       'Livreur',
  correspondant: 'Correspondant',
  client:        'Client',
};

export default function ActorsList({ acteurs, statuts, notations }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.ch}>
        <div className={styles.chT}><i className="fas fa-users" /> Acteurs de la livraison</div>
      </div>
      <div className={styles.cb}>
        {acteurs.map((a, i) => {
          const nota  = notations?.[a.role];
          const isDone = statuts[i] === 'done';

          return (
            <div key={a.role} className={styles.actor}>
              {/* Avatar */}
              <div className={`${styles.av} ${styles['av_' + a.role]}`}>{a.initiales}</div>

              {/* Infos + note */}
              <div className={styles.inf}>
                <div className={styles.nm}>{a.nom}</div>
                <div className={styles.rl}>{a.sousTitre} · {ROLE_LABEL[a.role] ?? a.role}</div>

                {/* Étoiles attribuées par le client */}
                {nota && nota.note > 0 && (
                  <div className={styles.ratingWrap}>
                    <div className={styles.stars}>
                      {[1,2,3,4,5].map(v => (
                        <span key={v} className={`${styles.star} ${v <= nota.note ? styles.starOn : ''}`}>★</span>
                      ))}
                    </div>
                    <span className={styles.ratingVal}>{nota.note}/5</span>
                    {nota.commentaire && (
                      <div className={styles.comment}>"{nota.commentaire}"</div>
                    )}
                  </div>
                )}
              </div>

              {/* Statut validation */}
              <div className={`${styles.chk} ${isDone ? styles.ok : styles.wait}`}>
                <i className={`fas ${isDone ? 'fa-check' : 'fa-hourglass-half'}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
