/* ================================================================
 * FICHIER : profil-client/components/ProfilTabsClient.tsx
 *
 * Barre d'onglets (Commandes / Abonnements / Favoris / Avis / Activité).
 * ================================================================ */

import React from 'react';
import styles from '../styles/ProfilClient.module.css';
import type { ClientTab } from '../types';

const TABS: { id: ClientTab; icon: string; label: string }[] = [
  { id: 'orders',    icon: 'fa-box',              label: 'Commandes'   },
  { id: 'subs',      icon: 'fa-bell',             label: 'Abonnements' },
  { id: 'favs',      icon: 'fa-heart',            label: 'Favoris'     },
  { id: 'reviews',   icon: 'fa-star',             label: 'Avis'        },
  { id: 'activity',  icon: 'fa-clock-rotate-left', label: 'Activité'   },
  { id: 'addresses', icon: 'fa-location-dot',     label: 'Adresses'   },
];

interface Props { active: ClientTab; onChange: (t: ClientTab) => void; }

export default function ProfilTabsClient({ active, onChange }: Props) {
  return (
    <div className={styles.tabs}>
      {TABS.map(t => (
        <button key={t.id}
          className={`${styles.tab} ${active === t.id ? styles.tabOn : ''}`}
          onClick={() => onChange(t.id)}>
          <i className={`fas ${t.icon}`} /> {t.label}
        </button>
      ))}
    </div>
  );
}