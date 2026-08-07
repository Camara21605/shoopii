/* ================================================================
 * FICHIER : profil-correspondant/components/ProfilTabs.tsx
 *
 * Barre des 6 onglets (Infos, Services, Zones, Tarifs, Avis, Galerie).
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import styles from '../styles/ProfilCorrespondant.module.css';
import type { ProfilTab } from '../data/types';

interface Props {
  actif:   ProfilTab;
  nbAvis:  number;
  onTab:   (t: ProfilTab) => void;
}

export default function ProfilTabs({ actif, nbAvis, onTab }: Props) {
  const { t } = useTranslation();
  const TABS: { id: ProfilTab; icon: string; label: string }[] = [
    { id: 'info',     icon: 'fa-user',      label: t('profilCorrespondant.tabs.info')     },
    { id: 'services', icon: 'fa-box-open',  label: t('profilCorrespondant.tabs.services') },
    { id: 'zones',    icon: 'fa-map',       label: t('profilCorrespondant.tabs.zones')    },
    { id: 'tarifs',   icon: 'fa-tag',       label: t('profilCorrespondant.tabs.tarifs')   },
    { id: 'avis',     icon: 'fa-star',      label: t('profilCorrespondant.tabs.avis')     },
    { id: 'galerie',  icon: 'fa-images',    label: t('profilCorrespondant.tabs.galerie')  },
  ];
  return (
    <div className={styles.tabs}>
      {TABS.map(tabItem => (
        <button
          key={tabItem.id}
          className={`${styles.tab} ${actif === tabItem.id ? styles.tabOn : ''}`}
          onClick={() => onTab(tabItem.id)}
        >
          <i className={`fas ${tabItem.icon}`} />
          {tabItem.label}{tabItem.id === 'avis' && nbAvis > 0 ? ` (${nbAvis})` : ''}
        </button>
      ))}
    </div>
  );
}