/* ================================================================
 * FICHIER : src/dashboards/administrateur/components/SanctionModal.tsx
 *
 * Modale de confirmation de suspension d'un compte.
 * Action réversible et consignée au journal d'audit.
 * En prod : POST /admin/acteurs/:id/suspendre { motif }.
 * ================================================================ */

import styles from '../styles/SanctionModal.module.css';

interface SanctionModalProps {
  target:    string;    // nom du compte à suspendre
  onClose:   () => void;
  onConfirm: () => void;
}

export default function SanctionModal({ target, onClose, onConfirm }: SanctionModalProps) {
  return (
    <div className={styles.bg} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.cmodal}>
        {/* Icône d'alerte */}
        <div className={styles.ic}><i className="fas fa-ban" /></div>

        <h3>Suspendre {target} ?</h3>

        <p>
          Le compte sera immédiatement désactivé et l&apos;utilisateur notifié. Cette action est
          réversible depuis la liste des acteurs, et sera consignée dans le journal d&apos;audit.
        </p>

        <div className={styles.btns}>
          <button className={styles.cancel} onClick={onClose}>Annuler</button>
          <button className={styles.confirm} onClick={onConfirm}>Suspendre le compte</button>
        </div>
      </div>
    </div>
  );
}
