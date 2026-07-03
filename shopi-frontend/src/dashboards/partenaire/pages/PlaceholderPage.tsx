/* ================================================================
 * FICHIER : src/dashboards/partenaire/pages/PlaceholderPage.tsx
 * Page générique "à brancher" (invitations, paiements, stats, paramètres).
 * ================================================================ */

import styles from '../styles/PlaceholderPage.module.css';

interface Props { icon: string; title: string; text: string; }

export default function PlaceholderPage({ icon, title, text }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.ch}><div className={styles.chT}><i className={`fas ${icon}`} /> {title}</div></div>
      <div className={styles.cb}><p className={styles.txt}>{text}</p></div>
    </div>
  );
}
