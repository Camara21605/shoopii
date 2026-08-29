/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/sections/CorrespondantsSection.tsx
 *
 * RÔLE    : Onglet "Correspondants" — grille des correspondants
 *           Shoneya rattachés à la boutique, vue client.
 *
 * AFFICHE :
 *   - Résumé en haut : vérifiés / non vérifiés / total (données réelles —
 *     "disponible/complet" a été retiré : aucune table de suivi des colis
 *     n'existe encore côté backend pour calculer une vraie capacité)
 *   - Bannière explicative "Qu'est-ce qu'un correspondant ?"
 *   - Grille de cartes CardCorrespondantBoutique
 * ============================================================
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CorrespondantApi } from '../pages/BoutiquePage';
import CardCorrespondantBoutique from '../components/CardCorrespondantBoutique';
import styles from '../styles/CorrespondantsSection.module.css';

interface Props {
  correspondants: CorrespondantApi[];
  onToast:        (m: string) => void;
}

export default function CorrespondantsSection({ correspondants, onToast }: Props) {
  const { t } = useTranslation();
  const [showInfo, setShowInfo] = useState(true);

  const verifies    = correspondants.filter(c => c.verified).length;
  const nonVerifies = correspondants.filter(c => !c.verified).length;

  return (
    <div>

      {/* ── Résumé en haut ── */}
      {correspondants.length > 0 && (
        <div className={styles.resume}>
          <div className={`${styles.resumeItem} ${styles.resumeGreen}`}>
            <span className={styles.resumeDot} />
            <strong>{verifies}</strong> {t('boutiqueDetail.correspondantsSection.verifieCount', { count: verifies })}
          </div>
          {nonVerifies > 0 && (
            <div className={`${styles.resumeItem} ${styles.resumeGray}`}>
              <span className={`${styles.resumeDot} ${styles.resumeDotGray}`} />
              <strong>{nonVerifies}</strong> {t('boutiqueDetail.correspondantsSection.nonVerifieCount', { count: nonVerifies })}
            </div>
          )}
          <div className={styles.resumeItem}>
            <i className="fas fa-map-location-dot" style={{ color:'#4338CA', fontSize:12 }} />
            <strong>{correspondants.length}</strong> {t('boutiqueDetail.correspondantsSection.totalCount')}
          </div>
        </div>
      )}

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
      {correspondants.length === 0 ? (
        <div className={styles.empty}>
          <i className="fas fa-building-circle-check" />
          {t('boutiqueDetail.correspondantsSection.aucunCorrespondant')}
        </div>
      ) : (
        <div className={styles.grid}>
          {correspondants.map(c => (
            <CardCorrespondantBoutique key={c.id} c={c} onToast={onToast} />
          ))}
        </div>
      )}
    </div>
  );
}
