/* ================================================================
 * FICHIER : profil-correspondant/components/ProfilTabs.tsx
 *
 * Barre des 6 onglets (Infos, Services, Zones, Tarifs, Avis, Galerie).
 * ================================================================ */

import React from 'react';
import styles from '../styles/ProfilCorrespondant.module.css';
import type { ProfilTab } from '../data/types';

interface Props {
  actif:   ProfilTab;
  nbAvis:  number;
  onTab:   (t: ProfilTab) => void;
}

const TABS: { id: ProfilTab; icon: string; label: string }[] = [
  { id: 'info',     icon: 'fa-user',      label: 'Infos'    },
  { id: 'services', icon: 'fa-box-open',  label: 'Services' },
  { id: 'zones',    icon: 'fa-map',       label: 'Zones'    },
  { id: 'tarifs',   icon: 'fa-tag',       label: 'Tarifs'   },
  { id: 'avis',     icon: 'fa-star',      label: 'Avis'     },
  { id: 'galerie',  icon: 'fa-images',    label: 'Galerie'  },
];

export default function ProfilTabs({ actif, nbAvis, onTab }: Props) {
  return (
    <div className={styles.tabs}>
      {TABS.map(t => (
        <button
          key={t.id}
          className={`${styles.tab} ${actif === t.id ? styles.tabOn : ''}`}
          onClick={() => onTab(t.id)}
        >
          <i className={`fas ${t.icon}`} />
          {t.label}{t.id === 'avis' && nbAvis > 0 ? ` (${nbAvis})` : ''}
        </button>
      ))}
    </div>
  );
}