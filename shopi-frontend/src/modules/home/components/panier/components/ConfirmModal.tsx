/*
 * ConfirmModal.tsx — Modale de confirmation commande professionnelle
 */
import { useTranslation } from 'react-i18next';
import styles from '../styles/ConfirmModal.module.css';

interface Props {
  loading:   boolean;
  onCancel:  () => void;
  onConfirm: () => void;
}

export default function ConfirmModal({ loading, onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget && !loading) onCancel(); }}>
      <div className={styles.modal}>

        {/* Icône */}
        <div className={styles.ico}>
          <i className="fas fa-shield-check" />
        </div>

        {/* Texte */}
        <h2 className={styles.titre}>{t('panierCommande.confirmModal.titre')}</h2>
        <p className={styles.sub}>
          {t('panierCommande.confirmModal.desc')}
        </p>

        {/* Avertissement */}
        <div className={styles.warning}>
          <i className="fas fa-circle-info" />
          <span>{t('panierCommande.confirmModal.avertissement')}</span>
        </div>

        {/* Boutons */}
        <div className={styles.btns}>
          <button className={styles.btn2} onClick={onCancel} disabled={loading}>
            <i className="fas fa-xmark" /> {t('panierCommande.confirmModal.annuler')}
          </button>
          <button className={styles.btn1} onClick={onConfirm} disabled={loading}>
            {loading ? (
              <><i className={`fas fa-circle-notch ${styles.spin}`} /> {t('panierCommande.confirmModal.enCours')}</>
            ) : (
              <><i className="fas fa-check" /> {t('panierCommande.confirmModal.confirmer')}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
