/* ================================================================
 * FICHIER : correspondants/components/CardCorrespondant.tsx
 *
 * Carte d'un correspondant (vue grille) : avatar + nom/zone, badge de
 * type, statut/note, 3 stats compactes, bouton suivre. Design sobre,
 * calqué sur ListItemCorrespondant (vue liste) pour rester cohérent.
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import styles from '../styles/Correspondants.module.css';
import { useAuthGate } from '../../../../../shared/hooks/useAuthGate';
import FollowButton    from '../../../../../shared/components/FollowButton';
import type { Correspondant } from '../data/types';

/* Couleur de l'avatar selon le type */
const AVA_BG: Record<string, string> = {
  regional: 'linear-gradient(135deg,#3B0764,#7C3AED)',
  zonal:    'linear-gradient(135deg,#1e3a8a,#1549B8)',
  national: 'linear-gradient(135deg,#78350F,#B45309)',
};
/* Couleur du badge de type */
const TYPE_BADGE: Record<string, string> = {
  regional: styles.ccBadgeR, zonal: styles.ccBadgeZ, national: styles.ccBadgeN,
};

interface Props {
  c:          Correspondant;
  onToast:    (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
  onView:     (id: string) => void;
  /** Reflète l'action du menu ⋮ dans la liste partagée du parent. */
  onChange:   (id: string, next: { isSuivi: boolean; hidden?: boolean; removed?: boolean }) => void;
}

export default function CardCorrespondant({ c, onToast, onView, onChange }: Props) {
  const { t } = useTranslation();
  const { openAuthModal, authModal } = useAuthGate();
  const TYPE_LABEL: Record<string, string> = {
    regional: t('correspondantsPage.typeLabel.regional'),
    zonal: t('correspondantsPage.typeLabel.zonal'),
    national: t('correspondantsPage.typeLabel.national'),
  };
  return (
    <div className={styles.corCard} onClick={() => onView(c.id)}>
      {/* Avatar + nom/zone + badge de type */}
      <div className={styles.ccHead}>
        <div className={styles.ccAva} style={{ background: AVA_BG[c.type] }}>
          {c.initiales}
          {c.enLigne && <span className={styles.ccDot} />}
        </div>
        <div className={styles.ccInfo}>
          <div className={styles.ccNm}>{c.nom}</div>
          <div className={styles.ccZone}><i className="fas fa-map-pin" /> {c.zone}</div>
        </div>
        <span className={`${styles.ccBadge} ${TYPE_BADGE[c.type]}`}>{TYPE_LABEL[c.type]}</span>
      </div>

      {/* Statut + note */}
      <div className={styles.ccMeta}>
        <span className={`${styles.ccStatus} ${c.enLigne ? styles.ccOn : styles.ccOff}`}>
          <span className={styles.ccStatusDot} />
          {c.enLigne ? t('correspondantsPage.card.enLigne') : t('correspondantsPage.card.horsLigne')}
        </span>
        <span className={styles.ccSep}>·</span>
        <span className={styles.stars}>★</span>
        <span>{c.note.toFixed(1)}</span>
        {c.nbAvis > 0 && <span className={styles.ccMuted}>({c.nbAvis})</span>}
      </div>

      {/* 3 stats */}
      <div className={styles.ccStats}>
        <div className={styles.ccStat}>
          <div className={styles.ccStatV}>{c.missions.toLocaleString('fr-FR')}</div>
          <div className={styles.ccStatL}>{t('correspondantsPage.card.missions')}</div>
        </div>
        <div className={styles.ccStatDiv} />
        <div className={styles.ccStat}>
          <div className={styles.ccStatV}>{c.fiabilite}%</div>
          <div className={styles.ccStatL}>{t('correspondantsPage.card.fiabilite')}</div>
        </div>
        <div className={styles.ccStatDiv} />
        <div className={styles.ccStat}>
          <div className={styles.ccStatV}>{c.experience}</div>
          <div className={styles.ccStatL}>{t('correspondantsPage.card.experience')}</div>
        </div>
      </div>

      {/* Bouton suivre + lien profil (stopPropagation pour ne pas déclencher onView) */}
      <div className={styles.ccFoot}>
        <div onClick={e => e.stopPropagation()}>
          <FollowButton
            actorType="correspondant"
            id={c.id}
            name={c.nom}
            isSuivi={c.suivi}
            onToast={onToast}
            onRequireAuth={openAuthModal}
            onChange={next => onChange(c.id, next)}
          />
        </div>

        <button className={styles.ccLink} onClick={e => { e.stopPropagation(); onView(c.id); }}>
          {t('correspondantsPage.card.voirProfilComplet')}
        </button>
      </div>

      {authModal}
    </div>
  );
}
