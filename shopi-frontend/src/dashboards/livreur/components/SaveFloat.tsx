// src/dashboards/livreur/components/SaveFloat.tsx
// Barre flottante "Modifications non sauvegardées"
// Apparaît depuis le bas quand isDirty = true

import React from 'react';
import styles from '../styles/SaveFloat.module.css';

interface Props {
  show:      boolean;
  onSave:    () => void;
  onDiscard: () => void;
}

export default function SaveFloat({ show, onSave, onDiscard }: Props) {
  return (
    <div className={`${styles.float} ${show ? styles.show : ''}`}>
      <span className={styles.msg}>
        <i className="fas fa-circle-dot" style={{ color:'var(--amber)' }} />
        Modifications non sauvegardées
      </span>
      <button className={styles.btnSave} onClick={onSave}>
        <i className="fas fa-check" /> Sauvegarder
      </button>
      <button className={styles.btnCancel} onClick={onDiscard}>
        Annuler
      </button>
    </div>
  );
}