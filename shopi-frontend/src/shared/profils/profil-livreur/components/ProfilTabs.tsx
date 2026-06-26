/* ================================================================
 * FICHIER : src/modules/home/components/profil-livreur/components/ProfilTabs.tsx
 *
 * Barre d'onglets de navigation du profil.
 * ================================================================ */

import React from 'react';
import styles from '../styles/ProfilLivreur.module.css';
import type { ProfilTab } from '../types';

interface Props {
  active:    ProfilTab;
  onChange:  (t: ProfilTab) => void;
  avisCount: number;
}

const TABS: { id: ProfilTab; icon: string; label: string }[] = [
  { id: 'info',        icon: 'fa-user',               label: 'Infos'      },
  { id: 'vehicule',    icon: 'fa-motorcycle',         label: 'Véhicule'   },
  { id: 'zones',       icon: 'fa-map',                label: 'Zones'      },
  { id: 'tarifs',      icon: 'fa-tag',                label: 'Tarifs'     },
  { id: 'avis',        icon: 'fa-star',               label: 'Avis'       },
  { id: 'historique',  icon: 'fa-clock-rotate-left',  label: 'Historique' },
];

export default function ProfilTabs({ active, onChange, avisCount }: Props) {
  return (
    <div className={styles.tabs}>
      {TABS.map(t => (
        <button
          key={t.id}
          className={`${styles.tab} ${active === t.id ? styles.tabOn : ''}`}
          onClick={() => onChange(t.id)}
        >
          <i className={`fas ${t.icon}`} />
          {t.label}{t.id === 'avis' && avisCount > 0 ? ` (${avisCount})` : ''}
        </button>
      ))}
    </div>
  );
}