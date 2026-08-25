/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/sections/CorrespondantsSection.tsx
 *
 * RÔLE    : Onglet "Correspondants" — grille des correspondants
 *           Shoneya rattachés à la boutique, vue client.
 *
 * AFFICHE :
 *   - Résumé en haut : disponibles / complets / total
 *   - Bannière explicative "Qu'est-ce qu'un correspondant ?"
 *   - Grille de cartes CardCorrespondantBoutique
 * ============================================================
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CORRESPONDANTS_MOCK } from '../data/boutiqueMockData';
import CardCorrespondantBoutique from '../components/CardCorrespondantBoutique';
import styles from '../styles/CorrespondantsSection.module.css';

interface Props { onToast: (m: string) => void; }

export default function CorrespondantsSection({ onToast }: Props) {
  const { t } = useTranslation();
  const [showInfo, setShowInfo] = useState(true);

  const disponibles = CORRESPONDANTS_MOCK.filter(c => c.dispo).length;
  const complets    = CORRESPONDANTS_MOCK.filter(c => !c.dispo).length;

  return (
    <div>

      {/* ── Résumé en haut ── */}
      <div className={styles.resume}>
        <div className={`${styles.resumeItem} ${styles.resumeGreen}`}>
          <span className={styles.resumeDot} />
          <strong>{disponibles}</strong> {t('boutiqueDetail.correspondantsSection.disponibleCount', { count: disponibles })}
        </div>
        <div className={`${styles.resumeItem} ${styles.resumeGray}`}>
          <span className={`${styles.resumeDot} ${styles.resumeDotGray}`} />
          <strong>{complets}</strong> {t('boutiqueDetail.correspondantsSection.completCount', { count: complets })}
        </div>
        <div className={styles.resumeItem}>
          <i className="fas fa-map-location-dot" style={{ color:'#4338CA', fontSize:12 }} />
          <strong>{CORRESPONDANTS_MOCK.length}</strong> {t('boutiqueDetail.correspondantsSection.totalCount')}
        </div>
      </div>

      {/* ── Bannière explicative (fermable) ── */}
      {showInfo && (
        <div className={styles.infoBanner}>
          <div className={styles.ibIcon}>🏢</div>
          <div className={styles.ibText}>
            <div className={styles.ibTitle}>
              <i className="fas fa-circle-info" /> {t('boutiqueDetail.correspondantsSection.infoBannerTitle')}
            </div>
            <p className={styles.ibDesc}>
              {t('boutiqueDetail.correspondantsSection.infoBannerDesc')}
            </p>
            <div className={styles.ibSteps}>
              {[
                { ico:'fas fa-box',          label:t('boutiqueDetail.correspondantsSection.steps.colisRecu')       },
                { ico:'fas fa-shield-check', label:t('boutiqueDetail.correspondantsSection.steps.stockageSecurise') },
                { ico:'fas fa-motorcycle',   label:t('boutiqueDetail.correspondantsSection.steps.remiseDirecte')   },
                { ico:'fas fa-star',         label:t('boutiqueDetail.correspondantsSection.steps.noteCertifie')    },
              ].map(s => (
                <div key={s.label} className={styles.ibStep}>
                  <i className={s.ico} />
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
          <button className={styles.ibClose} onClick={() => setShowInfo(false)} aria-label={t('boutiqueDetail.correspondantsSection.fermer')}>
            <i className="fas fa-xmark" />
          </button>
        </div>
      )}

      {/* ── Grille des correspondants ── */}
      <div className={styles.grid}>
        {CORRESPONDANTS_MOCK.map(c => (
          <CardCorrespondantBoutique key={c.id} c={c} onToast={onToast} />
        ))}
      </div>
    </div>
  );
}