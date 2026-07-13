/* ================================================================
 * FICHIER : profil-correspondant/sections/TabServices.tsx
 * ================================================================ */

import React from 'react';
import styles from '../styles/ProfilCorrespondant.module.css';
import type { Service } from '../data/types';

export default function TabServices({ services }: { services: Service[] }) {
  return (
    <div className={styles.card}>
      <div className={styles.ch}><div className={styles.ct}><i className="fas fa-box-open" /> Services proposés</div></div>
      <div className={styles.cb}>
        {services.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted, #6B7280)' }}>
            <i className="fas fa-clock" style={{ fontSize: 28, marginBottom: 10, display: 'block', opacity: 0.4 }} />
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Services en cours de renseignement</div>
            <div style={{ fontSize: 12 }}>Le correspondant n'a pas encore renseigné ses services.</div>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
