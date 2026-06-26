/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/components/CardLivreurBoutique.tsx
 *
 * RÔLE    : Carte d'un livreur dans la section Livreurs
 *           de la page boutique.
 *
 * AFFICHE :
 *   - Avatar avec indicateur disponibilité (vert/orange)
 *   - Nom, zone de livraison
 *   - Note + nombre de livraisons
 *   - Badge statut (Disponible / En course)
 *   - Boutons : Voir profil | Suivre (toggle abonnement)
 * ============================================================
 */
import React, { useState } from 'react';
import type { LivreurBoutique } from '../data/boutiqueMockData';
import styles from '../styles/CardsLivreur.module.css';

interface Props {
  l:       LivreurBoutique;
  onToast: (m: string) => void;
}

function Stars({ n }: { n: number }) {
  return <span className={styles.stars}>{'★'.repeat(Math.round(n))}{'☆'.repeat(5-Math.round(n))}</span>;
}

export default function CardLivreurBoutique({ l, onToast }: Props) {
  const [suivi, setSuivi] = useState(false);

  return (
    <div className={styles.card}>

      {/* ── Avatar + indicateur disponibilité ── */}
      <div className={styles.avaWrap}>
        <div className={styles.ava}>{l.emoji}</div>
        {/* Point vert = disponible, orange = en course */}
        <div className={`${styles.dot} ${l.dispo ? styles.dotOn : styles.dotOff}`} />
      </div>

      {/* ── Nom ── */}
      <div className={styles.nom}>{l.nom}</div>

      {/* ── Zone de livraison ── */}
      <div className={styles.zone}>
        <i className="fas fa-map-pin" /> {l.zone}
      </div>

      {/* ── Stats : note + livraisons ── */}
      <div className={styles.stats}>
        <span><Stars n={l.note} /> {l.note.toFixed(1)}</span>
        <span>{l.trips} livraisons</span>
      </div>

      {/* ── Badge statut ── */}
      <span className={l.dispo ? styles.dispoBadge : styles.occupeBadge}>
        {l.dispo ? '● Disponible' : '⚙ En course'}
      </span>

      {/* ── Boutons d'action ── */}
      <div className={styles.btns}>
        <button
          className={styles.btnProfil}
          onClick={() => onToast(`🛵 Profil de ${l.nom}`)}
        >
          <i className="fas fa-user" /> Voir profil
        </button>
        <button
          className={`${styles.btnSuivre} ${suivi ? styles.btnSuivreOn : ''}`}
          onClick={() => { setSuivi(s => !s); onToast(suivi ? `👋 Désabonné de ${l.nom}` : `✅ Abonné à ${l.nom}`); }}
        >
          {suivi ? <><i className="fas fa-check" /></> : <><i className="fas fa-plus" /></>}
        </button>
      </div>
    </div>
  );
}
