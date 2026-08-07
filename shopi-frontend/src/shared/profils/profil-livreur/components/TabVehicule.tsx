/* ================================================================
 * FICHIER : src/modules/home/components/profil-livreur/components/TabVehicule.tsx
 *
 * Onglet "Véhicule" : carte véhicule + détails.
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import styles from '../styles/ProfilLivreur.module.css';
import type { LivreurProfile } from '../types';

const VEHICULE_ICON: Record<string, string> = {
  moto: '🛵', voiture: '🚗', velo: '🚲', tricycle: '🛺', camion: '🚚', pieton: '🚶',
};

export default function TabVehicule({ profile }: { profile: LivreurProfile }) {
  const { t } = useTranslation();
  const icon = VEHICULE_ICON[profile.vehiculeType] ?? '🛵';

  return (
    <div className={styles.card}>
      <div className={styles.ch}><div className={styles.ct}><i className="fas fa-motorcycle" /> {t('profilLivreur.tabVehicule.title')}</div></div>
      <div className={styles.cb}>
        <div className={styles.vehCard}>
          <div className={styles.vehIcon}>{icon}</div>
          <div>
            <div className={styles.vehModel}>{profile.vehicule}</div>
            <div className={styles.vehDetail}>{t('profilLivreur.tabVehicule.type', { type: profile.vehiculeType })}</div>
            {profile.immatriculation && (
              <div className={styles.vehPlate}>
                <i className="fas fa-hashtag" style={{ fontSize: 10, opacity: .7 }} /> {profile.immatriculation}
              </div>
            )}
          </div>
        </div>

        <div className={styles.infoGrid}>
          <div className={styles.ir}>
            <div className={styles.irLbl}><i className="fas fa-id-card" /> {t('profilLivreur.tabVehicule.permis')}</div>
            <div className={styles.irVal}>{profile.permis ? t('profilLivreur.tabVehicule.valide') : t('profilLivreur.tabVehicule.nonRenseigne')}</div>
          </div>
          <div className={styles.ir}>
            <div className={styles.irLbl}><i className="fas fa-shield-halved" /> {t('profilLivreur.tabVehicule.assurance')}</div>
            <div className={styles.irVal}>{profile.assurance ? t('profilLivreur.tabVehicule.validAssurance') : t('profilLivreur.tabVehicule.nonRenseigneeF')}</div>
          </div>
          <div className={styles.ir} style={{ borderBottom: 'none' }}>
            <div className={styles.irLbl}><i className="fas fa-hashtag" /> {t('profilLivreur.tabVehicule.immatriculation')}</div>
            <div className={styles.irVal}>{profile.immatriculation ?? t('profilLivreur.tabVehicule.nonRenseigneeF')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}