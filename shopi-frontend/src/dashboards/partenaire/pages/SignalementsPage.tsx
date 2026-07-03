/* ================================================================
 * FICHIER : src/dashboards/partenaire/pages/SignalementsPage.tsx
 * Sécurité & Signalements : bandeau + stats + liste des signalements.
 * ================================================================ */

import styles from '../styles/SignalementsPage.module.css';
import { SIGNALEMENTS, TYPE_LABEL, TYPE_ICON } from '../data/partenaireData';
import type { SignalementStatut, Gravite } from '../data/types';

interface Props { onReport: () => void; }

const ST: Record<SignalementStatut, { label: string; icon: string }> = {
  review:   { label: 'En examen',        icon: 'fa-clock' },
  invest:   { label: 'Enquête en cours', icon: 'fa-magnifying-glass' },
  resolved: { label: 'Compte suspendu',  icon: 'fa-circle-check' },
  rejected: { label: 'Non retenu',       icon: 'fa-xmark' },
};
const SEV_LABEL: Record<Gravite, string> = { high: 'Grave', med: 'Modéré', low: 'Mineur' };

export default function SignalementsPage({ onReport }: Props) {
  return (
    <div>
      {/* Bandeau */}
      <div className={styles.banner}>
        <div className={styles.bannerIc}><i className="fas fa-shield-halved" /></div>
        <div>
          <div className={styles.bannerT}>Aidez-nous à garder Shopi sûr</div>
          <div className={styles.bannerP}>En tant que partenaire, vous êtes en première ligne. Signalez tout acteur au comportement suspect (fraude, faux compte, arnaque, abus). Chaque signalement est examiné par l'équipe de sécurité Shopi.</div>
        </div>
        <button className={styles.bannerBtn} onClick={onReport}><i className="fas fa-flag" /> Signaler un utilisateur</button>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.stat}><div className={styles.statV}>6</div><div className={styles.statL}>Signalements envoyés</div></div>
        <div className={styles.stat}><div className={`${styles.statV} ${styles.a}`}>2</div><div className={styles.statL}>En cours d'examen</div></div>
        <div className={styles.stat}><div className={`${styles.statV} ${styles.g}`}>3</div><div className={styles.statL}>Traités / sanctionnés</div></div>
        <div className={styles.stat}><div className={styles.statV}>1</div><div className={styles.statL}>Rejetés</div></div>
      </div>

      {/* Liste */}
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.chT}><i className="fas fa-flag" /> Mes signalements</div>
          <button className={styles.chLink} onClick={onReport}><i className="fas fa-plus" /> Nouveau</button>
        </div>
        <div className={styles.cb}>
          {SIGNALEMENTS.map(s => (
            <div key={s.id} className={styles.repItem}>
              <div className={styles.repAv}>??</div>
              <div className={styles.repMain}>
                <div className={styles.repTop}>
                  <span className={styles.repNm}>{s.cible}</span>
                  <span className={`${styles.sev} ${styles['sev_' + s.gravite]}`}>{SEV_LABEL[s.gravite]}</span>
                  <span className={`${styles.typePill} ${styles['t_' + s.type]}`}><i className={`fas ${TYPE_ICON[s.type]}`} /> {TYPE_LABEL[s.type]}</span>
                </div>
                <div className={styles.repReason}>{s.raison}</div>
                <div className={styles.repMeta}>
                  <span><i className="fas fa-tag" /> {s.motifLabel}</span>
                  <span><i className="fas fa-calendar" /> Signalé le {s.date}</span>
                  <span><i className="fas fa-hashtag" /> {s.id}</span>
                </div>
              </div>
              <div className={styles.repRight}>
                <span className={`${styles.repSt} ${styles['st_' + s.statut]}`}>
                  <i className={`fas ${ST[s.statut].icon}`} /> {ST[s.statut].label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
