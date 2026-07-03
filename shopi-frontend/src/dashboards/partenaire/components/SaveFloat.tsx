/* ================================================================
 * FICHIER : src/dashboards/partenaire/components/SaveFloat.tsx
 *
 * Barre flottante "Modifications non sauvegardées".
 * Apparaît dès qu'un champ est modifié (isDirty = true).
 * Le bouton "Sauvegarder" incrémente saveTrigger → section active réagit.
 * ================================================================ */

import s from '../styles/SaveFloat.module.css';

interface Props {
  show:     boolean;   // afficher ou masquer la barre
  saving:   boolean;   // sauvegarde en cours
  onSave:   () => void;
  onCancel: () => void;
}

export default function SaveFloat({ show, saving, onSave, onCancel }: Props) {
  return (
    <div className={`${s.float} ${show ? s.show : ''}`} role="status" aria-live="polite">
      <span className={s.msg}>
        <i className="fas fa-circle-dot" />
        Modifications non sauvegardées
      </span>

      <button className={s.btnSave} onClick={onSave} disabled={saving}>
        {saving
          ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</>
          : <><i className="fas fa-check" /> Sauvegarder</>
        }
      </button>

      <button className={s.btnCancel} onClick={onCancel} disabled={saving}>
        Annuler
      </button>
    </div>
  );
}
