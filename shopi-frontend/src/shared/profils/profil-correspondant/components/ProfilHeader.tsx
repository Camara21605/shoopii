/* ================================================================
 * FICHIER : profil-correspondant/components/ProfilHeader.tsx
 *
 * Cover dégradé + carte identité (avatar, nom, type, badges,
 * actions) + barre des 8 KPI.
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import styles from '../styles/ProfilCorrespondant.module.css';
import FollowButton from '../../../components/FollowButton';
import type { CorrProfil } from '../data/types';

/* Mappe le type de badge → classe de chip */
const CHIP_CLASS: Record<string, string> = {
  verif: styles.chipG, assur: styles.chipB, top: styles.chipY, premium: styles.chipP,
};
const CHIP_ICON: Record<string, string> = {
  verif: 'fa-circle-check', assur: 'fa-shield-halved', top: 'fa-trophy', premium: 'fa-crown',
};

interface Props {
  profil:        CorrProfil;
  suivi:         boolean;
  callLoading?:  boolean;
  onToast:       (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
  onRequireAuth: () => void;
  onFollowChange:(next: { isSuivi: boolean }) => void;
  onMessage:     () => void;
  onShare:       () => void;
  onCall?:       () => void;
}

export default function ProfilHeader({ profil, suivi, callLoading, onToast, onRequireAuth, onFollowChange, onMessage, onShare, onCall }: Props) {
  const { t } = useTranslation();
  /* Les 8 KPI dérivés du profil */
  const KPIS = [
    { v: profil.missions.toLocaleString('fr-FR'), l: t('profilCorrespondant.kpi.missions'),        badge: `+${profil.missionsMois}`, badgeCls: styles.kbG },
    { v: `${profil.note.toFixed(1)} ★`,           l: t('profilCorrespondant.kpi.note'),            badge: t('profilCorrespondant.kpi.top5'),  badgeCls: styles.kbP },
    { v: `${profil.fiabilite}%`,                  l: t('profilCorrespondant.kpi.fiabilite') },
    { v: profil.abonnes.toLocaleString('fr-FR'),  l: t('profilCorrespondant.kpi.abonnes') },
    { v: String(profil.nbAvis),                   l: t('profilCorrespondant.kpi.avisClients') },
    { v: profil.experience,                       l: t('profilCorrespondant.kpi.experience') },
    { v: String(profil.zonesCount),               l: t('profilCorrespondant.kpi.zonesCouvertes') },
    { v: profil.delaiMoyen,                       l: t('profilCorrespondant.kpi.delaiMoyen') },
  ];

  return (
    <>
      {/* Cover */}
      <div className={styles.cover}>
        <div className={styles.coverBg} />
        <div className={styles.coverPattern} />
        <div className={styles.coverC1} />
        <div className={styles.coverC2} />
        <div className={styles.coverGlow} />
      </div>

      {/* Identité */}
      <div className={styles.idBar}>
        <div className={styles.idWrap}>
          <div className={styles.avaZone}>
            <div className={styles.ava}>
              {profil.initiales}
              {profil.enLigne && <div className={styles.avaOn} />}
            </div>
          </div>

          <div className={styles.idRow}>
            <div>
              <div className={styles.idName}>{profil.nom}</div>
              <div className={styles.idType}>
                <i className="fas fa-map-pin" /> {profil.typeLabel}
              </div>
              <div className={styles.idMeta}>
                <span><i className="fas fa-location-dot" /> {profil.localisation}</span>
                {profil.enLigne && <span><i className="fas fa-circle" style={{ color: '#10B981', fontSize: 8 }} /> {t('profilCorrespondant.enLigneMaintenant')}</span>}
                <span><i className="fas fa-calendar-check" /> {profil.membreDepuis}</span>
                <span><i className="fas fa-users" /> {profil.abonnes.toLocaleString('fr-FR')} {t('profilCorrespondant.abonnesSuffix')}</span>
              </div>
              <div className={styles.idChips}>
                {profil.badges.map(b => (
                  <span key={b.label} className={`${styles.chip} ${CHIP_CLASS[b.type]}`}>
                    <i className={`fas ${CHIP_ICON[b.type]}`} /> {b.label}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.idActs}>
              <button className={styles.btnShare} onClick={onShare} title={t('profilCorrespondant.partager')}>
                <i className="fas fa-share-nodes" />
              </button>
              {onCall && (
                <button className={styles.btnMsg} onClick={onCall} disabled={callLoading}>
                  {callLoading
                    ? <><i className="fas fa-spinner fa-spin" /> …</>
                    : <><i className="fas fa-phone" /> {t('profilCorrespondant.appeler')}</>}
                </button>
              )}
              <button className={styles.btnMsg} onClick={onMessage}>
                <i className="fas fa-comment-dots" /> {t('profilCorrespondant.contacter')}
              </button>
              <FollowButton
                actorType="correspondant"
                id={profil.id}
                name={profil.nom}
                isSuivi={suivi}
                onToast={onToast}
                onRequireAuth={onRequireAuth}
                onChange={onFollowChange}
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className={styles.kpi}>
        <div className={styles.kpiIn}>
          {KPIS.map(k => (
            <div key={k.l} className={styles.ki}>
              {k.badge && <span className={`${styles.kiBadge} ${k.badgeCls}`}>{k.badge}</span>}
              <div className={styles.kiV}>{k.v}</div>
              <div className={styles.kiL}>{k.l}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}