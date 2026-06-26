/* ================================================================
 * FICHIER : src/modules/home/components/livreurs/sections/SuggestionsRow.tsx
 *
 * RÔLE : Rangée horizontale de livreurs suggérés (style Facebook).
 *        Scroll horizontal sur mobile, fixe sur desktop.
 *
 * PARENT : LivreursPage.tsx
 * STYLES : ../styles/SuggestionsRow.module.css
 * ================================================================ */

import React, { useState } from 'react';
import styles from '../styles/SuggestionsRow.module.css';
import type { LivreurItem } from '../data/livreursMockData';

/* ── Props ── */
interface SuggestionsRowProps {
  livreurs: LivreurItem[];
  onFollow: (id: string, newState: boolean) => void;
}

/* ================================================================
 * COMPOSANT PRINCIPAL
 * ================================================================ */
const SuggestionsRow: React.FC<SuggestionsRowProps> = ({ livreurs, onFollow }) => {
  /* Livreurs non encore suivis (suggestions pertinentes) */
  const suggestions = livreurs.filter(l => !l.isSuivi).slice(0, 8);

  if (suggestions.length === 0) return null;

  return (
    <div className={styles.row} role="list" aria-label="Livreurs suggérés près de vous">

      {/* Étiquette */}
      <div className={styles.label} aria-hidden="true">
        <span className={styles.labelTitle}>Suggestions</span>
        <span className={styles.labelSub}>Près de vous</span>
      </div>

      {/* Séparateur */}
      <div className={styles.divider} aria-hidden="true" />

      {/* Cards suggestions */}
      {suggestions.map(l => (
        <SuggestItem key={l.id} livreur={l} onFollow={onFollow} />
      ))}

    </div>
  );
};

/* ================================================================
 * SOUS-COMPOSANT : Un item suggestion
 * ================================================================ */
interface SuggestItemProps {
  livreur:  LivreurItem;
  onFollow: (id: string, newState: boolean) => void;
}

const SuggestItem: React.FC<SuggestItemProps> = ({ livreur, onFollow }) => {
  const [followed, setFollowed] = useState(livreur.isSuivi);

  const handleFollow = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !followed;
    setFollowed(next);
    onFollow(livreur.id, next);
  };

  return (
    <div className={styles.item} role="listitem">
      {/* Avatar avec indicateur en ligne */}
      <div className={styles.avaWrap}>
        <div
          className={styles.ava}
          style={{ background: livreur.avatarBg }}
          aria-label={livreur.fullName}
        >
          {livreur.initials}
          {livreur.disponible && (
            <span className={styles.avaDot} aria-label="Disponible" />
          )}
        </div>
      </div>

      {/* Nom */}
      <div className={styles.name}>
        {livreur.fullName.split(' ')[0]}{' '}
        {livreur.fullName.split(' ')[1]?.[0]}.
      </div>

      {/* Zone */}
      <div className={styles.zone}>{livreur.zone.split('·')[0].trim()}</div>

      {/* Bouton suivre */}
      <button
        className={`${styles.followBtn} ${followed ? styles.followBtnOn : ''}`}
        onClick={handleFollow}
        aria-label={followed
          ? `Se désabonner de ${livreur.fullName}`
          : `Suivre ${livreur.fullName}`
        }
      >
        {followed ? '✓ Abonné' : '+ Suivre'}
      </button>
    </div>
  );
};

export default SuggestionsRow;