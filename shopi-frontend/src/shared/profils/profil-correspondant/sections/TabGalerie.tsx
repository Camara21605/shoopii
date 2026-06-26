/* ================================================================
 * FICHIER : profil-correspondant/sections/TabGalerie.tsx
 *
 * Onglet Galerie : photos du dépôt (1 grande + miniatures).
 * ================================================================ */

import React from 'react';
import styles from '../styles/ProfilCorrespondant.module.css';
import type { GalerieItem } from '../data/types';

interface Props {
  galerie: GalerieItem[];
  onToast: (m: string) => void;
}

export default function TabGalerie({ galerie, onToast }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.ch}>
        <div className={styles.ct}><i className="fas fa-images" /> Galerie photos du dépôt</div>
        <button className={styles.chLink} onClick={() => onToast('🖼️ Galerie complète')}>Voir tout</button>
      </div>
      <div className={styles.galleryGrid}>
        {galerie.map((g, i) => (
          <div
            key={i}
            className={`${styles.galItem} ${g.principale ? styles.galItemBig : ''}`}
            onClick={() => onToast(g.label ? `🖼️ ${g.label}` : '🖼️ Photo')}
          >
            {g.emoji}
            <div className={styles.galOverlay}><i className="fas fa-expand" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}