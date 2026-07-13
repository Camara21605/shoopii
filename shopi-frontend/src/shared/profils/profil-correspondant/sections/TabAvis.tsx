/* ================================================================
 * FICHIER : profil-correspondant/sections/TabAvis.tsx
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
  /* Aucun avis disponible */
  if (score.total === 0 && avis.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.ch}><div className={styles.ct}><i className="fas fa-star" /> Avis clients</div></div>
        <div className={styles.cb}>
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted, #6B7280)' }}>
            <i className="fas fa-star" style={{ fontSize: 28, marginBottom: 10, display: 'block', opacity: 0.3 }} />
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Aucun avis pour le moment</div>
            <div style={{ fontSize: 12 }}>Les avis clients apparaîtront ici après chaque mission complétée.</div>
          </div>
        </div>
      </div>
    );
  }

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
      {score.keywords.length > 0 && (
        <div className={styles.roKeywords}>
          {score.keywords.map(k => (
            <span key={k.mot} className={styles.kw}>{k.mot}<span>+{k.count}</span></span>
          ))}
        </div>
      )}

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
            {a.verifie && (
              <span className={`${styles.pill} ${styles.pillG} ${styles.revBadge}`}>
                <i className="fas fa-circle-check" /> Achat vérifié
              </span>
            )}
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
            <span className={styles.revAct} onClick={() => onToast('🚩 Signalé')}>Signaler</span>
          </div>
        </div>
      ))}
    </div>
  );
}
