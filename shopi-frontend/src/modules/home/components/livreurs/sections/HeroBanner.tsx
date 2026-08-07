/* ================================================================
 * FICHIER : src/modules/home/components/livreurs/sections/HeroBanner.tsx
 *
 * RÔLE : Bannière hero de la page Livreurs.
 *        Affiche le titre, les stats réseau et des mini-cartes
 *        de livreurs mis en avant sur fond navy dégradé.
 *
 * PARENT : LivreursPage.tsx
 * STYLES : ../styles/HeroBanner.module.css
 * ================================================================ */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles               from '../styles/HeroBanner.module.css';
import type { LivreurItem, HeroStat } from '../data/livreursMockData';

/* ── Props ── */
interface HeroBannerProps {
  stats:    HeroStat[];
  featured: LivreurItem[];
  onFollow: (id: string, newState: boolean) => void;
}

/* ================================================================
 * COMPOSANT PRINCIPAL
 * ================================================================ */
const HeroBanner: React.FC<HeroBannerProps> = ({ stats, featured, onFollow }) => {
  const { t } = useTranslation();
  return (
    <section className={styles.hero} aria-label={t('livreursPage.hero.ariaLabel')}>

      {/* Arrière-plans décoratifs */}
      <div className={styles.bg}   aria-hidden="true" />
      <div className={styles.geo}  aria-hidden="true" />
      <div className={styles.dots} aria-hidden="true" />

      <div className={styles.inner}>

        {/* ── Colonne gauche : texte + stats ── */}
        <div className={styles.left}>
          <div className={styles.sup}>
            <i className="fas fa-motorcycle" aria-hidden="true" />
            {t('livreursPage.hero.supTitle')}
          </div>

          <h1 className={styles.title}>
            {t('livreursPage.hero.titrePart1')} <em>{t('livreursPage.hero.titreEm')}</em><br />{t('livreursPage.hero.titrePart2')}
          </h1>

          <p className={styles.sub}>
            {t('livreursPage.hero.sub')}
          </p>

          <div className={styles.stats}>
            {stats.map((s, i) => (
              <div key={i} className={styles.stat}>
                <div className={styles.statVal}>{s.value}</div>
                <div className={styles.statLbl}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Colonne droite : mini-cartes livreurs ── */}
        <div className={styles.right} aria-label={t('livreursPage.hero.livreursSuggeres')}>
          {featured.slice(0, 2).map(l => (
            <HeroMiniCard key={l.id} livreur={l} onFollow={onFollow} />
          ))}
        </div>

      </div>
    </section>
  );
};

/* ================================================================
 * SOUS-COMPOSANT : Mini-carte hero
 * ================================================================ */
interface HeroMiniCardProps {
  livreur:  LivreurItem;
  onFollow: (id: string, newState: boolean) => void;
}

const HeroMiniCard: React.FC<HeroMiniCardProps> = ({ livreur, onFollow }) => {
  const { t } = useTranslation();
  const [followed, setFollowed] = useState(livreur.isSuivi);

  const handleFollow = () => {
    const next = !followed;
    setFollowed(next);
    onFollow(livreur.id, next);
  };

  return (
    <div className={styles.miniCard}>
      {/* Avatar */}
      <div className={styles.miniAvaWrap}>
        <div className={styles.miniAva} style={{ background: livreur.avatarBg }}>
          {livreur.initials}
          {livreur.disponible && <span className={styles.miniDot} aria-hidden="true" />}
        </div>
      </div>

      {/* Infos */}
      <div className={styles.miniName}>
        {livreur.fullName.split(' ')[0]} {livreur.fullName.split(' ')[1]?.[0]}.
      </div>
      <div className={styles.miniZone}>
        <i className="fas fa-map-pin" aria-hidden="true" /> {livreur.zone.split(' ')[0]}
      </div>

      {/* Bouton suivre */}
      <button
        className={`${styles.miniBtn} ${followed ? styles.miniBtnOn : ''}`}
        onClick={handleFollow}
        aria-label={followed ? t('livreursPage.card.seDesabonnerDe', { nom: livreur.fullName }) : t('livreursPage.card.suivreNom', { nom: livreur.fullName })}
      >
        {followed
          ? <><i className="fas fa-check" aria-hidden="true" /> {t('livreursPage.hero.abonne')}</>
          : <><i className="fas fa-plus"  aria-hidden="true" /> {t('livreursPage.hero.suivre')}</>
        }
      </button>
    </div>
  );
};

export default HeroBanner;