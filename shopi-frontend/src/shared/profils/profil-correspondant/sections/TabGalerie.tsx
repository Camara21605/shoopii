/* ================================================================
 * FICHIER : profil-correspondant/sections/TabGalerie.tsx
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
        {galerie.length > 0 && (
          <button className={styles.chLink} onClick={() => onToast('🖼️ Galerie complète')}>Voir tout</button>
        )}
      </div>
      {galerie.length === 0 ? (
        <div className={styles.cb}>
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted, #6B7280)' }}>
            <i className="fas fa-images" style={{ fontSize: 28, marginBottom: 10, display: 'block', opacity: 0.3 }} />
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Galerie non disponible</div>
            <div style={{ fontSize: 12 }}>Le correspondant n'a pas encore publié de photos de son dépôt.</div>
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}
