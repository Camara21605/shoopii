/* ================================================================
 * FICHIER : src/modules/home/components/profil-livreur/components/ProfilSidebar.tsx
 *
 * Colonne latérale : contact, stats rapides.
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import styles from '../styles/ProfilLivreur.module.css';
import type { LivreurProfile } from '../types';

interface Props {
  profile: LivreurProfile;
  onToast: (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
}

export default function ProfilSidebar({ profile, onToast }: Props) {
  const { t } = useTranslation();
  const copy = (val: string) => {
    navigator.clipboard.writeText(val);
    onToast(t('profilLivreur.sidebar.copieToast'), 's');
  };

  return (
    <aside>
      {/* Contact */}
      {(profile.telephone || profile.whatsapp) && (
        <div className={styles.sc}>
          <div className={styles.ch}><div className={styles.ct}><i className="fas fa-address-book" /> {t('profilLivreur.sidebar.contact')}</div></div>
          <div className={styles.scBody}>
            {profile.telephone && (
              <div className={styles.clRow}>
                <div className={styles.clIco}><i className="fas fa-phone" /></div>
                <div>
                  <div className={styles.clLbl}>{t('profilLivreur.sidebar.telephone')}</div>
                  <div className={styles.clVal}>{profile.telephone}</div>
                </div>
                <div className={styles.clIco} style={{ marginLeft: 'auto', cursor: 'pointer' }} onClick={() => copy(profile.telephone!)}>
                  <i className="fas fa-copy" />
                </div>
              </div>
            )}
            {profile.whatsapp && (
              <a
                className={styles.clRow}
                href={`https://wa.me/${profile.whatsapp.replace(/\s+/g, '')}`}
                target="_blank" rel="noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <div className={styles.clIco}><i className="fab fa-whatsapp" /></div>
                <div>
                  <div className={styles.clLbl}>{t('profilLivreur.sidebar.whatsapp')}</div>
                  <div className={styles.clVal}>{profile.whatsapp}</div>
                </div>
                <div className={styles.clIco} style={{ marginLeft: 'auto' }}>
                  <i className="fas fa-external-link-alt" />
                </div>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Stats rapides */}
      <div className={styles.sc}>
        <div className={styles.ch}><div className={styles.ct}><i className="fas fa-chart-simple" /> {t('profilLivreur.sidebar.statistiques')}</div></div>
        <div className={styles.scBody}>
          <div className={styles.sbStats}>
            <div className={styles.ss}><div className={styles.ssV}>{profile.totalLivraisons.toLocaleString('fr-FR')}</div><div className={styles.ssL}>{t('profilLivreur.sidebar.livraisons')}</div></div>
            <div className={styles.ss}><div className={styles.ssV}>{profile.averageRating.toFixed(1)}★</div><div className={styles.ssL}>{t('profilLivreur.sidebar.note')}</div></div>
            <div className={styles.ss}><div className={styles.ssV}>{profile.ponctualite}%</div><div className={styles.ssL}>{t('profilLivreur.sidebar.ponctualite')}</div></div>
            <div className={styles.ss}><div className={styles.ssV}>{profile.abonnesCount}</div><div className={styles.ssL}>{t('profilLivreur.sidebar.abonnes')}</div></div>
          </div>
        </div>
      </div>
    </aside>
  );
}