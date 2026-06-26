/* ================================================================
 * FICHIER : src/modules/home/components/profil-livreur/components/ProfilHeader.tsx
 *
 * Cover animée + carte identité (avatar, nom, chips, boutons) + KPI.
 * ================================================================ */

import React from 'react';
import styles from '../styles/ProfilLivreur.module.css';
import type { LivreurProfile } from '../types';

interface Props {
  profile:       LivreurProfile;
  followLoading: boolean;
  onFollow:      () => void;
  onContact:     () => void;
}

export default function ProfilHeader({ profile, followLoading, onFollow, onContact }: Props) {
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
                <i className="fas fa-motorcycle" /> Livreur · {profile.vehicule}
              </div>
              <div className={styles.idMeta}>
                <span><i className="fas fa-map-pin" /> {profile.zone}</span>
                <span>
                  <i className="fas fa-circle" style={{ color: profile.disponible ? '#10B981' : '#9CA3AF', fontSize: 8 }} />
                  {profile.disponible ? 'Disponible maintenant' : 'Hors ligne'}
                </span>
                <span><i className="fas fa-users" /> {profile.abonnesCount} abonnés</span>
              </div>
              <div className={styles.idChips}>
                <span className={`${styles.chip} ${styles.chipG}`}><i className="fas fa-circle-check" /> Identité vérifiée</span>
                {profile.assurance && <span className={`${styles.chip} ${styles.chipB}`}><i className="fas fa-shield-halved" /> Assuré Shopi</span>}
                <span className={`${styles.chip} ${styles.chipY}`}><i className="fas fa-star" /> {profile.averageRating.toFixed(1)}★ · {profile.reviewsCount} avis</span>
              </div>
            </div>

            <div className={styles.idActs}>
              <button className={`${styles.btn} ${styles.btnMsg}`} onClick={onContact}>
                <i className="fas fa-message" /> Contacter
              </button>
              <button
                className={`${styles.btn} ${profile.isSuivi ? styles.btnFollowOn : styles.btnFollow}`}
                onClick={onFollow}
                disabled={followLoading}
              >
                {followLoading
                  ? <><i className="fas fa-spinner fa-spin" /> …</>
                  : profile.isSuivi
                    ? <><i className="fas fa-user-check" /> Abonné(e)</>
                    : <><i className="fas fa-plus" /> Suivre</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className={styles.kpi}>
        <div className={styles.kpiIn}>
          <div className={styles.ki}><div className={styles.kiV}>{profile.totalLivraisons.toLocaleString('fr-FR')}</div><div className={styles.kiL}>Livraisons</div></div>
          <div className={styles.ki}><div className={styles.kiV}>{profile.averageRating.toFixed(1)}★</div><div className={styles.kiL}>Note</div></div>
          <div className={styles.ki}><div className={styles.kiV}>{profile.ponctualite}%</div><div className={styles.kiL}>Ponctualité</div></div>
          <div className={styles.ki}><div className={styles.kiV}>{profile.abonnesCount}</div><div className={styles.kiL}>Abonnés</div></div>
          <div className={styles.ki}><div className={styles.kiV}>{profile.reviewsCount}</div><div className={styles.kiL}>Avis</div></div>
          <div className={styles.ki}><div className={styles.kiV}>{profile.experience}</div><div className={styles.kiL}>Expérience</div></div>
        </div>
      </div>
    </>
  );
}