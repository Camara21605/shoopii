/* ================================================================
 * FICHIER : src/dashboards/administrateur/components/Pagination.tsx
 *
 * Contrôle de pagination réutilisable (Précédent / Page X sur Y /
 * Suivant) pour les listes paginées du dashboard admin.
 * ================================================================ */

import styles from '../styles/Pagination.module.css';

interface PaginationProps {
  page:     number;
  limit:    number;
  total:    number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, limit, total, onChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;

  return (
    <div className={styles.wrap}>
      <span className={styles.info}>{total} résultat{total > 1 ? 's' : ''}</span>
      <div className={styles.nav}>
        <button className={styles.btn} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <i className="fas fa-chevron-left" />
        </button>
        <span className={styles.pageLabel}>Page {page} sur {pages}</span>
        <button className={styles.btn} disabled={page >= pages} onClick={() => onChange(page + 1)}>
          <i className="fas fa-chevron-right" />
        </button>
      </div>
    </div>
  );
}
