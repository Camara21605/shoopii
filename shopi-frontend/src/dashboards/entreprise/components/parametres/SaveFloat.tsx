// src/dashboards/entreprise/components/parametres/SaveFloat.tsx
import React from 'react';
import styles from '../../styles/parametres/SaveFloat.module.css';

interface Props { show: boolean; onSave: () => void; onDiscard: () => void; }

export default function SaveFloat({ show, onSave, onDiscard }: Props) {
  return (
    <div className={`${styles.float} ${show ? styles.show : ''}`}>
      <div className={styles.msg}><i className="fas fa-circle-dot" /> Modifications non sauvegardées</div>
      <button className={styles.cancel} onClick={onDiscard}>Annuler</button>
      <button className={styles.save} onClick={onSave}><i className="fas fa-cloud-arrow-up" /> Sauvegarder</button>
    </div>
  );
}
