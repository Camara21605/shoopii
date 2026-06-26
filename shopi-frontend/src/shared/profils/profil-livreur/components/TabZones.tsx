/* ================================================================
 * FICHIER : src/modules/home/components/profil-livreur/components/TabZones.tsx
 *
 * Onglet "Zones" : liste des communes desservies.
 * ================================================================ */

import React from 'react';
import styles from '../styles/ProfilLivreur.module.css';
import type { LivreurProfile } from '../types';

export default function TabZones({ profile }: { profile: LivreurProfile }) {
  if (profile.zones.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.cb} style={{ textAlign: 'center', color: 'var(--t3)' }}>
          Aucune zone de livraison renseignée.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.ch}><div className={styles.ct}><i className="fas fa-map" /> Zones de livraison</div></div>
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