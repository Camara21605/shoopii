/* ================================================================
 * FICHIER : profil-correspondant/sections/TabInfo.tsx
 *
 * Onglet Infos : À propos (paragraphes + tags), Informations
 * pratiques (grille), Disponibilité hebdomadaire (horaires).
 * ================================================================ */

import React from 'react';
import styles from '../styles/ProfilCorrespondant.module.css';
import type { InfoPratique, ScheduleRow } from '../data/types';

const STATUT_CLASS: Record<string, string> = {
  open: styles.schOpen, partial: styles.schPartial, closed: styles.schClosed,
};

interface Props {
  bio:            string[];
  tags:           string[];
  infosPratiques: InfoPratique[];
  schedule:       ScheduleRow[];
}

export default function TabInfo({ bio, tags, infosPratiques, schedule }: Props) {
  return (
    <>
      {/* À propos */}
      <div className={styles.card}>
        <div className={styles.ch}><div className={styles.ct}><i className="fas fa-circle-info" /> À propos</div></div>
        <div className={styles.cb}>
          {bio.map((p, i) => <p key={i} className={styles.aboutText}>{p}</p>)}
          <div className={styles.aboutTags}>
            {tags.map(t => (
              <span key={t} className={styles.atag}><i className="fas fa-check" /> {t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Informations pratiques */}
      <div className={styles.card}>
        <div className={styles.ch}><div className={styles.ct}><i className="fas fa-clipboard-list" /> Informations pratiques</div></div>
        <div className={styles.cb}>
          <div className={styles.infoGrid}>
            {infosPratiques.map(info => (
              <div key={info.label} className={styles.infoItem}>
                <div className={styles.infoIco}>
                  <i className={`${info.icone === 'fa-whatsapp' ? 'fab' : 'fas'} ${info.icone}`} />
                </div>
                <div>
                  <div className={styles.infoLbl}>{info.label}</div>
                  <div className={styles.infoVal}>{info.valeur}</div>
                  <div className={styles.infoSub}>{info.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Disponibilité hebdomadaire */}
      <div className={styles.card}>
        <div className={styles.ch}><div className={styles.ct}><i className="fas fa-calendar-week" /> Disponibilité hebdomadaire</div></div>
        <div className={styles.cb}>
          <div className={styles.schedule}>
            {schedule.map(s => (
              <div key={s.jour} className={`${styles.schRow} ${s.aujourdhui ? styles.schRowToday : ''}`}>
                <span className={styles.schDay}>
                  {s.jour}{s.aujourdhui && <span style={{ fontSize: 10, color: 'var(--co)' }}> (auj.)</span>}
                </span>
                <span className={styles.schHours}>{s.heures}</span>
                <span className={`${styles.schStatus} ${STATUT_CLASS[s.statut]}`}>{s.statutLabel}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}