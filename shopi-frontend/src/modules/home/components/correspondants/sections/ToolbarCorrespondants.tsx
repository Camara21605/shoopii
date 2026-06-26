/* ================================================================
 * FICHIER : correspondants/sections/ToolbarCorrespondants.tsx
 *
 * Barre d'outils : recherche, filtres rapides, tri, compteur,
 * bascule vue grille/liste.
 * ================================================================ */

import React from 'react';
import styles from '../styles/Correspondants.module.css';
import type { FiltreRapide, VueMode, TriOption } from '../data/types';

interface Props {
  recherche:   string;
  filtre:      FiltreRapide;
  tri:         TriOption;
  vue:         VueMode;
  count:       number;
  onRecherche: (v: string) => void;
  onFiltre:    (f: FiltreRapide) => void;
  onTri:       (t: TriOption) => void;
  onVue:       (v: VueMode) => void;
}

const FILTRES: { id: FiltreRapide; icon: string; label: string }[] = [
  { id: 'all',       icon: 'fa-border-all',     label: 'Tous'          },
  { id: 'available', icon: 'fa-circle',         label: 'En ligne'      },
  { id: 'followed',  icon: 'fa-check',          label: 'Mes abonnements' },
  { id: 'regional',  icon: 'fa-map-marked-alt', label: 'Régionaux'     },
  { id: 'zonal',     icon: 'fa-map',            label: 'Zonaux'        },
  { id: 'national',  icon: 'fa-globe-africa',   label: 'Nationaux'     },
];

export default function ToolbarCorrespondants({
  recherche, filtre, tri, vue, count,
  onRecherche, onFiltre, onTri, onVue,
}: Props) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarIn}>
        {/* Recherche */}
        <div className={styles.srchWrap}>
          <i className="fas fa-search" />
          <input
            type="text"
            placeholder="Rechercher un correspondant, une zone…"
            value={recherche}
            onChange={e => onRecherche(e.target.value)}
          />
        </div>

        {/* Filtres rapides */}
        {FILTRES.map((f, i) => (
          <React.Fragment key={f.id}>
            {i === 3 && <div className={styles.fsep} />}
            <button
              className={`${styles.fbtn} ${filtre === f.id ? styles.fbtnOn : ''}`}
              onClick={() => onFiltre(f.id)}
            >
              <i className={`fas ${f.icon}`}
                 style={f.id === 'available' ? { color: '#10B981', fontSize: 8 } : undefined} />
              {f.label}
            </button>
          </React.Fragment>
        ))}

        {/* Tri */}
        <select className={styles.srt} value={tri} onChange={e => onTri(e.target.value as TriOption)}>
          <option value="pertinence">Pertinence</option>
          <option value="note">Mieux notés</option>
          <option value="missions">Plus de missions</option>
          <option value="nom">Nom (A-Z)</option>
        </select>

        {/* Compteur */}
        <span className={styles.cntPill}>{count} correspondant{count > 1 ? 's' : ''}</span>

        {/* Vue */}
        <div className={styles.vwBtns}>
          <button className={`${styles.vbtn} ${vue === 'grid' ? styles.vbtnOn : ''}`} onClick={() => onVue('grid')}>
            <i className="fas fa-th-large" />
          </button>
          <button className={`${styles.vbtn} ${vue === 'list' ? styles.vbtnOn : ''}`} onClick={() => onVue('list')}>
            <i className="fas fa-list" />
          </button>
        </div>
      </div>
    </div>
  );
}