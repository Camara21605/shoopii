/* ================================================================
 * FICHIER : profil-correspondant/sections/TabZones.tsx
 *
 * Onglet Zones : zones de couverture + réseau de correspondants
 * partenaires (pays).
 * ================================================================ */

import React from 'react';
import styles from '../styles/ProfilCorrespondant.module.css';
import type { ZoneCard, PaysPartenaire } from '../data/types';

const BADGE_CLASS: Record<string, string> = {
  main: styles.zbMain, sec: styles.zbSec, partner: styles.zbMain,
};

interface Props {
  zones:           ZoneCard[];
  paysPartenaires: PaysPartenaire[];
  onToast:         (m: string) => void;
}

export default function TabZones({ zones, paysPartenaires, onToast }: Props) {
  return (
    <>
      {/* Zones de couverture */}
      <div className={styles.card}>
        <div className={styles.ch}><div className={styles.ct}><i className="fas fa-map" /> Zones de couverture</div></div>
        <div className={styles.cb}>
          <div className={styles.zonesGrid}>
            {zones.map(z => (
              <div key={z.nom} className={`${styles.zoneCard} ${z.badgeType === 'main' ? styles.zoneCardPrimary : ''}`}>
                <div className={styles.zcName}>{z.nom}</div>
                <div className={styles.zcDetail}>{z.detail}</div>
                <span className={`${styles.zcBadge} ${BADGE_CLASS[z.badgeType]}`}>{z.badge}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Réseau partenaires */}
      <div className={styles.card}>
        <div className={styles.ch}><div className={styles.ct}><i className="fas fa-globe" /> Réseau de correspondants partenaires</div></div>
        <div className={styles.cb}>
          <div className={styles.intlGrid}>
            {paysPartenaires.map(p => (
              <div key={p.nom} className={styles.countryCard} onClick={() => onToast(`🌍 ${p.nom} — ${p.villes}`)}>
                <div className={styles.ccFlag}>{p.flag}</div>
                <div>
                  <div className={styles.ccNm}>{p.nom}</div>
                  <div className={styles.ccDt}>{p.villes}</div>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.intlNote}>
            <i className="fas fa-circle-info" />
            <span>Ces correspondants partenaires facilitent l'envoi et la réception de colis depuis ces pays vers le dépôt Kaloum. Les délais et tarifs varient selon la destination — contactez le correspondant pour un devis personnalisé.</span>
          </div>
        </div>
      </div>
    </>
  );
}