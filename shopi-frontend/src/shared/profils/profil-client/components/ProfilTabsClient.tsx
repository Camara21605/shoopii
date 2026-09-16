/* ================================================================
 * FICHIER : profil-client/components/ProfilTabsClient.tsx
 *
 * Barre d'onglets (Commandes / Abonnements / Favoris / Avis / Activité).
 * ================================================================ */

import React from 'react';
import styles from '../styles/ProfilClient.module.css';
import type { ClientTab } from '../types';
import { useSidebarBadges } from '../hooks/useSidebarBadges';

const TABS: { id: ClientTab; icon: string; label: string }[] = [
  { id: 'orders',    icon: 'fa-box',              label: 'Commandes'   },
  { id: 'returns',   icon: 'fa-rotate-left',      label: 'Retours'     },
  { id: 'subs',      icon: 'fa-bell',             label: 'Abonnements' },
  { id: 'favs',      icon: 'fa-heart',            label: 'Favoris'     },
  { id: 'wishlist',  icon: 'fa-bookmark',         label: 'Souhaits'    },
  { id: 'reviews',   icon: 'fa-star',             label: 'Avis'        },
  { id: 'activity',  icon: 'fa-clock-rotate-left', label: 'Activité'   },
];

interface Props { active: ClientTab; onChange: (t: ClientTab) => void; }

export default function ProfilTabsClient({ active, onChange }: Props) {
  const { getBadge, clearBadge } = useSidebarBadges();

  const handleClick = (id: ClientTab) => {
    clearBadge(id);
    onChange(id);
  };

  return (
    <div className={styles.tabs}>
      {TABS.map(t => {
        const count = getBadge(t.id);
        return (
          <button key={t.id}
            className={`${styles.tab} ${active === t.id ? styles.tabOn : ''}`}
            onClick={() => handleClick(t.id)}>
            <i className={`fas ${t.icon}`} /> {t.label}
            {count > 0 && (
              <span className={styles.tabBadge}>{count > 99 ? '99+' : count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}