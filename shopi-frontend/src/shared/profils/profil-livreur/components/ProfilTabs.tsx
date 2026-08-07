/* ================================================================
 * FICHIER : src/modules/home/components/profil-livreur/components/ProfilTabs.tsx
 *
 * Barre d'onglets de navigation du profil.
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import styles from '../styles/ProfilLivreur.module.css';
import type { ProfilTab } from '../types';

interface Props {
  active:    ProfilTab;
  onChange:  (t: ProfilTab) => void;
  avisCount: number;
}

export default function ProfilTabs({ active, onChange, avisCount }: Props) {
  const { t } = useTranslation();
  const TABS: { id: ProfilTab; icon: string; label: string }[] = [
    { id: 'info',          icon: 'fa-user',               label: t('profilLivreur.tabs.info')         },
    { id: 'vehicule',      icon: 'fa-motorcycle',         label: t('profilLivreur.tabs.vehicule')      },
    { id: 'zones',         icon: 'fa-map',                label: t('profilLivreur.tabs.zones')         },
    { id: 'localisation',  icon: 'fa-location-dot',       label: t('profilLivreur.tabs.localisation')  },
    { id: 'tarifs',        icon: 'fa-tag',                label: t('profilLivreur.tabs.tarifs')        },
    { id: 'avis',          icon: 'fa-star',               label: t('profilLivreur.tabs.avis')          },
    { id: 'historique',    icon: 'fa-clock-rotate-left',  label: t('profilLivreur.tabs.historique')    },
  ];
  return (
    <div className={styles.tabs}>
      {TABS.map(tabItem => (
        <button
          key={tabItem.id}
          className={`${styles.tab} ${active === tabItem.id ? styles.tabOn : ''}`}
          onClick={() => onChange(tabItem.id)}
        >
          <i className={`fas ${tabItem.icon}`} />
          {tabItem.label}{tabItem.id === 'avis' && avisCount > 0 ? ` (${avisCount})` : ''}
        </button>
      ))}
    </div>
  );
}