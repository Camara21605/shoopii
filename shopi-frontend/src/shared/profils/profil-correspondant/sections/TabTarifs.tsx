/* ================================================================
 * FICHIER : profil-correspondant/sections/TabTarifs.tsx
 *
 * Onglet Tarifs : grille tarifaire complète + note abonnés Shopi.
 * ================================================================ */

import React from 'react';
import styles from '../styles/ProfilCorrespondant.module.css';
import type { TarifRow } from '../data/types';

export default function TabTarifs({ tarifs }: { tarifs: TarifRow[] }) {
  return (
    <div className={styles.card}>
      <div className={styles.ch}><div className={styles.ct}><i className="fas fa-tag" /> Grille tarifaire complète</div></div>

      <div className={styles.tarifWarn}>
        <strong>Abonnés Shopi</strong> — Réduction de 15% sur tous les services. Réception
        de colis standard incluse gratuitement dans votre abonnement Shopi Premium.
      </div>

      <div className={styles.tarifGrid}>
        {tarifs.map(t => (
          <div key={t.service} className={styles.tarifRow}>
            <div className={styles.tarifSvc}>
              <i className="fas fa-circle-check" />
              <div>
                {t.service}
                <div className={styles.tarifNote}>{t.sub}</div>
              </div>
            </div>
            <div className={styles.tarifRight}>
              <div className={styles.tarifPrice}>{t.prix}</div>
              <div className={styles.tarifNote}>{t.note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}