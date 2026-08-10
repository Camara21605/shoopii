/* ================================================================
 * FICHIER : src/modules/home/components/livreurs/sections/SuggestionsRow.tsx
 *
 * RÔLE : Rangée horizontale de livreurs suggérés (style Facebook).
 *        Scroll horizontal sur mobile, fixe sur desktop.
 *
 * PARENT : LivreursPage.tsx
 * STYLES : ../styles/SuggestionsRow.module.css
 * ================================================================ */

import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/SuggestionsRow.module.css';
import { useAuthGate } from '../../../../../shared/hooks/useAuthGate';
import FollowButton    from '../../../../../shared/components/FollowButton';
import type { LivreurItem } from '../data/livreursMockData';

/* ── Props ── */
interface SuggestionsRowProps {
  livreurs: LivreurItem[];
  onToast:  (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
  onChange: (id: string, next: { isSuivi: boolean; hidden?: boolean; removed?: boolean }) => void;
}

/* ================================================================
 * COMPOSANT PRINCIPAL
 * ================================================================ */
const SuggestionsRow: React.FC<SuggestionsRowProps> = ({ livreurs, onToast, onChange }) => {
  const { t } = useTranslation();
  /* Livreurs non encore suivis (suggestions pertinentes) — disparaît
   * naturellement de cette rangée une fois suivi (isSuivi devient true
   * dans la liste partagée du parent). */
  const suggestions = livreurs.filter(l => !l.isSuivi).slice(0, 8);

  if (suggestions.length === 0) return null;

  return (
    <div className={styles.row} role="list" aria-label={t('livreursPage.suggestions.ariaLabel')}>

      {/* Étiquette */}
      <div className={styles.label} aria-hidden="true">
        <span className={styles.labelTitle}>{t('livreursPage.suggestions.titre')}</span>
        <span className={styles.labelSub}>{t('livreursPage.suggestions.sousTitre')}</span>
      </div>

      {/* Séparateur */}
      <div className={styles.divider} aria-hidden="true" />

      {/* Cards suggestions */}
      {suggestions.map(l => (
        <SuggestItem key={l.id} livreur={l} onToast={onToast} onChange={onChange} />
      ))}

    </div>
  );
};

/* ================================================================
 * SOUS-COMPOSANT : Un item suggestion
 * ================================================================ */
interface SuggestItemProps {
  livreur:  LivreurItem;
  onToast:  (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
  onChange: (id: string, next: { isSuivi: boolean; hidden?: boolean; removed?: boolean }) => void;
}

const SuggestItem: React.FC<SuggestItemProps> = ({ livreur, onToast, onChange }) => {
  const { t } = useTranslation();
  const { openAuthModal, authModal } = useAuthGate();

  return (
    <div className={styles.item} style={{ position: 'relative' }} role="listitem">
      {/* Avatar avec indicateur en ligne */}
      <div className={styles.avaWrap}>
        <div
          className={styles.ava}
          style={{ background: livreur.avatarBg }}
          aria-label={livreur.fullName}
        >
          {livreur.initials}
          {livreur.disponible && (
            <span className={styles.avaDot} aria-label={t('livreursPage.card.disponible')} />
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
      <div onClick={e => e.stopPropagation()}>
        <FollowButton
          actorType="livreur"
          id={livreur.id}
          name={livreur.fullName}
          isSuivi={livreur.isSuivi}
          onToast={onToast}
          onRequireAuth={openAuthModal}
          onChange={next => onChange(livreur.id, next)}
        />
      </div>

      {authModal}
    </div>
  );
};

export default SuggestionsRow;