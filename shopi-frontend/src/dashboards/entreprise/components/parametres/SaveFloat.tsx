// src/dashboards/entreprise/components/parametres/SaveFloat.tsx
import { useTranslation } from 'react-i18next';
import styles from '../../styles/parametres/SaveFloat.module.css';

interface Props { show: boolean; onSave: () => void; onDiscard: () => void; }

export default function SaveFloat({ show, onSave, onDiscard }: Props) {
  const { t } = useTranslation();
  return (
    <div className={`${styles.float} ${show ? styles.show : ''}`}>
      <div className={styles.msg}><i className="fas fa-circle-dot" /> {t('parametres.saveFloat.modifsNonSauvegardees')}</div>
      <button className={styles.cancel} onClick={onDiscard}>{t('parametres.saveFloat.annuler')}</button>
      <button className={styles.save} onClick={onSave}><i className="fas fa-cloud-arrow-up" /> {t('parametres.saveFloat.sauvegarder')}</button>
    </div>
  );
}
