/* ================================================================
 * FICHIER : src/modules/home/components/profil-livreur/components/TabPlaceholder.tsx
 *
 * Onglets "Avis" et "Historique" : à brancher quand les endpoints
 * backend correspondants existeront (GET /client/livreurs/:id/avis,
 * /client/livreurs/:id/historique). Pour l'instant, état vide propre.
 * ================================================================ */

import React from 'react';
import styles from '../styles/ProfilLivreur.module.css';

interface Props {
  icon:  string;
  title: string;
  text:  string;
}

export default function TabPlaceholder({ icon, title, text }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.ch}><div className={styles.ct}><i className={`fas ${icon}`} /> {title}</div></div>
      <div className={styles.cb} style={{ textAlign: 'center', color: 'var(--t3)', padding: '32px 18px' }}>
        <i className={`fas ${icon}`} style={{ fontSize: 26, color: 'var(--t4)', display: 'block', marginBottom: 10 }} />
        {text}
      </div>
    </div>
  );
}