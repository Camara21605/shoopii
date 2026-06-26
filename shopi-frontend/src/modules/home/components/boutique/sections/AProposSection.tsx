/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/sections/AProposSection.tsx
 *
 * RÔLE    : Onglet "À propos" — présentation complète de la boutique.
 *
 * AFFICHE :
 *   - Description + 4 stats clés
 *   - Infos pratiques (horaires, adresse, téléphone, email, site)
 *   - Liste des livreurs (aperçu)
 * ============================================================
 */
import React from 'react';
import { BOUTIQUE_INFO, LIVREURS_MOCK } from '../data/boutiqueMockData';
import styles from '../styles/AProposSection.module.css';

interface Props { onToast: (m: string) => void; }

function Stars({ n }: { n: number }) {
  return <span className={styles.stars}>{'★'.repeat(Math.round(n))}{'☆'.repeat(5-Math.round(n))}</span>;
}

export default function AProposSection({ onToast }: Props) {
  return (
    <div className={styles.grid}>

      {/* ── 1. Description + stats ── */}
      <div className={styles.card}>
        <h3><i className="fas fa-store" /> À propos de la boutique</h3>
        <p className={styles.desc}>{BOUTIQUE_INFO.description}</p>
        <div className={styles.statsGrid}>
          {[
            { val:'5+',  lbl:"Années d'expérience" },
            { val:'18K+',lbl:'Commandes livrées'   },
            { val:'98%', lbl:'Satisfaction client' },
            { val:'4.9', lbl:'Note moyenne'        },
          ].map(s => (
            <div key={s.lbl} className={styles.stat}>
              <div className={styles.statV}>{s.val}</div>
              <div className={styles.statL}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. Infos pratiques ── */}
      <div className={styles.card}>
        <h3><i className="fas fa-clock" /> Infos pratiques</h3>
        <div className={styles.infoRows}>
          {[
            { ico:'🕐', bg:'bg1', title:'Horaires',  sub: BOUTIQUE_INFO.horaires },
            { ico:'📍', bg:'bg2', title:'Adresse',   sub: BOUTIQUE_INFO.adresse  },
            { ico:'📞', bg:'bg3', title:'Téléphone', sub: BOUTIQUE_INFO.tel      },
            { ico:'✉️', bg:'bg4', title:'Email',     sub: BOUTIQUE_INFO.email    },
            { ico:'🌐', bg:'bg5', title:'Site web',  sub: BOUTIQUE_INFO.website  },
          ].map(r => (
            <div key={r.title} className={styles.infoRow}>
              <div className={`${styles.infoIco} ${styles[r.bg]}`}>{r.ico}</div>
              <div>
                <div className={styles.infoTitle}>{r.title}</div>
                <div className={styles.infoSub}>{r.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Livreurs de la boutique (pleine largeur) ── */}
      <div className={`${styles.card} ${styles.cardFull}`}>
        <h3><i className="fas fa-motorcycle" /> Livreurs de la boutique</h3>
        <div className={styles.livreursListe}>
          {LIVREURS_MOCK.slice(0, 4).map(l => (
            <div key={l.id} className={styles.livrItem}>
              {/* Avatar */}
              <div className={styles.livrAvaWrap}>
                <div className={styles.livrAva}>{l.emoji}</div>
                <div className={`${styles.livrDot} ${l.dispo ? styles.livrDotOn : styles.livrDotOff}`} />
              </div>
              {/* Infos */}
              <div className={styles.livrInfos}>
                <div className={styles.livrNom}>{l.nom}</div>
                <div className={styles.livrZone}>
                  <i className="fas fa-map-pin" /> {l.zone}
                </div>
              </div>
              {/* Note */}
              <div className={styles.livrNote}>
                <Stars n={l.note} /> {l.note}
              </div>
              {/* Bouton profil */}
              <button
                className={styles.livrBtn}
                onClick={() => onToast(`🛵 Profil de ${l.nom}`)}
              >
                Voir profil
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
