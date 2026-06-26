/* ================================================================
 * FICHIER : src/modules/home/components/profil-livreur/components/TabInfo.tsx
 *
 * Onglet "Infos" : à propos, infos pratiques, disponibilité hebdo.
 * ================================================================ */

import React from 'react';
import styles from '../styles/ProfilLivreur.module.css';
import type { LivreurProfile } from '../types';

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export default function TabInfo({ profile }: { profile: LivreurProfile }) {
  const today = JOURS[(new Date().getDay() + 6) % 7]; // getDay: 0=dim → ajuste

  return (
    <>
      {/* À propos */}
      <div className={styles.card}>
        <div className={styles.ch}><div className={styles.ct}><i className="fas fa-user" /> À propos</div></div>
        <div className={styles.cb}>
          <div className={styles.aboutText}>
            {profile.bio || 'Aucune description disponible.'}
          </div>
          {profile.langues.length > 0 && (
            <div className={styles.aboutTags}>
              {profile.langues.map(l => (
                <span key={l} className={styles.atag}><i className="fas fa-language" /> {l}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Infos pratiques */}
      <div className={styles.card}>
        <div className={styles.ch}><div className={styles.ct}><i className="fas fa-circle-info" /> Informations pratiques</div></div>
        <div className={styles.infoGrid}>
          <div className={styles.ir}>
            <div className={styles.irLbl}><i className="fas fa-map-pin" /> Zone principale</div>
            <div className={styles.irVal}>{profile.zone}</div>
          </div>
          {profile.telephone && (
            <div className={styles.ir}>
              <div className={styles.irLbl}><i className="fas fa-phone" /> Contact direct</div>
              <div className={styles.irVal}>{profile.telephone}</div>
            </div>
          )}
          {profile.langues.length > 0 && (
            <div className={styles.ir}>
              <div className={styles.irLbl}><i className="fas fa-language" /> Langues parlées</div>
              <div className={styles.irVal}>{profile.langues.join(' · ')}</div>
            </div>
          )}
          <div className={styles.ir} style={{ borderBottom: 'none' }}>
            <div className={styles.irLbl}><i className="fas fa-shield-halved" /> Assurance</div>
            <div className={styles.irVal}>{profile.assurance ? 'Couvert ✓' : 'Non renseignée'}</div>
          </div>
        </div>
      </div>

      {/* Disponibilité hebdomadaire */}
      {Object.keys(profile.horaires).length > 0 && (
        <div className={styles.card}>
          <div className={styles.ch}><div className={styles.ct}><i className="fas fa-calendar-week" /> Disponibilité hebdomadaire</div></div>
          <div className={styles.cb}>
            <div className={styles.schedule}>
              {JOURS.map(jour => {
                const horaire = profile.horaires[jour];
                const ferme   = !horaire || horaire === 'Fermé';
                const isToday = jour === today;
                return (
                  <div key={jour} className={`${styles.schRow} ${isToday ? styles.schToday : ''}`}>
                    <span className={styles.schDay}>
                      {jour.charAt(0).toUpperCase() + jour.slice(1)}
                      {isToday && <span style={{ fontSize: 10, color: 'var(--em)' }}> (auj.)</span>}
                    </span>
                    <span className={styles.schHours}>{ferme ? '—' : horaire}</span>
                    <span className={`${styles.schStatus} ${ferme ? styles.ssClosed : styles.ssOpen}`}>
                      {ferme ? 'Fermé' : 'Ouvert'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}