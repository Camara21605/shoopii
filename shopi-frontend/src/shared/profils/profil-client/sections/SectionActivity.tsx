/* ================================================================
 * FICHIER : profil-client/sections/SectionActivity.tsx
 *
 * Onglet "Activité" : journal groupé par jour, icônes colorées.
 * Données exclusivement depuis /client/profil (champ activityLog).
 * ================================================================ */

import React from 'react';
import styles from '../styles/ProfilClient.module.css';
import type { ActiviteItem, ActiviteJour } from '../data/profilClientData';

/* Mapping couleur → classe CSS de l'icône */
const COULEUR_CLASS: Record<ActiviteItem['couleur'], string> = {
  bl: styles.aBl, gr: styles.aGr, ye: styles.aYe,
  pu: styles.aPu, re: styles.aRe, tl: styles.aTl,
};

interface Props {
  onToast: (m: string) => void;
  jours:   ActiviteJour[];
}

export default function SectionActivity({ onToast, jours }: Props) {
  if (jours.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.ct}><i className="fas fa-clock-rotate-left" /> Journal d'activité</div>
        </div>
        <div className={styles.cb}>
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--t3)' }}>
            <i className="fas fa-clock-rotate-left" style={{ fontSize: 28, display: 'block', marginBottom: 10, opacity: 0.3 }} />
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Aucune activité récente</div>
            <div style={{ fontSize: 12 }}>Vos actions sur Shopi apparaîtront ici.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.ch}>
        <div className={styles.ct}><i className="fas fa-clock-rotate-left" /> Journal d'activité</div>
        <button className={styles.chLink} onClick={() => onToast("📤 Export de l'activité")}>Exporter</button>
      </div>

      {jours.map(jour => (
        <div key={jour.jour}>
          <div className={styles.actDay}>{jour.jour}</div>
          {jour.items.map(item => (
            <div key={item.id} className={styles.actItem}>
              <div className={`${styles.actItemIco} ${COULEUR_CLASS[item.couleur]}`}>
                <i className={`fas ${item.icone}`} />
              </div>
              <div className={styles.actItemTxt}>
                <strong>{item.titre}</strong> — {item.detail}
                <div className={styles.actItemTime}>{item.heure}</div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}