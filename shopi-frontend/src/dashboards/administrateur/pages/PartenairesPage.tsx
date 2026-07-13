/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/PartenairesPage.tsx
 *
 * Partenaires de la zone : podium Top 3 + filtres par palier
 * + cartes avec actions Gérer / Suspendre.
 * ================================================================ */

import { useState } from 'react';
import styles from '../styles/PartenairesPage.module.css';
import { PARTENAIRES, TOP3 } from '../data/adminData';
import type { PartenaireTier } from '../data/types';

interface PartenairesPageProps {
  onSanction: (cible: string) => void;
  onToast:    (msg: string, type?: 's' | 'i' | 'w') => void;
}

const TIER_LABEL: Record<PartenaireTier, string> = { or: 'Or', arg: 'Argent', brz: 'Bronze' };

export default function PartenairesPage({ onSanction, onToast }: PartenairesPageProps) {
  const [filtre, setFiltre]       = useState<'all' | PartenaireTier>('all');
  const [recherche, setRecherche] = useState('');

  /* Filtrage par palier + recherche textuelle */
  const visibles = PARTENAIRES.filter(p =>
    (filtre === 'all' || p.tier === filtre) &&
    p.nom.toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <div>
      {/* ── Podium Top 3 ── */}
      <div className={styles.top3}>
        {TOP3.map((t, i) => (
          <div key={t.nom} className={`${styles.top3Card} ${i === 0 ? styles.first : ''}`}>
            <div className={`${styles.rank} ${styles['r' + (i + 1)]}`}>{i + 1}</div>
            <div className={styles.top3Av} style={{ background: t.grad }}>{t.avatar}</div>
            <div className={styles.top3Nm}>{t.nom}</div>
            <div className={styles.top3V}>{t.v}</div>
            <div className={styles.top3L}>{t.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Barre de filtres ── */}
      <div className={styles.filterBar}>
        <button className={`${styles.fchip} ${filtre === 'all' ? styles.fon : ''}`} onClick={() => setFiltre('all')}>
          Tous <span className={styles.n}>12</span>
        </button>
        <button className={`${styles.fchip} ${filtre === 'or' ? styles.fon : ''}`} onClick={() => setFiltre('or')}>
          <i className="fas fa-crown" style={{ color: 'var(--gold)' }} /> Or <span className={styles.n}>3</span>
        </button>
        <button className={`${styles.fchip} ${filtre === 'arg' ? styles.fon : ''}`} onClick={() => setFiltre('arg')}>
          Argent <span className={styles.n}>5</span>
        </button>
        <button className={`${styles.fchip} ${filtre === 'brz' ? styles.fon : ''}`} onClick={() => setFiltre('brz')}>
          Bronze <span className={styles.n}>4</span>
        </button>
        <div className={styles.searchIn}>
          <i className="fas fa-magnifying-glass" />
          <input placeholder="Rechercher un partenaire…" value={recherche}
            onChange={e => setRecherche(e.target.value)} />
        </div>
      </div>

      {/* ── Grille de cartes partenaires ── */}
      <div className={styles.grid}>
        {visibles.map(p => (
          <div key={p.id} className={styles.pcard}>
            <div className={styles.top}>
              <div className={styles.av}>{p.avatar}</div>
              <div style={{ flex: 1 }}>
                <div className={styles.nm}>{p.nom}</div>
                <div className={styles.meta}>{p.commune} · depuis {p.depuis}</div>
              </div>
              <span className={`${styles.tier} ${styles['tier_' + p.tier]}`}>
                {p.tier === 'or' && <i className="fas fa-crown" />} {TIER_LABEL[p.tier]}
              </span>
            </div>
            <div className={styles.body}>
              <div className={styles.stat}><div className={styles.sv}>{p.recrues}</div><div className={styles.sl}>Recrues</div></div>
              <div className={styles.stat}><div className={styles.sv}>{p.conversion}%</div><div className={styles.sl}>Conversion</div></div>
              <div className={styles.stat}><div className={styles.sv}>{p.confiance}</div><div className={styles.sl}>Confiance</div></div>
            </div>
            <div className={styles.foot}>
              <span className={`${styles.state} ${p.statut === 'act' ? styles.stateAct : styles.statePend}`}>
                {p.statut === 'act' ? 'Actif' : 'En observation'}
              </span>
              <div className={styles.footBtns}>
                <button className={styles.btn} onClick={() => onToast('👤 Profil de ' + p.nom, 'i')}>Gérer</button>
                <button className={styles.banBtn} title="Suspendre" onClick={() => onSanction(p.nom)}>
                  <i className="fas fa-ban" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
