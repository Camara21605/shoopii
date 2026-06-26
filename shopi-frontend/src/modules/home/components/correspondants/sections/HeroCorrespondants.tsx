/* ================================================================
 * FICHIER : correspondants/sections/HeroCorrespondants.tsx
 *
 * Bannière d'en-tête : titre, sous-titre, 4 KPI + 2 cartes mises
 * en avant (correspondants suggérés).
 * ================================================================ */

import React from 'react';
import styles from '../styles/Correspondants.module.css';
import type { Correspondant } from '../data/types';

interface Props {
  /* Stats globales (calculées depuis la liste) */
  total:     number;
  noteMoy:   string;
  missions:  string;
  communes:  number;
  /* 2 correspondants à mettre en avant */
  vedettes:  Correspondant[];
  onToggle:  (id: string) => void;
}

const AVA_BG: Record<string, string> = {
  regional: 'linear-gradient(135deg,#3B0764,#7C3AED)',
  zonal:    'linear-gradient(135deg,#1e3a8a,#1549B8)',
  national: 'linear-gradient(135deg,#78350F,#B45309)',
};
const TYPE_LABEL: Record<string, string> = {
  regional: '🏠 Régional', zonal: '🗺️ Zonal', national: '🌍 National',
};

export default function HeroCorrespondants({ total, noteMoy, missions, communes, vedettes, onToggle }: Props) {
  return (
    <div className={styles.hero}>
      <div className={styles.heroBg} />
      <div className={styles.heroDots} />
      <div className={styles.heroCircle1} />
      <div className={styles.heroCircle2} />

      <div className={styles.heroIn}>
        {/* Texte + KPI */}
        <div>
          <div className={styles.heroSup}>
            <i className="fas fa-handshake" /> Réseau Shopi · Guinée &amp; Diaspora
          </div>
          <div className={styles.heroTitle}>
            Vos <em>correspondants</em><br />de confiance partout
          </div>
          <div className={styles.heroSub}>
            Des relais locaux vérifiés qui facilitent vos échanges commerciaux entre la Guinée
            et la diaspora. Réceptionnez, expédiez et faites transiter vos colis en toute sécurité.
          </div>
          <div className={styles.heroKpis}>
            <div className={styles.hk}><div className={styles.hkVal}>{total}</div><div className={styles.hkLbl}>Correspondants actifs</div></div>
            <div className={styles.hk}><div className={styles.hkVal}>{noteMoy}★</div><div className={styles.hkLbl}>Note moyenne</div></div>
            <div className={styles.hk}><div className={styles.hkVal}>{missions}</div><div className={styles.hkLbl}>Missions au total</div></div>
            <div className={styles.hk}><div className={styles.hkVal}>{communes}</div><div className={styles.hkLbl}>Communes couvertes</div></div>
          </div>
        </div>

        {/* Cartes vedettes */}
        <div className={styles.heroRight}>
          {vedettes.map(v => (
            <div key={v.id} className={styles.hcard}>
              <div className={styles.hcardAva} style={{ background: AVA_BG[v.type] }}>
                {v.initiales}
                {v.enLigne && <div className={styles.hcardDot} />}
              </div>
              <div className={styles.hcardNm}>{v.nom}</div>
              <div className={styles.hcardType}>{TYPE_LABEL[v.type]} · {v.zone.split(',')[0]}</div>
              <button className={styles.hcardBtn} onClick={() => onToggle(v.id)}>
                {v.suivi ? '✓ Abonné' : '+ Suivre'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}