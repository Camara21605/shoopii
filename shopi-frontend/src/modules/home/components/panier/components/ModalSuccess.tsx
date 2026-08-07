/*
 * ModalSuccess.tsx — Modale de succès commande professionnelle
 */
import { useTranslation } from 'react-i18next';
import styles from '../styles/ModalSuccess.module.css';

interface Props {
  orderId:    string;
  livreurNom: string | null;
  onClose:    () => void;
  onToast:    (m: string) => void;
}

export default function ModalSuccess({ orderId, livreurNom, onClose, onToast }: Props) {
  const { t } = useTranslation();
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>

        {/* Icône succès */}
        <div className={styles.ico}>✅</div>

        {/* Titre */}
        <h2 className={styles.titre}>{t('panierCommande.modalSuccess.titre')}</h2>
        <p className={styles.sub}>
          {t('panierCommande.modalSuccess.desc')}
        </p>

        {/* ID commande */}
        <div className={styles.orderId}>
          <i className="fas fa-hashtag" />
          {t('panierCommande.modalSuccess.commande')} <span>#{orderId.slice(0, 8).toUpperCase()}</span>
        </div>

        {/* Timeline */}
        <div className={styles.timeline}>
          <div className={styles.tlTitle}>{t('panierCommande.modalSuccess.suiviTempsReel')}</div>
          {[
            { dot: 'done',   text: <><strong>{t('panierCommande.modalSuccess.commandeConfirmee')}</strong> — {t('panierCommande.modalSuccess.aLInstant')}</> },
            { dot: 'active', text: <><strong>{t('panierCommande.modalSuccess.preparationEnCours')}</strong> — {t('panierCommande.modalSuccess.boutiqueVendeur')}</> },
            { dot: 'wait',   text: <>{t('panierCommande.modalSuccess.remiseAuLivreur')} {livreurNom ? <strong>— {livreurNom}</strong> : t('panierCommande.modalSuccess.enAttente')}</> },
            { dot: 'wait',   text: <>{t('panierCommande.modalSuccess.livraisonAVotreAdresse')}</> },
          ].map((step, i) => (
            <div key={i} className={styles.tlRow}>
              <div className={`${styles.tlDot} ${styles[step.dot as keyof typeof styles]}`} />
              <span>{step.text}</span>
            </div>
          ))}
        </div>

        {/* Boutons */}
        <div className={styles.btns}>
          <button className={styles.btn1} onClick={() => onToast(t('panierCommande.modalSuccess.redirectionToast'))}>
            <i className="fas fa-map-location-dot" /> {t('panierCommande.modalSuccess.suivre')}
          </button>
          <button className={styles.btn2} onClick={onClose}>
            <i className="fas fa-store" /> {t('panierCommande.modalSuccess.continuer')}
          </button>
        </div>
      </div>
    </div>
  );
}
