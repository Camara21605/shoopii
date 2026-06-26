/*
 * ConfirmModal.tsx — Modale de confirmation commande professionnelle
 */
import styles from '../styles/ConfirmModal.module.css';

interface Props {
  loading:   boolean;
  onCancel:  () => void;
  onConfirm: () => void;
}

export default function ConfirmModal({ loading, onCancel, onConfirm }: Props) {
  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget && !loading) onCancel(); }}>
      <div className={styles.modal}>

        {/* Icône */}
        <div className={styles.ico}>
          <i className="fas fa-shield-check" />
        </div>

        {/* Texte */}
        <h2 className={styles.titre}>Confirmer la commande ?</h2>
        <p className={styles.sub}>
          Vérifiez bien vos articles, l'adresse de livraison et le mode de paiement.
          Une fois confirmée, votre commande sera transmise immédiatement au vendeur.
        </p>

        {/* Avertissement */}
        <div className={styles.warning}>
          <i className="fas fa-circle-info" />
          <span>Assurez-vous que votre numéro de téléphone est correct pour que le livreur puisse vous contacter.</span>
        </div>

        {/* Boutons */}
        <div className={styles.btns}>
          <button className={styles.btn2} onClick={onCancel} disabled={loading}>
            <i className="fas fa-xmark" /> Annuler
          </button>
          <button className={styles.btn1} onClick={onConfirm} disabled={loading}>
            {loading ? (
              <><i className={`fas fa-circle-notch ${styles.spin}`} /> En cours…</>
            ) : (
              <><i className="fas fa-check" /> Confirmer</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
