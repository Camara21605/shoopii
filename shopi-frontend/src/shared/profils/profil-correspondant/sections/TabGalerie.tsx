/* ================================================================
 * FICHIER : profil-correspondant/sections/TabGalerie.tsx
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import styles from '../styles/ProfilCorrespondant.module.css';
import type { GalerieItem } from '../data/types';

interface Props {
  galerie: GalerieItem[];
  onToast: (m: string) => void;
}

export default function TabGalerie({ galerie, onToast }: Props) {
  const { t } = useTranslation();
  return (
    <div className={styles.card}>
      <div className={styles.ch}>
        <div className={styles.ct}><i className="fas fa-images" /> {t('profilCorrespondant.tabGalerie.title')}</div>
        {galerie.length > 0 && (
          <button className={styles.chLink} onClick={() => onToast(t('profilCorrespondant.tabGalerie.galerieCompleteToast'))}>{t('profilCorrespondant.tabGalerie.voirTout')}</button>
        )}
      </div>
      {galerie.length === 0 ? (
        <div className={styles.cb}>
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted, #6B7280)' }}>
            <i className="fas fa-images" style={{ fontSize: 28, marginBottom: 10, display: 'block', opacity: 0.3 }} />
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('profilCorrespondant.tabGalerie.emptyTitle')}</div>
            <div style={{ fontSize: 12 }}>{t('profilCorrespondant.tabGalerie.emptyDesc')}</div>
          </div>
        </div>
      ) : (
        <div className={styles.galleryGrid}>
          {galerie.map((g, i) => (
            <div
              key={i}
              className={`${styles.galItem} ${g.principale ? styles.galItemBig : ''}`}
              onClick={() => onToast(g.label ? t('profilCorrespondant.tabGalerie.labelToast', { label: g.label }) : t('profilCorrespondant.tabGalerie.photoToast'))}
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
