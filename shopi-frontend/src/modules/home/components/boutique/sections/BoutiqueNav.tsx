/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/sections/BoutiqueNav.tsx
 *
 * MODIFICATION : Ajout de l'onglet "Correspondants"
 *   entre Livreurs et Avis.
 * ============================================================
 */
import React from 'react';
import styles from '../styles/BoutiqueNav.module.css';

export type OngletType =
  | 'produits' | 'promos' | 'livreurs'
  | 'correspondants'                     // ← AJOUTÉ
  | 'avis' | 'apropos';

interface Props {
  onglet:         OngletType;
  onChangeOnglet: (o: OngletType) => void;
  counts: {
    produits:        number;
    promos:          number;
    livreurs:        number;
    correspondants:  number;              // ← AJOUTÉ
    avis:            number;
  };
}

const ONGLETS: {
  key:       OngletType;
  icon:      string;
  label:     string;
  countKey?: keyof Props['counts'];
}[] = [
  { key:'produits',       icon:'fa-boxes-stacked',    label:'Produits',        countKey:'produits'       },
  { key:'promos',         icon:'fa-tags',             label:'Promotions',      countKey:'promos'         },
  { key:'livreurs',       icon:'fa-motorcycle',       label:'Livreurs',        countKey:'livreurs'       },
  { key:'correspondants', icon:'fa-map-location-dot', label:'Correspondants',  countKey:'correspondants' }, // ← AJOUTÉ
  { key:'avis',           icon:'fa-star',             label:'Avis',            countKey:'avis'           },
  { key:'apropos',        icon:'fa-circle-info',      label:'À propos'                                   },
];

export default function BoutiqueNav({ onglet, onChangeOnglet, counts }: Props) {
  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        {ONGLETS.map(o => (
          <button
            key={o.key}
            className={`${styles.btn} ${onglet === o.key ? styles.btnActive : ''}`}
            onClick={() => onChangeOnglet(o.key)}
          >
            <i className={`fas ${o.icon}`} />
            {o.label}
            {o.countKey && (
              <span className={styles.cnt}>{counts[o.countKey]}</span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}