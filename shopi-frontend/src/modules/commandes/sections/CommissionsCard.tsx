/* ================================================================
 * FICHIER : src/modules/commande/sections/CommissionsCard.tsx
 * Commissions versées — verrouillées tant que le client n'a pas validé.
 * ================================================================ */

import styles from '../styles/CommissionsCard.module.css';
import type { Commission } from '../data/types';

const fmt = (n: number) => n.toLocaleString('fr-FR');

interface Props { commissions: Commission[]; unlocked: boolean; }

export default function CommissionsCard({ commissions, unlocked }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.ch}><div className={styles.chT}><i className="fas fa-hand-holding-dollar" /> Commissions</div></div>
      <div className={styles.cb}>
        {!unlocked ? (
          <div className={styles.locked}>
            <i className="fas fa-lock" />
            Les commissions seront versées une fois que le client aura validé la réception du colis.
          </div>
        ) : (
          commissions.map(c => (
            <div key={c.role} className={styles.row}>
              <div className={`${styles.ic} ${styles['ic_' + c.role]}`}><i className={`fas ${c.icone}`} /></div>
              <div>
                <div className={styles.nm}>{c.nom}</div>
                <div className={styles.rl}>{c.libelle}</div>
              </div>
              <div className={styles.amt}>+{fmt(c.montant)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}