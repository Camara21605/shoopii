/* ================================================================
 * FICHIER : src/modules/commande/sections/DoneBanner.tsx
 * Bannière de succès après livraison + boutons (noter / signaler).
 * ================================================================ */

import styles from '../styles/DoneBanner.module.css';

interface Props {
  onRate:   () => void;
  onIssue:  () => void;
  /** Absent (ex: rôle entreprise/livreur) → bouton non affiché. */
  onReturn?: () => void;
}

export default function DoneBanner({ onRate, onIssue, onReturn }: Props) {
  return (
    <div className={styles.banner}>
      <i className={`fas fa-circle-check ${styles.icon}`} />
      <div className={styles.text}>
        <div className={styles.t}>Commande livrée et validée ! 🎉</div>
        <div className={styles.s}>Tous les acteurs ont confirmé. Les commissions ont été versées.</div>
      </div>
      <button className={styles.rate} onClick={onRate}><i className="fas fa-star" /> Noter la livraison</button>
      {onReturn && (
        <button className={styles.issue} onClick={onReturn}><i className="fas fa-rotate-left" /> Demander un retour</button>
      )}
      <button className={styles.issue} onClick={onIssue}><i className="fas fa-triangle-exclamation" /> Signaler un problème</button>
    </div>
  );
}