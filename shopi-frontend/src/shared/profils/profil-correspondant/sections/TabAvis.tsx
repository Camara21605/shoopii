/* ================================================================
 * FICHIER : profil-correspondant/sections/TabAvis.tsx
 *
 * Onglet Avis : score global + répartition (barres) + mots-clés +
 * liste des avis (avec réponse éventuelle du correspondant).
 * ================================================================ */

import React from 'react';
import styles from '../styles/ProfilCorrespondant.module.css';
import type { AvisScore, AvisItem } from '../data/types';

interface Props {
  score:   AvisScore;
  avis:    AvisItem[];
  onToast: (m: string) => void;
}

export default function TabAvis({ score, avis, onToast }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.ch}><div className={styles.ct}><i className="fas fa-star" /> Avis clients</div></div>

      {/* Score global + barres */}
      <div className={styles.ratingOverview}>
        <div className={styles.roScore}>
          <div className={styles.roNum}>{score.moyenne.toFixed(1)}</div>
          <div className={styles.roStars}>{'★'.repeat(Math.round(score.moyenne))}</div>
          <div className={styles.roCnt}>{score.total} avis</div>
        </div>
        <div className={styles.roBars}>
          {score.repartition.map(r => (
            <div key={r.etoiles} className={styles.rbRow}>
              <span className={styles.rbLabel}>{r.etoiles}★</span>
              <div className={styles.rbTrack}><div className={styles.rbFill} style={{ width: `${r.pct}%` }} /></div>
              <span className={styles.rbCnt}>{r.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mots-clés */}
      <div className={styles.roKeywords}>
        {score.keywords.map(k => (
          <span key={k.mot} className={styles.kw}>{k.mot}<span>+{k.count}</span></span>
        ))}
      </div>

      {/* Liste des avis */}
      {avis.map(a => (
        <div key={a.id} className={styles.rev}>
          <div className={styles.revTop}>
            <div className={styles.revAva}>{a.initiales}</div>
            <div>
              <div className={styles.revNm}>{a.nom}</div>
              <div>
                <span className={styles.revStars}>{'★'.repeat(a.note)}</span>
                <span className={styles.revDt}>{a.date}</span>
              </div>
            </div>
            {a.verifie && <span className={`${styles.pill} ${styles.pillG} ${styles.revBadge}`}><i className="fas fa-circle-check" /> Achat vérifié</span>}
          </div>
          <div className={styles.revTxt}>{a.texte}</div>

          {a.reponse && (
            <div className={styles.revReply}>
              <div className={styles.revReplyLbl}><i className="fas fa-reply" /> Réponse de {a.reponse.auteur}</div>
              <div className={styles.revReplyTxt}>{a.reponse.texte}</div>
            </div>
          )}

          <div className={styles.revActions}>
            <span className={styles.revAct} onClick={() => onToast('👍 Merci pour votre retour')}><i className="fas fa-thumbs-up" /> {a.utile} utile</span>
            <span>·</span>
            <span className={styles.revAct} onClick={() => onToast('💬 Répondre')}>Répondre</span>
            <span>·</span>
            <span className={styles.revAct} onClick={() => onToast('🚩 Signalé')}>Signaler</span>
          </div>
        </div>
      ))}
    </div>
  );
}