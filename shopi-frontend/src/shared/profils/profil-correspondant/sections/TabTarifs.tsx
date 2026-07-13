/* ================================================================
 * FICHIER : profil-correspondant/sections/TabTarifs.tsx
 * ================================================================ */

import React from 'react';
import styles from '../styles/ProfilCorrespondant.module.css';
import type { TarifRow } from '../data/types';

export default function TabTarifs({ tarifs }: { tarifs: TarifRow[] }) {
  return (
    <div className={styles.card}>
      <div className={styles.ch}><div className={styles.ct}><i className="fas fa-tag" /> Grille tarifaire</div></div>
      {tarifs.length === 0 ? (
        <div className={styles.cb}>
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted, #6B7280)' }}>
            <i className="fas fa-file-invoice-dollar" style={{ fontSize: 28, marginBottom: 10, display: 'block', opacity: 0.4 }} />
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Tarifs non renseignés</div>
            <div style={{ fontSize: 12 }}>Le correspondant n'a pas encore publié sa grille tarifaire.<br />Contactez-le directement pour obtenir un devis.</div>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.tarifWarn}>
            <strong>Abonnés Shopi</strong> — Réduction de 15% sur tous les services.
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
        </>
      )}
    </div>
  );
}
