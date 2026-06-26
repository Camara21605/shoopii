/* ================================================================
 * FICHIER : src/modules/commande/sections/IssueModal.tsx
 * Modale de signalement de problème (litige).
 * ================================================================ */

import { useState } from 'react';
import styles from '../styles/IssueModal.module.css';
import type { TypeProbleme } from '../data/types';

interface Props {
  onClose:  () => void;
  onSubmit: (type: TypeProbleme, description: string) => void;
}

const OPTIONS: { id: TypeProbleme; icon: string; label: string }[] = [
  { id: 'endommage', icon: 'fa-box-open',        label: 'Colis endommagé' },
  { id: 'manquant',  icon: 'fa-circle-question', label: 'Article manquant' },
  { id: 'errone',    icon: 'fa-right-left',      label: 'Mauvais article reçu' },
  { id: 'retard',    icon: 'fa-clock',           label: 'Retard important' },
  { id: 'autre',     icon: 'fa-ellipsis',        label: 'Autre problème' },
];

export default function IssueModal({ onClose, onSubmit }: Props) {
  const [type, setType]   = useState<TypeProbleme | null>(null);
  const [desc, setDesc]   = useState('');

  return (
    <div className={styles.backdrop} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.bar}>
          <div className={styles.barT}><i className="fas fa-triangle-exclamation" /> Signaler un problème</div>
          <button className={styles.x} onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>
        <div className={styles.body}>
          <p className={styles.intro}>Sélectionnez le type de problème. Notre équipe support traitera votre signalement sous 24 h.</p>
          <div className={styles.opts}>
            {OPTIONS.map(o => (
              <div key={o.id}
                className={`${styles.opt} ${type === o.id ? styles.on : ''}`}
                onClick={() => setType(o.id)}>
                <i className={`fas ${o.icon}`} /> {o.label}
              </div>
            ))}
          </div>
          <textarea className={styles.cmt} rows={3}
            placeholder="Décrivez le problème (optionnel)…"
            value={desc} onChange={e => setDesc(e.target.value)} />
          <button className={styles.send}
            onClick={() => { if (type) onSubmit(type, desc); }}>
            <i className="fas fa-paper-plane" /> Envoyer le signalement
          </button>
        </div>
      </div>
    </div>
  );
}