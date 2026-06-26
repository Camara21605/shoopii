/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/sections/LivreursSection.tsx
 *
 * RÔLE    : Onglet "Livreurs" — grille des livreurs rattachés
 *           à la boutique avec leurs statuts de disponibilité.
 * ============================================================
 */
import React from 'react';
import { LIVREURS_MOCK } from '../data/boutiqueMockData';
import CardLivreurBoutique from '../components/CardLivreurBoutique';
import styles from '../styles/LivreursSection.module.css';

interface Props { onToast: (m: string) => void; }

export default function LivreursSection({ onToast }: Props) {
  /* Compteurs pour le résumé en haut */
  const disponibles = LIVREURS_MOCK.filter(l => l.dispo).length;
  const enCourse    = LIVREURS_MOCK.filter(l => !l.dispo).length;

  return (
    <div>
      {/* ── Résumé en haut ── */}
      <div className={styles.resume}>
        <div className={`${styles.resumeItem} ${styles.resumeGreen}`}>
          <span className={styles.resumeDot} />
          <strong>{disponibles}</strong> disponible{disponibles > 1 ? 's' : ''}
        </div>
        <div className={`${styles.resumeItem} ${styles.resumeAmber}`}>
          <span className={`${styles.resumeDot} ${styles.resumeDotAmber}`} />
          <strong>{enCourse}</strong> en course
        </div>
        <div className={styles.resumeItem}>
          <i className="fas fa-users" style={{ color:'var(--t3)', fontSize:12 }} />
          <strong>{LIVREURS_MOCK.length}</strong> livreurs au total
        </div>
      </div>

      {/* ── Grille des livreurs ── */}
      <div className={styles.grid}>
        {LIVREURS_MOCK.map(l => (
          <CardLivreurBoutique key={l.id} l={l} onToast={onToast} />
        ))}
      </div>
    </div>
  );
}
