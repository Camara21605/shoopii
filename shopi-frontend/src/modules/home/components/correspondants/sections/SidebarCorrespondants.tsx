/* ================================================================
 * FICHIER : correspondants/sections/SidebarCorrespondants.tsx
 *
 * Colonne de filtres : type (régional/zonal/national), commune,
 * note minimale, statut en ligne/hors ligne.
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import styles from '../styles/Correspondants.module.css';
import type { CorrType } from '../data/types';

interface Props {
  /* Filtre type */
  typeActif:   CorrType | 'all';
  onType:      (t: CorrType | 'all') => void;
  /* Filtre commune */
  communeActive: string;
  communes:      { id: string; label: string; count: number }[];
  onCommune:     (c: string) => void;
  /* Filtre note */
  noteMin:     number;
  onNote:      (n: number) => void;
  /* Filtre statut */
  statut:      'all' | 'online' | 'offline';
  onStatut:    (s: 'all' | 'online' | 'offline') => void;
  /* Réinitialiser */
  onReset:     () => void;
  /* Compteurs par type */
  countType:   (t: CorrType) => number;
}

export default function SidebarCorrespondants({
  typeActif, onType, communeActive, communes, onCommune,
  noteMin, onNote, statut, onStatut, onReset, countType,
}: Props) {
  const { t } = useTranslation();
  const TYPES: { id: CorrType; ico: string; nm: string; desc: string }[] = [
    { id: 'regional', ico: '🏠', nm: t('correspondantsPage.typeLabel.regional'), desc: t('correspondantsPage.sidebar.types.regional.desc') },
    { id: 'zonal',    ico: '🗺️', nm: t('correspondantsPage.typeLabel.zonal'),    desc: t('correspondantsPage.sidebar.types.zonal.desc') },
    { id: 'national', ico: '🌍', nm: t('correspondantsPage.typeLabel.national'), desc: t('correspondantsPage.sidebar.types.national.desc') },
  ];

  const NOTES = [
    { val: 5, label: t('correspondantsPage.sidebar.ratingOpts.cinqEtoiles'),   stars: 5 },
    { val: 4, label: t('correspondantsPage.sidebar.ratingOpts.quatrePlus'),    stars: 4 },
    { val: 3, label: t('correspondantsPage.sidebar.ratingOpts.troisPlus'),     stars: 3 },
    { val: 0, label: t('correspondantsPage.sidebar.ratingOpts.toutesLesNotes'), stars: 0 },
  ];
  return (
    <aside>
      {/* ── Type ── */}
      <div className={styles.sf}>
        <div className={styles.sfh}>
          <span className={styles.sft}><i className="fas fa-layer-group" /> {t('correspondantsPage.sidebar.typeDeCorrespondant')}</span>
        </div>
        <div className={styles.sfb}>
          <div className={styles.typeCards}>
            {TYPES.map(typeItem => (
              <div
                key={typeItem.id}
                className={`${styles.tc} ${typeActif === typeItem.id ? styles.tcOn : ''}`}
                onClick={() => onType(typeActif === typeItem.id ? 'all' : typeItem.id)}
              >
                <div className={styles.tcIco}>{typeItem.ico}</div>
                <div>
                  <div className={styles.tcNm}>{typeItem.nm}</div>
                  <div className={styles.tcDesc}>{typeItem.desc}</div>
                </div>
                <span className={styles.tcCnt}>{countType(typeItem.id)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Commune ── */}
      <div className={styles.sf}>
        <div className={styles.sfh}>
          <span className={styles.sft}><i className="fas fa-map-pin" /> {t('correspondantsPage.sidebar.commune')}</span>
        </div>
        <div className={styles.sfb}>
          <div className={styles.comChips}>
            {communes.map(c => (
              <div
                key={c.id}
                className={`${styles.cch} ${communeActive === c.id ? styles.cchOn : ''}`}
                onClick={() => onCommune(c.id)}
              >
                <i className="fas fa-map-pin" /> {c.label}
                <span className={styles.cchCnt}>{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Note ── */}
      <div className={styles.sf}>
        <div className={styles.sfh}>
          <span className={styles.sft}><i className="fas fa-star" /> {t('correspondantsPage.sidebar.noteMinimale')}</span>
        </div>
        <div className={styles.sfb}>
          <div className={styles.rops}>
            {NOTES.map(n => (
              <div
                key={n.val}
                className={`${styles.rop} ${noteMin === n.val ? styles.ropOn : ''}`}
                onClick={() => onNote(n.val)}
              >
                {n.stars > 0 && (
                  <span className={styles.stars}>
                    {'★'.repeat(n.stars)}<span style={{ color: 'var(--bdr2)' }}>{'★'.repeat(5 - n.stars)}</span>
                  </span>
                )}
                {n.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Statut ── */}
      <div className={styles.sf}>
        <div className={styles.sfh}>
          <span className={styles.sft}><i className="fas fa-signal" /> {t('correspondantsPage.sidebar.disponibilite')}</span>
          <button className={styles.sfr} onClick={onReset}>{t('correspondantsPage.sidebar.reinitialiser')}</button>
        </div>
        <div className={styles.sfb}>
          <div className={styles.stogWrap}>
            <div
              className={`${styles.stog} ${statut === 'online' ? styles.stogOnAv : ''}`}
              onClick={() => onStatut(statut === 'online' ? 'all' : 'online')}
            >
              <i className="fas fa-circle" style={{ color: '#10B981' }} />{t('correspondantsPage.sidebar.enLigne')}
            </div>
            <div
              className={`${styles.stog} ${statut === 'offline' ? styles.stogOnOff : ''}`}
              onClick={() => onStatut(statut === 'offline' ? 'all' : 'offline')}
            >
              <i className="fas fa-moon" />{t('correspondantsPage.sidebar.horsLigne')}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}