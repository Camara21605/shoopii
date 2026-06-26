// src/dashboards/livreur/components/ParamNav.tsx
// Navigation secondaire gauche de la page Paramètres
// 10 items groupés : Identité / Activité / Finances / Compte

import React from 'react';
import type { ParamSectionId } from '../data/parametresData';
import styles from '../styles/ParamNav.module.css';

interface Props {
  active:   ParamSectionId;
  onSelect: (s: ParamSectionId) => void;
  onBack:   () => void;
}

type NavItem = {
  id:    ParamSectionId;
  icon:  string;
  label: string;
  warn?: 'r' | 'a';       // rouge = danger, amber = docs
};

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Identité',
    items: [
      { id:'profil', icon:'fa-user',         label:'Profil personnel'        },
      { id:'docs',   icon:'fa-file-shield',  label:'Documents', warn:'a'     },
    ],
  },
  {
    title: 'Activité',
    items: [
      { id:'zone',     icon:'fa-map-location-dot', label:'Zones & Horaires'  },
      { id:'vitesses', icon:'fa-gauge-high',        label:'Vitesses & Tarifs' },
      { id:'vehicule', icon:'fa-motorcycle',         label:'Véhicule'          },
    ],
  },
  {
    title: 'Finances',
    items: [
      { id:'paiement', icon:'fa-wallet', label:'Paiement' },
    ],
  },
  {
    title: 'Compte',
    items: [
      { id:'securite',        icon:'fa-lock',               label:'Sécurité'           },
      { id:'notifs',          icon:'fa-bell',               label:'Notifications'       },
      { id:'confidentialite', icon:'fa-shield-halved',      label:'Confidentialité'     },
      { id:'danger',          icon:'fa-triangle-exclamation', label:'Zone sensible', warn:'r' },
    ],
  },
];

export default function ParamNav({ active, onSelect, onBack }: Props) {
  return (
    <nav className={styles.nav}>
      {/* Retour dashboard */}
      <div className={styles.back} onClick={onBack}>
        <i className="fas fa-arrow-left" />
        <span>Tableau de bord</span>
      </div>

      {GROUPS.map(grp => (
        <div key={grp.title}>
          <div className={styles.sect}>{grp.title}</div>
          {grp.items.map(item => (
            <div
              key={item.id}
              className={`${styles.item} ${active === item.id ? styles.on : ''} ${item.warn === 'r' ? styles.dangerItem : ''}`}
              onClick={() => onSelect(item.id)}
            >
              <i className={`fas ${item.icon} ${styles.icon} ${active === item.id ? styles.iconOn : ''} ${item.warn === 'r' ? styles.iconDanger : ''}`} />
              <span>{item.label}</span>
              {item.warn && (
                <div className={`${styles.dot} ${item.warn === 'r' ? styles.dotR : styles.dotA}`} />
              )}
            </div>
          ))}
        </div>
      ))}
    </nav>
  );
}