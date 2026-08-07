/* ================================================================
 * FICHIER : profil-correspondant/sections/TabZones.tsx
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import styles from '../styles/ProfilCorrespondant.module.css';
import type { ZoneCard, PaysPartenaire } from '../data/types';

const BADGE_CLASS: Record<string, string> = {
  main: styles.zbMain, sec: styles.zbSec, partner: styles.zbMain,
};

interface Props {
  zones:           ZoneCard[];
  paysPartenaires: PaysPartenaire[];
  onToast:         (m: string) => void;
}

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted, #6B7280)' }}>
      <i className={`fas ${icon}`} style={{ fontSize: 28, marginBottom: 10, display: 'block', opacity: 0.4 }} />
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12 }}>{desc}</div>
    </div>
  );
}

export default function TabZones({ zones, paysPartenaires, onToast }: Props) {
  const { t } = useTranslation();
  return (
    <>
      <div className={styles.card}>
        <div className={styles.ch}><div className={styles.ct}><i className="fas fa-map" /> {t('profilCorrespondant.tabZones.couverture')}</div></div>
        <div className={styles.cb}>
          {zones.length === 0 ? (
            <EmptyState icon="fa-map-pin" title={t('profilCorrespondant.tabZones.couvertureEmptyTitle')} desc={t('profilCorrespondant.tabZones.couvertureEmptyDesc')} />
          ) : (
            <div className={styles.zonesGrid}>
              {zones.map(z => (
                <div key={z.nom} className={`${styles.zoneCard} ${z.badgeType === 'main' ? styles.zoneCardPrimary : ''}`}>
                  <div className={styles.zcName}>{z.nom}</div>
                  <div className={styles.zcDetail}>{z.detail}</div>
                  <span className={`${styles.zcBadge} ${BADGE_CLASS[z.badgeType]}`}>{z.badge}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.ch}><div className={styles.ct}><i className="fas fa-globe" /> {t('profilCorrespondant.tabZones.reseauTitle')}</div></div>
        <div className={styles.cb}>
          {paysPartenaires.length === 0 ? (
            <EmptyState icon="fa-earth-africa" title={t('profilCorrespondant.tabZones.reseauEmptyTitle')} desc={t('profilCorrespondant.tabZones.reseauEmptyDesc')} />
          ) : (
            <>
              <div className={styles.intlGrid}>
                {paysPartenaires.map(p => (
                  <div key={p.nom} className={styles.countryCard} onClick={() => onToast(t('profilCorrespondant.tabZones.paysToast', { nom: p.nom, villes: p.villes }))}>
                    <div className={styles.ccFlag}>{p.flag}</div>
                    <div>
                      <div className={styles.ccNm}>{p.nom}</div>
                      <div className={styles.ccDt}>{p.villes}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.intlNote}>
                <i className="fas fa-circle-info" />
                <span>{t('profilCorrespondant.tabZones.intlNote')}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
