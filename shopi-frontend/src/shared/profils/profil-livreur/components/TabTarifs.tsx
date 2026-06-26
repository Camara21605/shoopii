/* ================================================================
 * FICHIER : src/modules/home/components/profil-livreur/components/TabTarifs.tsx
 *
 * Onglet "Tarifs" : grille tarifaire du livreur.
 * ================================================================ */

import React from 'react';
import styles from '../styles/ProfilLivreur.module.css';
import type { LivreurProfile } from '../types';

const fmt = (n: number) => `${n.toLocaleString('fr-FR')} GNF`;

export default function TabTarifs({ profile }: { profile: LivreurProfile }) {
  const { tarifs } = profile;
  const lignes = [
    { icon: 'fa-flag',          label: 'Tarif de base',        value: fmt(tarifs.base) },
    { icon: 'fa-route',         label: 'Par kilomètre',        value: fmt(tarifs.parKm) },
    { icon: 'fa-weight-hanging',label: 'Supplément colis lourd', value: fmt(tarifs.supplementLourd) },
    { icon: 'fa-moon',          label: 'Majoration nocturne',  value: `+${tarifs.majorationNocturne}%` },
  ];

  return (
    <div className={styles.card}>
      <div className={styles.ch}><div className={styles.ct}><i className="fas fa-tag" /> Grille tarifaire</div></div>
      <div className={styles.infoGrid}>
        {lignes.map(l => (
          <div key={l.label} className={styles.tarifRow}>
            <div className={styles.trSvc}><i className={`fas ${l.icon}`} /> {l.label}</div>
            <div className={styles.trPrice}>{l.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}