/* ================================================================
 * FICHIER : src/modules/home/components/profil-livreur/components/TabVehicule.tsx
 *
 * Onglet "Véhicule" : carte véhicule + détails.
 * ================================================================ */

import React from 'react';
import styles from '../styles/ProfilLivreur.module.css';
import type { LivreurProfile } from '../types';

const VEHICULE_ICON: Record<string, string> = {
  moto: '🛵', voiture: '🚗', velo: '🚲', tricycle: '🛺', camion: '🚚', pieton: '🚶',
};

export default function TabVehicule({ profile }: { profile: LivreurProfile }) {
  const icon = VEHICULE_ICON[profile.vehiculeType] ?? '🛵';

  return (
    <div className={styles.card}>
      <div className={styles.ch}><div className={styles.ct}><i className="fas fa-motorcycle" /> Informations véhicule</div></div>
      <div className={styles.cb}>
        <div className={styles.vehCard}>
          <div className={styles.vehIcon}>{icon}</div>
          <div>
            <div className={styles.vehModel}>{profile.vehicule}</div>
            <div className={styles.vehDetail}>Type : {profile.vehiculeType}</div>
            {profile.immatriculation && (
              <div className={styles.vehPlate}>
                <i className="fas fa-hashtag" style={{ fontSize: 10, opacity: .7 }} /> {profile.immatriculation}
              </div>
            )}
          </div>
        </div>

        <div className={styles.infoGrid}>
          <div className={styles.ir}>
            <div className={styles.irLbl}><i className="fas fa-id-card" /> Permis</div>
            <div className={styles.irVal}>{profile.permis ? 'Validé ✓' : 'Non renseigné'}</div>
          </div>
          <div className={styles.ir}>
            <div className={styles.irLbl}><i className="fas fa-shield-halved" /> Assurance</div>
            <div className={styles.irVal}>{profile.assurance ? 'Valide ✓' : 'Non renseignée'}</div>
          </div>
          <div className={styles.ir} style={{ borderBottom: 'none' }}>
            <div className={styles.irLbl}><i className="fas fa-hashtag" /> Immatriculation</div>
            <div className={styles.irVal}>{profile.immatriculation ?? 'Non renseignée'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}