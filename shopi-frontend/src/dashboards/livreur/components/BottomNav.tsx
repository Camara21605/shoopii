// src/dashboards/livreur/components/BottomNav.tsx
// Barre de navigation fixe en bas d'écran (mobile uniquement) :
// Correspondants · Livreurs

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PageId } from '../data/livreurData';
import styles from '../styles/BottomNav.module.css';

interface Props {
  activePage: PageId;
  onNavigate: (p: PageId) => void;
}

export default function BottomNav({ activePage, onNavigate }: Props) {
  const { t } = useTranslation();
  const isCorrespondants = activePage === 'reseauCorrespondants' || activePage === 'profilCorrespondant';
  const isLivreurs       = activePage === 'reseauLivreurs'       || activePage === 'profilLivreur';

  return (
    <nav className={styles.bottomNav}>
      <button
        className={`${styles.bnItem} ${isCorrespondants ? styles.bnActive : ''}`}
        onClick={() => onNavigate('reseauCorrespondants')}
      >
        <i className="fas fa-warehouse" />
        <span>{t('livreurLayout.bottomNav.correspondants')}</span>
      </button>

      <button
        className={`${styles.bnItem} ${isLivreurs ? styles.bnActive : ''}`}
        onClick={() => onNavigate('reseauLivreurs')}
      >
        <i className="fas fa-motorcycle" />
        <span>{t('livreurLayout.bottomNav.livreurs')}</span>
      </button>
    </nav>
  );
}
