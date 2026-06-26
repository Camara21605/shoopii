/*
 * ModalSuccess.tsx — Modale de succès commande professionnelle
 */
import styles from '../styles/ModalSuccess.module.css';

interface Props {
  orderId:    string;
  livreurNom: string | null;
  onClose:    () => void;
  onToast:    (m: string) => void;
}

export default function ModalSuccess({ orderId, livreurNom, onClose, onToast }: Props) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>

        {/* Icône succès */}
        <div className={styles.ico}>✅</div>

        {/* Titre */}
        <h2 className={styles.titre}>Commande confirmée !</h2>
        <p className={styles.sub}>
          Votre commande a été enregistrée avec succès et est en cours de traitement.
          Vous recevrez une notification dès la prise en charge par le livreur.
        </p>

        {/* ID commande */}
        <div className={styles.orderId}>
          <i className="fas fa-hashtag" />
          Commande <span>#{orderId.slice(0, 8).toUpperCase()}</span>
        </div>

        {/* Timeline */}
        <div className={styles.timeline}>
          <div className={styles.tlTitle}>Suivi en temps réel</div>
          {[
            { dot: 'done',   text: <><strong>Commande confirmée</strong> — À l'instant</> },
            { dot: 'active', text: <><strong>Préparation en cours</strong> — Boutique vendeur</> },
            { dot: 'wait',   text: <>Remise au livreur {livreurNom ? <strong>— {livreurNom}</strong> : '— En attente'}</> },
            { dot: 'wait',   text: <>Livraison à votre adresse</> },
          ].map((t, i) => (
            <div key={i} className={styles.tlRow}>
              <div className={`${styles.tlDot} ${styles[t.dot as keyof typeof styles]}`} />
              <span>{t.text}</span>
            </div>
          ))}
        </div>

        {/* Boutons */}
        <div className={styles.btns}>
          <button className={styles.btn1} onClick={() => onToast('📦 Redirection suivi commande…')}>
            <i className="fas fa-map-location-dot" /> Suivre
          </button>
          <button className={styles.btn2} onClick={onClose}>
            <i className="fas fa-store" /> Continuer
          </button>
        </div>
      </div>
    </div>
  );
}
