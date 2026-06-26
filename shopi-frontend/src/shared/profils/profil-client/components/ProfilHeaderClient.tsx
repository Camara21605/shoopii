/* ================================================================
 * FICHIER : profil-client/components/ProfilHeaderClient.tsx
 *
 * Cover + carte identité (avatar, nom, badges, boutons) + rangée KPI.
 * ================================================================ */

import { useState, useEffect } from 'react';
import styles from '../styles/ProfilClient.module.css';
import type { ClientProfil, ClientKpi } from '../data/profilClientData';
import { settingsApi } from '../../../../modules/home/components/settings/api/settings.api';

/* Mapping type de badge → classe CSS */
const BADGE_CLASS: Record<string, string> = {
  verif: styles.bVerif, vip: styles.bVip, fa: styles.bFa,
  top: styles.bTop, fidele: styles.bFidele,
};
const BADGE_ICON: Record<string, string> = {
  verif: 'fa-circle-check', vip: 'fa-crown', fa: 'fa-shield-halved',
  top: 'fa-trophy', fidele: 'fa-heart',
};

interface Props {
  client: ClientProfil;
  kpis:   ClientKpi[];
  onEdit:  () => void;
  onShare: () => void;
  onMessage: () => void;
}

export default function ProfilHeaderClient({ client, kpis, onEdit, onShare, onMessage }: Props) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(client.profilePicture ?? null);

  /* Charge la photo depuis /client/parametres/profil — source certifiée */
  useEffect(() => {
    settingsApi.getProfil()
      .then(data => { if (data.profilePicture) setAvatarUrl(data.profilePicture); })
      .catch(() => {});
  }, []);

  /* Mise à jour en temps réel si la photo change depuis les paramètres */
  useEffect(() => {
    const fn = (e: Event) => {
      const url = (e as CustomEvent<string>).detail;
      setAvatarUrl(url || null);
    };
    window.addEventListener('avatar-updated', fn);
    return () => window.removeEventListener('avatar-updated', fn);
  }, []);

  return (
    <>
      {/* COVER */}
      <div className={styles.cover}>
        <div className={styles.coverBg} />
        <div className={styles.coverDots} />
      </div>

      {/* IDENTITÉ */}
      <div className={styles.idBar}>
        <div className={styles.idWrap}>
          <div className={styles.avaZone}>
            <div className={styles.ava}>
              {avatarUrl
                ? <img
                    src={avatarUrl}
                    alt={client.nomComplet}
                    style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }}
                  />
                : client.initiales}
              {client.enLigne && <div className={styles.avaOn} />}
            </div>
          </div>

          <div className={styles.idRow}>
            <div>
              <div className={styles.idName}>{client.nomComplet}</div>
              <div className={styles.idMeta}>
                <span><i className="fas fa-map-pin" /> {client.localisation}</span>
                <span><i className="fas fa-calendar" /> {client.membreDepuis}</span>
                {client.enLigne && (
                  <span><i className="fas fa-circle" style={{ color: '#10B981', fontSize: 8 }} /> En ligne maintenant</span>
                )}
              </div>
              <div className={styles.idBadges}>
                {client.badges.map(b => (
                  <span key={b.label} className={`${styles.badge} ${BADGE_CLASS[b.type]}`}>
                    <i className={`fas ${BADGE_ICON[b.type]}`} /> {b.label}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.idActs}>
              <button className={styles.btn} onClick={onShare}><i className="fas fa-share-nodes" /> Partager</button>
              <button className={styles.btn} onClick={onMessage}><i className="fas fa-message" /> Message</button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onEdit}>
                <i className="fas fa-pen" /> Modifier le profil
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className={styles.kpi}>
        <div className={styles.kpiIn}>
          {kpis.map(k => (
            <div key={k.label} className={styles.ki}>
              {k.sub && (
                <span className={`${styles.kiTag} ${k.tag === 'y' ? styles.kiTagY : styles.kiTagG}`}>
                  {k.sub}
                </span>
              )}
              <div className={styles.kiV}>{k.valeur}</div>
              <div className={styles.kiL}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}