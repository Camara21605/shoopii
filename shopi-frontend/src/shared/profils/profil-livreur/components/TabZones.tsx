/* ================================================================
 * FICHIER : src/modules/home/components/profil-livreur/components/TabZones.tsx
 *
 * Onglet "Zones" : liste des communes desservies.
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import styles from '../styles/ProfilLivreur.module.css';
import type { LivreurProfile } from '../types';

export default function TabZones({ profile }: { profile: LivreurProfile }) {
  const { t } = useTranslation();
  if (profile.zones.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.cb} style={{ textAlign: 'center', color: 'var(--t3)' }}>
          {t('profilLivreur.tabZones.empty')}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.ch}><div className={styles.ct}><i className="fas fa-map" /> {t('profilLivreur.tabZones.title')}</div></div>
      <div className={styles.cb}>
        <div className={styles.zoneMap}>
          {profile.zones.map(z => (
            <div key={z} className={styles.zoneRow}>
              <div className={styles.zoneDot} />
              <div className={styles.zoneNm}>{z}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}