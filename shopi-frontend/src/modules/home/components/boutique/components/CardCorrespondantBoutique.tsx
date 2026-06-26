/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/components/CardCorrespondantBoutique.tsx
 *
 * RÔLE    : Carte d'un correspondant dans la section Correspondants
 *           de la page boutique, vue client.
 *
 * AFFICHE :
 *   - Avatar emoji + badge "Vérifié Shopi" si certified
 *   - Nom, ville/quartier, pays + drapeau
 *   - Note + nombre de colis gérés + taux de succès
 *   - Badge statut (Disponible / Complet)
 *   - Tarif + délai + horaires
 *   - Langues parlées
 *   - Bio courte
 *   - Boutons : Contacter | Choisir ce correspondant
 * ============================================================
 */
import React, { useState } from 'react';
import type { CorrespondantBoutique } from '../data/boutiqueMockData';
import styles from '../styles/CardsCorrespondant.module.css';

interface Props {
  c:       CorrespondantBoutique;
  onToast: (m: string) => void;
}

function Stars({ n }: { n: number }) {
  return (
    <span className={styles.stars}>
      {'★'.repeat(Math.round(n))}{'☆'.repeat(5 - Math.round(n))}
    </span>
  );
}

export default function CardCorrespondantBoutique({ c, onToast }: Props) {
  const [choisi, setChoisi] = useState(false);

  return (
    <div className={`${styles.card} ${!c.dispo ? styles.cardOff : ''} ${choisi ? styles.cardChoisi : ''}`}>

      {/* ── Badge Vérifié (coin haut droit) ── */}
      {c.verified && (
        <span className={styles.verifBadge}>
          <i className="fas fa-shield-check" /> Vérifié
        </span>
      )}

      {/* ── Avatar ── */}
      <div className={styles.avaWrap}>
        <div className={styles.ava}>{c.emoji}</div>
        <div className={`${styles.dot} ${c.dispo ? styles.dotOn : styles.dotOff}`} />
      </div>

      {/* ── Nom ── */}
      <div className={styles.nom}>{c.nom}</div>

      {/* ── Localisation ── */}
      <div className={styles.loc}>
        <i className="fas fa-location-dot" />
        {c.drapeau} {c.quartier}, {c.ville} · {c.pays}
      </div>

      {/* ── Stats ── */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <Stars n={c.note} />
          <span className={styles.statVal}>{c.note.toFixed(1)}</span>
        </div>
        <div className={styles.statSep} />
        <div className={styles.stat}>
          <i className="fas fa-box" style={{ color:'var(--blue)', fontSize:11 }} />
          <span className={styles.statVal}>{c.colis} colis/mois</span>
        </div>
        <div className={styles.statSep} />
        <div className={styles.stat}>
          <i className="fas fa-check-circle" style={{ color:'var(--emerald)', fontSize:11 }} />
          <span className={styles.statVal}>{c.succès}</span>
        </div>
      </div>

      {/* ── Badge statut disponibilité ── */}
      <span className={c.dispo ? styles.dispoBadge : styles.occupeBadge}>
        {c.dispo ? '● Disponible' : '◌ Complet'}
      </span>

      {/* ── Infos pratiques ── */}
      <div className={styles.infos}>
        <div className={styles.infoRow}>
          <i className="fas fa-coins" />
          <span>{c.tarif}</span>
        </div>
        <div className={styles.infoRow}>
          <i className="fas fa-clock" />
          <span>{c.delai} · {c.horaires}</span>
        </div>
        <div className={styles.infoRow}>
          <i className="fas fa-language" />
          <span>{c.langues.join(', ')}</span>
        </div>
      </div>

      {/* ── Bio ── */}
      <p className={styles.bio}>{c.bio}</p>

      {/* ── Boutons d'action ── */}
      <div className={styles.btns}>
        <button
          className={styles.btnContact}
          onClick={() => onToast(`💬 Message à ${c.nom}`)}
        >
          <i className="fas fa-comment-dots" /> Contacter
        </button>
        <button
          className={`${styles.btnChoisir} ${choisi ? styles.btnChoisirOn : ''} ${!c.dispo ? styles.btnChoisirOff : ''}`}
          disabled={!c.dispo}
          onClick={() => {
            if (!c.dispo) return;
            setChoisi(v => !v);
            onToast(choisi
              ? `↩️ Correspondant ${c.nom} retiré`
              : `✅ ${c.nom} sélectionné comme correspondant`
            );
          }}
        >
          <i className={`fas ${choisi ? 'fa-check' : 'fa-plus'}`} />
          {choisi ? 'Choisi' : 'Choisir'}
        </button>
      </div>
    </div>
  );
}