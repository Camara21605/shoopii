/* ================================================================
 * FICHIER : src/modules/home/components/livreurs/cards/CardLivreurList.tsx
 *
 * RÔLE : Carte livreur — vue LISTE (ligne horizontale compacte).
 *
 * ✅ REFACTOR : même logique que CardLivreurGrid via useFollowToggle.
 *   - Composant CONTRÔLÉ (suivi = livreur.isSuivi).
 *   - N'appelle plus l'API (le parent useLivreurs le fait).
 *   - Route harmonisée : /livreurs/:id
 * ================================================================ */

import React            from 'react';
import { useNavigate }  from 'react-router-dom';
import styles           from '../styles/CardLivreurList.module.css';
import { useFollowToggle } from '../../../../../shared/hooks/useFollowToggle';
import type { LivreurItem } from '../data/livreursMockData';

/* ── Props ── */
interface CardLivreurListProps {
  livreur:  LivreurItem;
  onToast:  (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
  onFollow: (id: string, newState: boolean) => Promise<void>;
}

/* ================================================================
 * COMPOSANT
 * ================================================================ */
const CardLivreurList: React.FC<CardLivreurListProps> = ({
  livreur, onToast, onFollow,
}) => {
  const navigate = useNavigate();

  /* ✅ État contrôlé par le parent + logique commune */
  const suivi = livreur.isSuivi;
  const { loading, toggle } = useFollowToggle({
    id:      livreur.id,
    name:    livreur.fullName,
    isSuivi: suivi,
    onFollow,
    onToast,
  });

  const handleViewProfile = () => navigate(`/livreurs/${livreur.id}`);

  return (
    <div
      className={styles.item}
      onClick={handleViewProfile}
      role="article"
      aria-label={`Livreur ${livreur.fullName}`}
    >
      {/* ── Avatar ── */}
      <div className={styles.ava} style={{ background: livreur.avatarBg }}>
        {livreur.initials}
        {livreur.disponible && <span className={styles.avaDot} aria-label="Disponible" />}
      </div>

      {/* ── Infos ── */}
      <div className={styles.info}>
        <div className={styles.name}>{livreur.fullName}</div>
        <div className={styles.meta}>
          <span><i className="fas fa-map-pin" aria-hidden="true" />{livreur.zone.split('·')[0].trim()}</span>
          <span>{livreur.vehicule}</span>
          <span>
            <i className="fas fa-circle"
              style={{ color: livreur.disponible ? '#10B981' : '#D1D5DB', fontSize: 8 }}
              aria-hidden="true" />
            {livreur.disponible ? 'Disponible' : 'En course'}
          </span>
        </div>
      </div>

      {/* ── Droite : note + bouton ── */}
      <div className={styles.right} onClick={e => e.stopPropagation()}>
        <div className={styles.ratingWrap}>
          <div className={styles.ratingVal}>{livreur.averageRating}★</div>
          <div className={styles.ratingLivs}>
            {livreur.totalLivraisons.toLocaleString('fr-FR')} livraisons
          </div>
        </div>
        <button
          className={`${styles.followBtn} ${suivi ? styles.followBtnOn : styles.followBtnOff}`}
          onClick={toggle}
          disabled={loading}
        >
          {loading ? (
            <i className="fas fa-spinner fa-spin" aria-hidden="true" />
          ) : suivi ? (
            <><i className="fas fa-user-check" aria-hidden="true" /> Abonné(e)</>
          ) : (
            <><i className="fas fa-plus" aria-hidden="true" /> Suivre</>
          )}
        </button>
      </div>
    </div>
  );
};

export default CardLivreurList;