/* ================================================================
 * FICHIER : profil-client/sections/SectionActivity.tsx
 *
 * Onglet "Activité" : journal groupé par jour, icônes colorées.
 *
 * DONNÉES : reçues en prop `jours` (par défaut = mock).
 *   → La page passe les VRAIES activités venant de /client/profil
 *     (champ activityLog). Si vide, fallback mock automatique.
 * ================================================================ */

import React from 'react';
import styles from '../styles/ProfilClient.module.css';
import { ACTIVITES as MOCK_ACTIVITES } from '../data/profilClientData';
import type { ActiviteItem, ActiviteJour } from '../data/profilClientData';

/* Mapping couleur → classe CSS de l'icône */
const COULEUR_CLASS: Record<ActiviteItem['couleur'], string> = {
  bl: styles.aBl, gr: styles.aGr, ye: styles.aYe,
  pu: styles.aPu, re: styles.aRe, tl: styles.aTl,
};

interface Props {
  onToast: (m: string) => void;
  jours?:  ActiviteJour[];   // dynamique (fallback mock)
}

export default function SectionActivity({ onToast, jours = MOCK_ACTIVITES }: Props) {
  /* Si aucune activité réelle → on garde le mock pour ne pas afficher du vide */
  const data = jours.length > 0 ? jours : MOCK_ACTIVITES;

  return (
    <div className={styles.card}>
      <div className={styles.ch}>
        <div className={styles.ct}><i className="fas fa-clock-rotate-left" /> Journal d'activité</div>
        <button className={styles.chLink} onClick={() => onToast("📤 Export de l'activité")}>Exporter</button>
      </div>

      {data.map(jour => (
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