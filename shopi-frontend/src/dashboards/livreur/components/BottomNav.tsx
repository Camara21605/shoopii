// src/dashboards/livreur/components/BottomNav.tsx
// Barre de navigation fixe en bas d'écran (mobile uniquement) :
// Correspondants · Livreurs · Mon espace (bascule vers l'espace client)

import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { PageId } from '../data/livreurData';
import styles from '../styles/BottomNav.module.css';

interface Props {
  activePage: PageId;
  onNavigate: (p: PageId) => void;
}

export default function BottomNav({ activePage, onNavigate }: Props) {
  const navigate = useNavigate();

  const isCorrespondants = activePage === 'reseauCorrespondants' || activePage === 'profilCorrespondant';
  const isLivreurs       = activePage === 'reseauLivreurs'       || activePage === 'profilLivreur';

  return (
    <nav className={styles.bottomNav}>
      <button
        className={`${styles.bnItem} ${isCorrespondants ? styles.bnActive : ''}`}
        onClick={() => onNavigate('reseauCorrespondants')}
      >
        <i className="fas fa-warehouse" />
        <span>Correspondants</span>
      </button>

      <button
        className={`${styles.bnItem} ${isLivreurs ? styles.bnActive : ''}`}
        onClick={() => onNavigate('reseauLivreurs')}
      >
        <i className="fas fa-motorcycle" />
        <span>Livreurs</span>
      </button>

      {/* Bascule vers l'espace client */}
      <button
        className={styles.bnItem}
        onClick={() => navigate('/home')}
        title="Basculer vers l'espace client"
      >
        <i className="fas fa-layer-group" />
        <span>Mon espace</span>
      </button>
    </nav>
  );
}
