/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/sections/BoutiqueIdentity.tsx
 *
 * RÔLE    : Barre d'identité sticky sous le header.
 *           Reste visible en scrollant pour garder
 *           le contexte de la boutique.
 *
 * AFFICHE :
 *   - Nom de la boutique + badge Vérifié Shopi
 *   - Domaine, ville, date membre
 *   - Stats (note, abonnés, satisfaction, ventes)
 *   - Boutons : S'abonner (toggle) | Message | Partager
 * ============================================================
 */
import React from 'react';
import type { BoutiqueInfo } from '../data/boutiqueMockData';
import styles from '../styles/BoutiqueIdentity.module.css';

interface Props {
  boutique:       BoutiqueInfo;
  suivi:          boolean;
  suiviPending?:  boolean;
  msgLoading?:    boolean;
  onToggleSuivi:  () => void;
  onMessage:      () => void;
  onPartage:      () => void;
}

export default function BoutiqueIdentity({ boutique, suivi, suiviPending, msgLoading, onToggleSuivi, onMessage, onPartage }: Props) {
  return (
    <div className={styles.bar}>
      <div className={styles.inner}>

        {/* ── Nom + badges ── */}
        <div className={styles.nameBlock}>
          <div className={styles.title}>
            {boutique.nom}
            {boutique.verified && (
              <span className={styles.verifBadge}>
                <i className="fas fa-shield-check" /> Vérifié Shopi
              </span>
            )}
          </div>
          <div className={styles.meta}>
            <span className={styles.domainBadge}>
              <i className="fas fa-microchip" /> {boutique.domaine}
            </span>
            <span className={styles.metaItem}>
              <i className="fas fa-location-dot" style={{ color:'var(--blue)' }} /> {boutique.ville}
            </span>
            <span className={styles.metaItem}>
              <i className="fas fa-calendar" style={{ color:'var(--t4)' }} /> {boutique.membre}
            </span>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className={styles.stats}>
          {/* Note avec étoiles dynamiques */}
          <React.Fragment>
            <div className={styles.stat}>
              <div className={styles.statV}>{boutique.note.toFixed(1)}</div>
              <div style={{ display:'flex', gap:1, justifyContent:'center', margin:'2px 0' }}>
                {[1,2,3,4,5].map(v => {
                  const filled = v <= Math.floor(boutique.note);
                  const half   = !filled && v === Math.ceil(boutique.note) && boutique.note % 1 >= 0.3;
                  return (
                    <span key={v} style={{
                      fontSize:11,
                      color: filled ? '#F59E0B' : half ? '#F59E0B' : '#D1D5DB',
                      opacity: half ? 0.6 : 1,
                    }}>★</span>
                  );
                })}
              </div>
              <div className={styles.statL}>Note</div>
            </div>
            <div className={styles.sep} />
          </React.Fragment>

          {[
            { val: boutique.abonnes, lbl:'Abonnés'      },
            { val: boutique.satisf,  lbl:'Satisfaction' },
            { val: boutique.ventes,  lbl:'Ventes'       },
          ].map((s, i) => (
            <React.Fragment key={i}>
              <div className={styles.stat}>
                <div className={styles.statV}>{s.val}</div>
                <div className={styles.statL}>{s.lbl}</div>
              </div>
              {i < 2 && <div className={styles.sep} />}
            </React.Fragment>
          ))}
        </div>

        {/* ── Boutons d'action ── */}
        <div className={styles.actions}>
          {/* S'abonner / Abonné (toggle — appel API réel) */}
          <button
            className={`${styles.btnSub} ${suivi ? styles.btnSubOn : ''}`}
            onClick={onToggleSuivi}
            disabled={suiviPending}
            style={{ opacity: suiviPending ? 0.65 : 1 }}
          >
            <i className={`fas ${suiviPending ? 'fa-spinner fa-spin' : suivi ? 'fa-check' : 'fa-plus'}`} />
            <span>{suiviPending ? '…' : suivi ? 'Abonné' : "S'abonner"}</span>
          </button>

          {/* Message — actif uniquement si abonné */}
          <button
            className={styles.btnMsg}
            onClick={onMessage}
            disabled={!suivi || msgLoading}
            title={!suivi ? 'Abonnez-vous pour envoyer un message' : 'Envoyer un message'}
            style={{ opacity: !suivi ? 0.45 : msgLoading ? 0.65 : 1, cursor: !suivi ? 'not-allowed' : 'pointer' }}
          >
            <i className={`fas ${msgLoading ? 'fa-spinner fa-spin' : 'fa-comment-dots'}`} />
            {msgLoading ? '…' : 'Message'}
          </button>

          {/* Partager */}
          <button className={styles.btnShare} onClick={onPartage} title="Partager la boutique">
            <i className="fas fa-share-nodes" />
          </button>
        </div>
      </div>
    </div>
  );
}
