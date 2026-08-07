/* ================================================================
 * FICHIER : profil-correspondant/sections/TabTarifs.tsx
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import styles from '../styles/ProfilCorrespondant.module.css';
import type { TarifRow } from '../data/types';

export default function TabTarifs({ tarifs }: { tarifs: TarifRow[] }) {
  const { t } = useTranslation();
  return (
    <div className={styles.card}>
      <div className={styles.ch}><div className={styles.ct}><i className="fas fa-tag" /> {t('profilCorrespondant.tabTarifs.title')}</div></div>
      {tarifs.length === 0 ? (
        <div className={styles.cb}>
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted, #6B7280)' }}>
            <i className="fas fa-file-invoice-dollar" style={{ fontSize: 28, marginBottom: 10, display: 'block', opacity: 0.4 }} />
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('profilCorrespondant.tabTarifs.emptyTitle')}</div>
            <div style={{ fontSize: 12 }}>{t('profilCorrespondant.tabTarifs.emptyDescPart1')}<br />{t('profilCorrespondant.tabTarifs.emptyDescPart2')}</div>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.tarifWarn}>
            <strong>{t('profilCorrespondant.tabTarifs.abonnesShopi')}</strong> {t('profilCorrespondant.tabTarifs.reduction15')}
          </div>
          <div className={styles.tarifGrid}>
            {tarifs.map(tarif => (
              <div key={tarif.service} className={styles.tarifRow}>
                <div className={styles.tarifSvc}>
                  <i className="fas fa-circle-check" />
                  <div>
                    {tarif.service}
                    <div className={styles.tarifNote}>{tarif.sub}</div>
                  </div>
                </div>
                <div className={styles.tarifRight}>
                  <div className={styles.tarifPrice}>{tarif.prix}</div>
                  <div className={styles.tarifNote}>{tarif.note}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
