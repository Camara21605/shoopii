/* ================================================================
 * FICHIER : src/modules/home/components/livreurs/cards/CardLivreurList.tsx
 *
 * RÔLE : Carte livreur — vue LISTE (ligne horizontale compacte).
 *
 * Même logique que CardLivreurGrid : le suivi est délégué au composant
 * partagé FollowButton (qui fait lui-même l'appel API), cette carte
 * reste juste un composant d'affichage. Route harmonisée : /livreurs/:id.
 * ================================================================ */

import React            from 'react';
import { useNavigate }  from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles           from '../styles/CardLivreurList.module.css';
import { useAuthGate }     from '../../../../../shared/hooks/useAuthGate';
import FollowButton        from '../../../../../shared/components/FollowButton';
import type { LivreurItem } from '../data/livreursMockData';

/* ── Props ── */
interface CardLivreurListProps {
  livreur:   LivreurItem;
  onToast:   (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
  /** Voir le commentaire équivalent dans CardLivreurGrid.tsx. */
  onChange?: (id: string, next: { isSuivi: boolean; hidden?: boolean; removed?: boolean }) => void;
}

/* ================================================================
 * COMPOSANT
 * ================================================================ */
const CardLivreurList: React.FC<CardLivreurListProps> = ({
  livreur, onToast, onChange,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openAuthModal, authModal } = useAuthGate();

  const handleViewProfile = () => navigate(`/livreurs/${livreur.id}`);

  return (
    <div
      className={styles.item}
      style={{ position: 'relative' }}
      onClick={handleViewProfile}
      role="article"
      aria-label={t('livreursPage.card.livreurAriaLabel', { nom: livreur.fullName })}
    >
      {/* ── Avatar ── */}
      <div className={styles.ava} style={{ background: livreur.avatarBg }}>
        {livreur.initials}
        {livreur.disponible && <span className={styles.avaDot} aria-label={t('livreursPage.card.disponible')} />}
      </div>

      {/* ── Infos ── */}
      <div className={styles.info}>
        <div className={styles.name}>{livreur.fullName}</div>
        <div className={styles.meta}>
          <span><i className="fas fa-map-pin" aria-hidden="true" />{livreur.zone.split('·')[0].trim()}</span>
          <span>{livreur.vehicule}</span>
          <span>
            <i className="fas fa-circle"
              style={{ color: livreur.disponible ? 'var(--t1)' : 'var(--t4)', fontSize: 8 }}
              aria-hidden="true" />
            {livreur.disponible ? t('livreursPage.card.disponible') : t('livreursPage.card.enCourse')}
          </span>
        </div>
      </div>

      {/* ── Droite : note + bouton ── */}
      <div className={styles.right} onClick={e => e.stopPropagation()}>
        <div className={styles.ratingWrap}>
          <div className={styles.ratingVal}>{livreur.averageRating}★</div>
          <div className={styles.ratingLivs}>
            {t('livreursPage.card.livraisonsCount', { count: livreur.totalLivraisons.toLocaleString('fr-FR') })}
          </div>
        </div>
        <FollowButton
          actorType="livreur"
          id={livreur.id}
          name={livreur.fullName}
          isSuivi={livreur.isSuivi}
          onToast={onToast}
          onRequireAuth={openAuthModal}
          onChange={next => onChange?.(livreur.id, next)}
        />
      </div>

      {authModal}
    </div>
  );
};

export default CardLivreurList;