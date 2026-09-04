/* ================================================================
 * FICHIER : src/dashboards/administrateur/components/SanctionModal.tsx
 *
 * Modale de confirmation de suspension d'un compte.
 * Action réversible (bouton "Réactiver" sur la liste des acteurs) et
 * consignée au journal d'audit. PATCH /dashboard/admin/acteurs/:id/suspend.
 * ================================================================ */

import { useState } from 'react';
import styles from '../styles/SanctionModal.module.css';

interface SanctionModalProps {
  target:    { id: string; nom: string };
  busy?:     boolean;
  onClose:   () => void;
  onConfirm: (motif: string) => void;
}

export default function SanctionModal({ target, busy, onClose, onConfirm }: SanctionModalProps) {
  const [motif, setMotif] = useState('');

  return (
    <div className={styles.bg} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.cmodal}>
        {/* Icône d'alerte */}
        <div className={styles.ic}><i className="fas fa-ban" /></div>

        <h3>Suspendre {target.nom} ?</h3>

        <p>
          Le compte sera immédiatement désactivé et l&apos;utilisateur notifié. Cette action est
          réversible depuis la liste des acteurs, et sera consignée dans le journal d&apos;audit.
        </p>

        <textarea
          className={styles.motif}
          placeholder="Motif de la suspension (optionnel, transmis à l'utilisateur)"
          rows={3}
          value={motif}
          onChange={e => setMotif(e.target.value)}
        />

        <div className={styles.btns}>
          <button className={styles.cancel} onClick={onClose} disabled={busy}>Annuler</button>
          <button className={styles.confirm} onClick={() => onConfirm(motif.trim())} disabled={busy}>
            {busy ? <><i className="fas fa-spinner fa-spin" /> Suspension…</> : 'Suspendre le compte'}
          </button>
        </div>
      </div>
    </div>
  );
}
