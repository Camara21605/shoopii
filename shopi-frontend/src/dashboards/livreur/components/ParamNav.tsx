// src/dashboards/livreur/components/ParamNav.tsx
// Navigation secondaire gauche de la page Paramètres
// 10 items groupés : Identité / Activité / Finances / Compte

import React from 'react';
import { useTranslation } from 'react-i18next';
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

function buildGroups(t: (key: string) => string): { title: string; items: NavItem[] }[] {
  return [
    {
      title: t('livreurParametres.nav.groups.identite'),
      items: [
        { id:'profil', icon:'fa-user',         label: t('livreurParametres.nav.items.profil')        },
        { id:'docs',   icon:'fa-file-shield',  label: t('livreurParametres.nav.items.docs'), warn:'a' },
      ],
    },
    {
      title: t('livreurParametres.nav.groups.activite'),
      items: [
        { id:'zone',     icon:'fa-map-location-dot', label: t('livreurParametres.nav.items.zone')     },
        { id:'vehicule', icon:'fa-motorcycle',         label: t('livreurParametres.nav.items.vehicule') },
      ],
    },
    {
      title: t('livreurParametres.nav.groups.finances'),
      items: [
        { id:'paiement', icon:'fa-wallet', label: t('livreurParametres.nav.items.paiement') },
      ],
    },
    {
      title: t('livreurParametres.nav.groups.compte'),
      items: [
        { id:'securite',        icon:'fa-lock',               label: t('livreurParametres.nav.items.securite')        },
        { id:'notifs',          icon:'fa-bell',               label: t('livreurParametres.nav.items.notifs')          },
        { id:'confidentialite', icon:'fa-shield-halved',      label: t('livreurParametres.nav.items.confidentialite') },
        { id:'langue',          icon:'fa-language',           label: t('livreurParametres.nav.items.langue')          },
        { id:'danger',          icon:'fa-triangle-exclamation', label: t('livreurParametres.nav.items.danger'), warn:'r' },
      ],
    },
  ];
}

export default function ParamNav({ active, onSelect, onBack }: Props) {
  const { t } = useTranslation();
  const GROUPS = buildGroups(t);
  return (
    <nav className={styles.nav}>
      {/* Retour dashboard */}
      <div className={styles.back} onClick={onBack}>
        <i className="fas fa-arrow-left" />
        <span>{t('livreurParametres.nav.tableauDeBord')}</span>
      </div>

      {GROUPS.map(grp => (
        <div key={grp.title} className={styles.group}>
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