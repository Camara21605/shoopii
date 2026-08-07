/* ================================================================
 * FICHIER : correspondants/components/CardCorrespondant.tsx
 *
 * Carte d'un correspondant (vue grille) : bandeau coloré selon le
 * type, avatar, badge en ligne, note, 3 stats, bouton suivre.
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import styles from '../styles/Correspondants.module.css';
import type { Correspondant } from '../data/types';

/* Couleur du bandeau + libellé selon le type */
const TYPE_BAND: Record<string, string> = {
  regional: styles.cbPurple, zonal: styles.cbBlue, national: styles.cbAmber,
};
const TYPE_BADGE: Record<string, string> = {
  regional: styles.tbandR, zonal: styles.tbandZ, national: styles.tbandN,
};
/* Couleur de l'avatar selon le type */
const AVA_BG: Record<string, string> = {
  regional: 'linear-gradient(135deg,#3B0764,#7C3AED)',
  zonal:    'linear-gradient(135deg,#1e3a8a,#1549B8)',
  national: 'linear-gradient(135deg,#78350F,#B45309)',
};

interface Props {
  c:          Correspondant;
  onToggle:   (id: string) => void;
  onView:     (id: string) => void;
}

export default function CardCorrespondant({ c, onToggle, onView }: Props) {
  const { t } = useTranslation();
  const TYPE_LABEL: Record<string, string> = {
    regional: t('correspondantsPage.typeLabel.regional'),
    zonal: t('correspondantsPage.typeLabel.zonal'),
    national: t('correspondantsPage.typeLabel.national'),
  };
  return (
    <div className={styles.corCard} onClick={() => onView(c.id)}>
      {/* Bandeau coloré */}
      <div className={`${styles.cband} ${TYPE_BAND[c.type]}`}>
        <div className={styles.cbPattern} />
        <div className={styles.cbType}>
          <span className={TYPE_BADGE[c.type]}>{TYPE_LABEL[c.type]}</span>
        </div>
      </div>

      {/* Avatar + badge en ligne */}
      <div className={styles.cavaWrap}>
        <div className={styles.cava} style={{ background: AVA_BG[c.type] }}>
          {c.initiales}
          {c.enLigne && <div className={styles.cavaOn} />}
        </div>
        <div className={`${styles.availBadge} ${c.enLigne ? styles.abOn : styles.abOff}`}>
          <i className="fas fa-circle" style={{ fontSize: 6 }} /> {c.enLigne ? t('correspondantsPage.card.enLigne') : t('correspondantsPage.card.horsLigne')}
        </div>
      </div>

      {/* Corps */}
      <div className={styles.cbody}>
        <div className={styles.cNm}>{c.nom}</div>
        <div className={styles.cZone}><i className="fas fa-map-pin" /> {c.zone}</div>
        <div className={styles.cBio}>{c.bio}</div>

        {/* Note */}
        <div className={styles.cStars}>
          <span className={styles.stars}>{'★'.repeat(Math.round(c.note))}</span>
          <span className={styles.cRv}>{c.note.toFixed(1)}</span>
          {c.nbAvis > 0 && <span className={styles.cRc}>{t('correspondantsPage.card.avisCount', { count: c.nbAvis })}</span>}
        </div>

        {/* 3 stats */}
        <div className={styles.cStats}>
          <div className={styles.cs}><div className={styles.csV}>{c.missions.toLocaleString('fr-FR')}</div><div className={styles.csL}>{t('correspondantsPage.card.missions')}</div></div>
          <div className={styles.cs}><div className={styles.csV}>{c.fiabilite}%</div><div className={styles.csL}>{t('correspondantsPage.card.fiabilite')}</div></div>
          <div className={styles.cs}><div className={styles.csV}>{c.experience}</div><div className={styles.csL}>{t('correspondantsPage.card.experience')}</div></div>
        </div>

        {/* Bouton suivre (stopPropagation pour ne pas déclencher onView) */}
        <button
          className={`${styles.flwBtn} ${c.suivi ? styles.fbOn : styles.fbOff}`}
          onClick={e => { e.stopPropagation(); onToggle(c.id); }}
        >
          {c.suivi
            ? <><i className="fas fa-user-check" /> {t('correspondantsPage.card.abonne')}</>
            : <><i className="fas fa-plus" /> {t('correspondantsPage.card.suivre')}</>}
        </button>

        <button className={styles.cPlink} onClick={e => { e.stopPropagation(); onView(c.id); }}>
          {t('correspondantsPage.card.voirProfilComplet')}
        </button>
      </div>
    </div>
  );
}