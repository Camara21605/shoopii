/* ================================================================
 * FICHIER : src/modules/home/components/profil-livreur/components/ProfilHeader.tsx
 *
 * Cover animée + carte identité (avatar, nom, chips, boutons) + KPI.
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import styles from '../styles/ProfilLivreur.module.css';
import type { LivreurProfile } from '../types';

interface Props {
  profile:       LivreurProfile;
  followLoading: boolean;
  callLoading?:  boolean;
  onFollow:      () => void;
  onContact:     () => void;
  onCall?:       () => void;
}

export default function ProfilHeader({ profile, followLoading, callLoading, onFollow, onContact, onCall }: Props) {
  const { t } = useTranslation();
  const initials = profile.fullName.trim().split(/\s+/).slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

  return (
    <>
      {/* COVER */}
      <div className={styles.cover}>
        <div className={styles.coverBg} />
        <div className={styles.coverDots} />
        <div className={styles.speedLine} />
        <div className={styles.speedLine} />
        <div className={styles.speedLine} />
      </div>

      {/* IDENTITÉ */}
      <div className={styles.idBar}>
        <div className={styles.idWrap}>
          <div className={styles.avaZone}>
            <div className={styles.ava}>
              {profile.profilePicture
                ? <img src={profile.profilePicture} alt={profile.fullName} />
                : initials}
              {profile.disponible && <div className={styles.avaOn} />}
            </div>
          </div>

          <div className={styles.idRow}>
            <div>
              <div className={styles.idName}>{profile.fullName}</div>
              <div className={styles.idVeh}>
                <i className="fas fa-motorcycle" /> {t('profilLivreur.livreurLabel')} · {profile.vehicule}
              </div>
              <div className={styles.idMeta}>
                <span><i className="fas fa-map-pin" /> {profile.zone}</span>
                <span>
                  <i className="fas fa-circle" style={{ color: profile.disponible ? '#10B981' : '#9CA3AF', fontSize: 8 }} />
                  {profile.disponible ? t('profilLivreur.disponibleMaintenant') : t('profilLivreur.horsLigne')}
                </span>
                <span><i className="fas fa-users" /> {profile.abonnesCount} {t('profilLivreur.abonnesSuffix')}</span>
              </div>
              <div className={styles.idChips}>
                <span className={`${styles.chip} ${styles.chipG}`}><i className="fas fa-circle-check" /> {t('profilLivreur.identiteVerifiee')}</span>
                {profile.assurance && <span className={`${styles.chip} ${styles.chipB}`}><i className="fas fa-shield-halved" /> {t('profilLivreur.assureShopi')}</span>}
                <span className={`${styles.chip} ${styles.chipY}`}><i className="fas fa-star" /> {profile.averageRating.toFixed(1)}★ · {profile.reviewsCount} {t('profilLivreur.avisSuffix')}</span>
              </div>
            </div>

            <div className={styles.idActs}>
              {onCall && (
                <button className={`${styles.btn} ${styles.btnMsg}`} onClick={onCall} disabled={callLoading}>
                  {callLoading
                    ? <><i className="fas fa-spinner fa-spin" /> …</>
                    : <><i className="fas fa-phone" /> {t('profilLivreur.appeler')}</>}
                </button>
              )}
              <button className={`${styles.btn} ${styles.btnMsg}`} onClick={onContact}>
                <i className="fas fa-message" /> {t('profilLivreur.contacter')}
              </button>
              <button
                className={`${styles.btn} ${profile.isSuivi ? styles.btnFollowOn : styles.btnFollow}`}
                onClick={onFollow}
                disabled={followLoading}
              >
                {followLoading
                  ? <><i className="fas fa-spinner fa-spin" /> …</>
                  : profile.isSuivi
                    ? <><i className="fas fa-user-check" /> {t('profilLivreur.abonneFem')}</>
                    : <><i className="fas fa-plus" /> {t('profilLivreur.suivre')}</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className={styles.kpi}>
        <div className={styles.kpiIn}>
          <div className={styles.ki}><div className={styles.kiV}>{profile.totalLivraisons.toLocaleString('fr-FR')}</div><div className={styles.kiL}>{t('profilLivreur.kpi.livraisons')}</div></div>
          <div className={styles.ki}><div className={styles.kiV}>{profile.averageRating.toFixed(1)}★</div><div className={styles.kiL}>{t('profilLivreur.kpi.note')}</div></div>
          <div className={styles.ki}><div className={styles.kiV}>{profile.ponctualite}%</div><div className={styles.kiL}>{t('profilLivreur.kpi.ponctualite')}</div></div>
          <div className={styles.ki}><div className={styles.kiV}>{profile.abonnesCount}</div><div className={styles.kiL}>{t('profilLivreur.kpi.abonnes')}</div></div>
          <div className={styles.ki}><div className={styles.kiV}>{profile.reviewsCount}</div><div className={styles.kiL}>{t('profilLivreur.kpi.avis')}</div></div>
          <div className={styles.ki}><div className={styles.kiV}>{profile.experience}</div><div className={styles.kiL}>{t('profilLivreur.kpi.experience')}</div></div>
        </div>
      </div>
    </>
  );
}