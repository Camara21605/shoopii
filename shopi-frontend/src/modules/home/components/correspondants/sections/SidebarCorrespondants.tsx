/* ================================================================
 * FICHIER : correspondants/sections/SidebarCorrespondants.tsx
 *
 * Colonne de filtres : type (régional/zonal/national), commune,
 * note minimale, statut en ligne/hors ligne.
 * ================================================================ */

import React from 'react';
import styles from '../styles/Correspondants.module.css';
import type { CorrType } from '../data/types';

interface Props {
  /* Filtre type */
  typeActif:   CorrType | 'all';
  onType:      (t: CorrType | 'all') => void;
  /* Filtre commune */
  communeActive: string;
  communes:      { id: string; label: string; count: number }[];
  onCommune:     (c: string) => void;
  /* Filtre note */
  noteMin:     number;
  onNote:      (n: number) => void;
  /* Filtre statut */
  statut:      'all' | 'online' | 'offline';
  onStatut:    (s: 'all' | 'online' | 'offline') => void;
  /* Réinitialiser */
  onReset:     () => void;
  /* Compteurs par type */
  countType:   (t: CorrType) => number;
}

const TYPES: { id: CorrType; ico: string; nm: string; desc: string }[] = [
  { id: 'regional', ico: '🏠', nm: 'Régional', desc: 'Couvre une ville' },
  { id: 'zonal',    ico: '🗺️', nm: 'Zonal',    desc: 'Couvre une région' },
  { id: 'national', ico: '🌍', nm: 'National',  desc: 'Couvre tout le pays' },
];

const NOTES = [
  { val: 5, label: '5 étoiles seulement', stars: 5 },
  { val: 4, label: '4+ étoiles',          stars: 4 },
  { val: 3, label: '3+ étoiles',          stars: 3 },
  { val: 0, label: 'Toutes les notes',    stars: 0 },
];

export default function SidebarCorrespondants({
  typeActif, onType, communeActive, communes, onCommune,
  noteMin, onNote, statut, onStatut, onReset, countType,
}: Props) {
  return (
    <aside>
      {/* ── Type ── */}
      <div className={styles.sf}>
        <div className={styles.sfh}>
          <span className={styles.sft}><i className="fas fa-layer-group" /> Type de correspondant</span>
        </div>
        <div className={styles.sfb}>
          <div className={styles.typeCards}>
            {TYPES.map(t => (
              <div
                key={t.id}
                className={`${styles.tc} ${typeActif === t.id ? styles.tcOn : ''}`}
                onClick={() => onType(typeActif === t.id ? 'all' : t.id)}
              >
                <div className={styles.tcIco}>{t.ico}</div>
                <div>
                  <div className={styles.tcNm}>{t.nm}</div>
                  <div className={styles.tcDesc}>{t.desc}</div>
                </div>
                <span className={styles.tcCnt}>{countType(t.id)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Commune ── */}
      <div className={styles.sf}>
        <div className={styles.sfh}>
          <span className={styles.sft}><i className="fas fa-map-pin" /> Commune</span>
        </div>
        <div className={styles.sfb}>
          <div className={styles.comChips}>
            {communes.map(c => (
              <div
                key={c.id}
                className={`${styles.cch} ${communeActive === c.id ? styles.cchOn : ''}`}
                onClick={() => onCommune(c.id)}
              >
                <i className="fas fa-map-pin" /> {c.label}
                <span className={styles.cchCnt}>{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Note ── */}
      <div className={styles.sf}>
        <div className={styles.sfh}>
          <span className={styles.sft}><i className="fas fa-star" /> Note minimale</span>
        </div>
        <div className={styles.sfb}>
          <div className={styles.rops}>
            {NOTES.map(n => (
              <div
                key={n.val}
                className={`${styles.rop} ${noteMin === n.val ? styles.ropOn : ''}`}
                onClick={() => onNote(n.val)}
              >
                {n.stars > 0 && (
                  <span className={styles.stars}>
                    {'★'.repeat(n.stars)}<span style={{ color: 'var(--bdr2)' }}>{'★'.repeat(5 - n.stars)}</span>
                  </span>
                )}
                {n.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Statut ── */}
      <div className={styles.sf}>
        <div className={styles.sfh}>
          <span className={styles.sft}><i className="fas fa-signal" /> Disponibilité</span>
          <button className={styles.sfr} onClick={onReset}>Réinitialiser</button>
        </div>
        <div className={styles.sfb}>
          <div className={styles.stogWrap}>
            <div
              className={`${styles.stog} ${statut === 'online' ? styles.stogOnAv : ''}`}
              onClick={() => onStatut(statut === 'online' ? 'all' : 'online')}
            >
              <i className="fas fa-circle" style={{ color: '#10B981' }} />En ligne
            </div>
            <div
              className={`${styles.stog} ${statut === 'offline' ? styles.stogOnOff : ''}`}
              onClick={() => onStatut(statut === 'offline' ? 'all' : 'offline')}
            >
              <i className="fas fa-moon" />Hors ligne
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}