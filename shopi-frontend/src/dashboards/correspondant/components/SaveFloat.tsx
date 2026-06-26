/* ================================================================
 * components/SaveFloat.tsx
 * Barre flottante "Modifications non sauvegardées"
 * Apparaît dès qu'un champ est modifié dans les paramètres
 * ================================================================ */

import React from 'react';
import s from '../styles/SaveFloat.module.css';

interface Props {
  /** Afficher la barre */
  show:     boolean;
  /** Sauvegarde en cours */
  saving:   boolean;
  /** Clic sur "Sauvegarder" */
  onSave:   () => void;
  /** Clic sur "Annuler" */
  onCancel: () => void;
}

export default function SaveFloat({ show, saving, onSave, onCancel }: Props) {
  return (
    <div className={`${s.float} ${show ? s.show : ''}`}>
      {/* Message */}
      <span className={s.msg}>
        <i className="fas fa-circle-dot" />
        Modifications non sauvegardées
      </span>

      {/* Bouton sauvegarder */}
      <button className={s.btnSave} onClick={onSave} disabled={saving}>
        {saving
          ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</>
          : <><i className="fas fa-check" /> Sauvegarder</>
        }
      </button>

      {/* Bouton annuler */}
      <button className={s.btnCancel} onClick={onCancel} disabled={saving}>
        Annuler
      </button>
    </div>
  );
}