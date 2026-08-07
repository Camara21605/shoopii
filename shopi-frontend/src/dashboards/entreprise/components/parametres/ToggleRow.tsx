// src/dashboards/entreprise/components/parametres/ToggleRow.tsx
import { useTranslation } from 'react-i18next';
import styles from '../../styles/parametres/ToggleRow.module.css';

interface Props {
  label: string; sub: string; checked: boolean;
  badge?: 'new' | 'rec' | 'attn'; onChange: (v: boolean) => void;
}

export default function ToggleRow({ label, sub, checked, badge, onChange }: Props) {
  const { t } = useTranslation();
  const BADGE_LABELS = { new: t('parametres.toggleRow.badgeNew'), rec: t('parametres.toggleRow.badgeRec'), attn: t('parametres.toggleRow.badgeAttn') };
  return (
    <div className={styles.row}>
      <div>
        <div className={styles.lbl}>
          {label}
          {badge && <span className={`${styles.badge} ${styles[badge]}`}>{BADGE_LABELS[badge]}</span>}
        </div>
        <div className={styles.sub}>{sub}</div>
      </div>
      <label className={styles.toggle}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className={styles.slider} />
      </label>
    </div>
  );
}
