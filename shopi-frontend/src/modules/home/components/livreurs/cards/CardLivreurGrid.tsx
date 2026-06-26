/* ================================================================
 * FICHIER : src/modules/home/components/livreurs/cards/CardLivreurGrid.tsx
 *
 * RÔLE : Carte livreur — vue GRILLE (bande colorée, stats détaillées).
 *
 * ✅ REFACTOR :
 *   - Composant CONTRÔLÉ : suivi = livreur.isSuivi (plus d'état local).
 *   - Logique follow déléguée au hook partagé useFollowToggle.
 *   - N'appelle plus l'API directement (le parent useLivreurs le fait).
 *   - Route harmonisée : /livreurs/:id
 * ================================================================ */

import React, { useState } from 'react';
import { useNavigate }      from 'react-router-dom';
import styles               from '../styles/CardLivreurGrid.module.css';
import { tokenStorage }     from '../../../../../shared/services/apiFetch';
import { useFollowToggle }  from '../../../../../shared/hooks/useFollowToggle';
import type { LivreurItem } from '../data/livreursMockData';

/* ── Mapping variante de bande → classe CSS ── */
const BAND_CLASS: Record<string, string> = {
  green:  styles.bandGreen,
  blue:   styles.bandBlue,
  teal:   styles.bandTeal,
  purple: styles.bandPurple,
  amber:  styles.bandAmber,
};

/* ── Rendu des étoiles ── */
const renderStars = (note: number) => {
  const full = Math.floor(note);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
};

/* ── Props ── */
interface CardLivreurGridProps {
  livreur:  LivreurItem;
  onToast:  (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
  onFollow: (id: string, newState: boolean) => Promise<void>;
}

/* ================================================================
 * COMPOSANT
 * ================================================================ */
const CardLivreurGrid: React.FC<CardLivreurGridProps> = ({
  livreur, onToast, onFollow,
}) => {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

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

  /* Style dynamique du bouton selon l'état */
  const followStyle: React.CSSProperties = suivi ? {
    background:  hovered
      ? 'linear-gradient(135deg,#B91C1C,#DC2626)'
      : 'linear-gradient(135deg,#047857,#059669)',
    color:       '#fff',
    borderColor: hovered ? '#B91C1C' : '#047857',
    transition:  'all .2s',
  } : {};

  return (
    <article
      className={styles.card}
      onClick={handleViewProfile}
      aria-label={`Profil de ${livreur.fullName}`}
    >
      {/* ── Bande colorée ── */}
      <div className={`${styles.band} ${BAND_CLASS[livreur.bandVariant] ?? styles.bandGreen}`}>
        <div className={styles.bandPattern} aria-hidden="true" />
        <div className={styles.cardMenu} onClick={e => e.stopPropagation()} aria-label="Options">
          <i className="fas fa-ellipsis" aria-hidden="true" />
        </div>
      </div>

      {/* ── Avatar ── */}
      <div className={styles.avaWrap}>
        <div className={styles.ava} style={{ background: livreur.avatarBg }}>
          {livreur.initials}
          {livreur.disponible && <span className={styles.avaDot} aria-label="Disponible" />}
        </div>
        <div className={`${styles.availBadge} ${livreur.disponible ? styles.availOn : styles.availOff}`}>
          {livreur.disponible
            ? <><i className="fas fa-circle" style={{ fontSize: 6 }} aria-hidden="true" /> Disponible</>
            : <><i className="fas fa-gear"   style={{ fontSize: 8 }} aria-hidden="true" /> En course</>
          }
        </div>
      </div>

      {/* ── Corps ── */}
      <div className={styles.body}>
        <div className={styles.name}>{livreur.fullName}</div>
        <div className={styles.zone}>
          <i className="fas fa-map-pin" aria-hidden="true" /> {livreur.zone}
        </div>
        <div className={styles.vehicule}>{livreur.vehicule}</div>

        <div className={styles.rating}>
          <span className={styles.stars} title={`${livreur.averageRating}/5`} aria-hidden="true">
            {renderStars(livreur.averageRating)}
          </span>
          <span className={styles.ratingVal}>{livreur.averageRating}</span>
          <span className={styles.reviewsCnt}>({livreur.reviewsCount} avis)</span>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <div className={styles.statVal}>{livreur.totalLivraisons.toLocaleString('fr-FR')}</div>
            <div className={styles.statLbl}>Livraisons</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statVal}>{livreur.ponctualite}%</div>
            <div className={styles.statLbl}>Ponctualité</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statVal}>{livreur.experience}</div>
            <div className={styles.statLbl}>Expérience</div>
          </div>
        </div>

        {/* ── Bouton Suivre (hook partagé) ── */}
        <button
          className={`${styles.followBtn} ${suivi ? styles.followBtnOn : styles.followBtnOff}`}
          onClick={toggle}
          disabled={loading}
          style={followStyle}
          onMouseEnter={() => suivi && setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          aria-label={
            !tokenStorage.get() ? 'Connexion requise pour suivre'
            : suivi ? `Se désabonner de ${livreur.fullName}`
            : `Suivre ${livreur.fullName}`
          }
        >
          {loading ? (
            <><i className="fas fa-spinner fa-spin" aria-hidden="true" /> …</>
          ) : !tokenStorage.get() ? (
            <><i className="fas fa-right-to-bracket" aria-hidden="true" /> Connexion requise</>
          ) : suivi && hovered ? (
            <><i className="fas fa-user-minus" aria-hidden="true" /> Se désabonner</>
          ) : suivi ? (
            <><i className="fas fa-user-check" aria-hidden="true" /> Abonné(e)</>
          ) : (
            <><i className="fas fa-plus" aria-hidden="true" /> Suivre</>
          )}
        </button>

        <button className={styles.profileLink} onClick={handleViewProfile}
          aria-label={`Voir le profil complet de ${livreur.fullName}`}>
          Voir le profil complet →
        </button>
      </div>
    </article>
  );
};

export default CardLivreurGrid;