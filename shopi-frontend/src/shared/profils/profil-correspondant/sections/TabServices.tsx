/* ================================================================
 * FICHIER : profil-correspondant/sections/TabServices.tsx
 *
 * Onglet Services : grille des prestations (emoji, nom, desc, prix).
 * ================================================================ */

import React from 'react';
import styles from '../styles/ProfilCorrespondant.module.css';
import type { Service } from '../data/types';

export default function TabServices({ services }: { services: Service[] }) {
  return (
    <div className={styles.card}>
      <div className={styles.ch}><div className={styles.ct}><i className="fas fa-box-open" /> Services proposés</div></div>
      <div className={styles.cb}>
        <div className={styles.servicesGrid}>
          {services.map(s => (
            <div key={s.nom} className={styles.svc}>
              <div className={styles.svcIco}>{s.emoji}</div>
              <div className={styles.svcNm}>{s.nom}</div>
              <div className={styles.svcDesc}>{s.desc}</div>
              <div className={styles.svcPrice}>{s.prix}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}