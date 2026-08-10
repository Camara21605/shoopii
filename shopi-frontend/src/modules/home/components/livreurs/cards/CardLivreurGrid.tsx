/* ================================================================
 * FICHIER : src/modules/home/components/livreurs/cards/CardLivreurGrid.tsx
 *
 * RÔLE : Carte livreur — vue GRILLE (bande colorée, stats détaillées).
 *
 * Le suivi (S'abonner / Suivi(e) + menu ⋮) est délégué au composant
 * partagé FollowButton, qui fait lui-même l'appel API — cette carte
 * reste juste un composant d'affichage, route harmonisée : /livreurs/:id.
 * ================================================================ */

import React from 'react';
import { useNavigate }      from 'react-router-dom';
import { useTranslation }   from 'react-i18next';
import styles               from '../styles/CardLivreurGrid.module.css';
import { useAuthGate }      from '../../../../../shared/hooks/useAuthGate';
import FollowButton         from '../../../../../shared/components/FollowButton';
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
  livreur:    LivreurItem;
  onToast:    (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
  /** Reflète l'action du menu ⋮ (suivi/masqué/supprimé) vers la liste
   *  partagée du parent — nécessaire ici car le filtre rapide "Abonnés"
   *  et la sidebar "Mes livreurs suivis" lisent isSuivi depuis ce même
   *  état partagé (useLivreurs), contrairement aux pages plus simples. */
  onChange?:  (id: string, next: { isSuivi: boolean; hidden?: boolean; removed?: boolean }) => void;
}

/* ================================================================
 * COMPOSANT
 * ================================================================ */
const CardLivreurGrid: React.FC<CardLivreurGridProps> = ({
  livreur, onToast, onChange,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { openAuthModal, authModal } = useAuthGate();

  const handleViewProfile = () => navigate(`/livreurs/${livreur.id}`);

  return (
    <article
      className={styles.card}
      onClick={handleViewProfile}
      aria-label={t('livreursPage.card.profilDe', { nom: livreur.fullName })}
    >
      {/* ── Bande colorée ── */}
      <div className={`${styles.band} ${BAND_CLASS[livreur.bandVariant] ?? styles.bandGreen}`}>
        <div className={styles.bandPattern} aria-hidden="true" />
      </div>

      {/* ── Avatar ── */}
      <div className={styles.avaWrap}>
        <div className={styles.ava} style={{ background: livreur.avatarBg }}>
          {livreur.initials}
          {livreur.disponible && <span className={styles.avaDot} aria-label={t('livreursPage.card.disponible')} />}
        </div>
        <div className={`${styles.availBadge} ${livreur.disponible ? styles.availOn : styles.availOff}`}>
          {livreur.disponible
            ? <><i className="fas fa-circle" style={{ fontSize: 6 }} aria-hidden="true" /> {t('livreursPage.card.disponible')}</>
            : <><i className="fas fa-gear"   style={{ fontSize: 8 }} aria-hidden="true" /> {t('livreursPage.card.enCourse')}</>
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
          <span className={styles.reviewsCnt}>{t('livreursPage.card.avisCount', { count: livreur.reviewsCount })}</span>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <div className={styles.statVal}>{livreur.totalLivraisons.toLocaleString('fr-FR')}</div>
            <div className={styles.statLbl}>{t('livreursPage.card.livraisons')}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statVal}>{livreur.ponctualite}%</div>
            <div className={styles.statLbl}>{t('livreursPage.card.ponctualite')}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statVal}>{livreur.experience}</div>
            <div className={styles.statLbl}>{t('livreursPage.card.experience')}</div>
          </div>
        </div>

        {/* ── Bouton Suivre / Suivi(e) + menu ⋮ ── */}
        <div onClick={ev => ev.stopPropagation()}>
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

        <button className={styles.profileLink} onClick={handleViewProfile}
          aria-label={t('livreursPage.card.profilCompletAria', { nom: livreur.fullName })}>
          {t('livreursPage.card.voirProfilComplet')}
        </button>
      </div>

      {authModal}
    </article>
  );
};

export default CardLivreurGrid;