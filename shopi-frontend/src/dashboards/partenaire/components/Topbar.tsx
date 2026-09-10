/* ================================================================
 * FICHIER : src/dashboards/partenaire/components/Topbar.tsx
 * ================================================================ */

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../styles/Topbar.module.css';
import type { PartenairePage } from '../data/types';
import NotificationCenter from '../../../shared/notifications/NotificationCenter';

interface TopbarProps {
  activePage:    PartenairePage;
  onGenerate:    () => void;
  onReport:      () => void;
  onMenuToggle?: () => void;
}

export default function Topbar({ activePage, onGenerate, onReport, onMenuToggle }: TopbarProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const title = t(`partenaireLayout.topbar.titles.${activePage}.title`, { defaultValue: '' });
  const sub   = t(`partenaireLayout.topbar.titles.${activePage}.subtitle`, { defaultValue: '' });

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        {onMenuToggle && (
          <button className={styles.menuBtn} onClick={onMenuToggle} aria-label={t('partenaireLayout.topbar.menuAria')}>
            <i className="fas fa-bars" />
          </button>
        )}
        <div>
          <div className={styles.title}>{title}</div>
          <div className={styles.sub}>{sub}</div>
        </div>
      </div>

      <div className={styles.acts}>
        <button className={styles.ic} title={t('partenaireLayout.topbar.reportTooltip')} onClick={onReport}>
          <i className="fas fa-flag" />
        </button>
        <NotificationCenter />
        <button className={styles.ic} onClick={() => navigate('/aide')} title={t('partenaireLayout.topbar.aideTooltip')}>
          <i className="fas fa-circle-question" />
        </button>
        <button className={styles.new} onClick={onGenerate}>
          <i className="fas fa-plus" /> {t('partenaireLayout.topbar.generateBtn')}
        </button>
      </div>
    </header>
  );
}
