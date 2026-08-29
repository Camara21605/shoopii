/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/sections/LivreursSection.tsx
 *
 * RÔLE    : Onglet "Livreurs" — grille des livreurs rattachés
 *           à la boutique avec leurs statuts de disponibilité.
 *
 * Données réelles — reçues de BoutiquePage (déjà chargées via
 * GET /public/boutiques/:id/livreurs pour calculer le compteur de
 * l'onglet ; on réutilise le même state ici plutôt que de refaire
 * un appel réseau identique).
 * ============================================================
 */
import { useTranslation } from 'react-i18next';
import type { LivreurApi } from '../pages/BoutiquePage';
import CardLivreurBoutique from '../components/CardLivreurBoutique';
import styles from '../styles/LivreursSection.module.css';

interface Props {
  livreurs: LivreurApi[];
  onToast:  (m: string) => void;
}

export default function LivreursSection({ livreurs, onToast }: Props) {
  const { t } = useTranslation();

  /* Compteurs pour le résumé en haut — 3 états réels (available/
   * on_delivery/offline), pas juste dispo/pas-dispo comme l'ancien mock. */
  const disponibles = livreurs.filter(l => l.availability === 'available').length;
  const enCourse     = livreurs.filter(l => l.availability === 'on_delivery').length;

  if (livreurs.length === 0) {
    return (
      <div className={styles.empty}>
        <i className="fas fa-motorcycle" />
        {t('boutiqueDetail.livreursSection.aucunLivreur')}
      </div>
    );
  }

  return (
    <div>
      {/* ── Résumé en haut ── */}
      <div className={styles.resume}>
        <div className={`${styles.resumeItem} ${styles.resumeGreen}`}>
          <span className={styles.resumeDot} />
          <strong>{disponibles}</strong> {t('boutiqueDetail.livreursSection.disponibleCount', { count: disponibles })}
        </div>
        <div className={`${styles.resumeItem} ${styles.resumeAmber}`}>
          <span className={`${styles.resumeDot} ${styles.resumeDotAmber}`} />
          <strong>{enCourse}</strong> {t('boutiqueDetail.livreursSection.enCourse')}
        </div>
        <div className={styles.resumeItem}>
          <i className="fas fa-users" style={{ color:'var(--t3)', fontSize:12 }} />
          <strong>{livreurs.length}</strong> {t('boutiqueDetail.livreursSection.totalCount')}
        </div>
      </div>

      {/* ── Grille des livreurs ── */}
      <div className={styles.grid}>
        {livreurs.map(l => (
          <CardLivreurBoutique key={l.id} l={l} onToast={onToast} />
        ))}
      </div>
    </div>
  );
}
