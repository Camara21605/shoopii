/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/SignalementsPage.tsx
 *
 * Centre de modération : les signalements envoyés par les
 * partenaires (et utilisateurs) arrivent ici. Actions :
 * enquête / avertir / suspendre / rejeter.
 * ================================================================ */

import { useState } from 'react';
import styles from '../styles/SignalementsPage.module.css';
import { SIGNALEMENTS, TYPE_LABEL, TYPE_ICON } from '../data/adminData';
import type { SignalementStatut, Gravite } from '../data/types';

interface SignalementsPageProps {
  onSanction: (cible: string) => void;
  onToast:    (msg: string, type?: 's' | 'i' | 'w') => void;
}

const GRAVITE_LABEL: Record<Gravite, string> = { low: 'Mineur', med: 'Modéré', high: 'Grave' };

const ST: Record<SignalementStatut, { label: string; icon: string }> = {
  review:   { label: 'Nouveau',          icon: 'fa-clock' },
  invest:   { label: 'Enquête en cours', icon: 'fa-magnifying-glass' },
  resolved: { label: 'Résolu',           icon: 'fa-circle-check' },
  rejected: { label: 'Rejeté',           icon: 'fa-xmark' },
};

type Onglet = 'atraiter' | 'encours' | 'traites';

export default function SignalementsPage({ onSanction, onToast }: SignalementsPageProps) {
  const [onglet, setOnglet] = useState<Onglet>('atraiter');

  const visibles = SIGNALEMENTS.filter(s =>
    onglet === 'atraiter' ? s.statut === 'review'
    : onglet === 'encours' ? s.statut === 'invest'
    : s.statut === 'resolved' || s.statut === 'rejected'
  );

  return (
    <div>
      {/* ── Bandeau modération ── */}
      <div className={styles.banner}>
        <div className={styles.bannerIc}><i className="fas fa-shield-halved" /></div>
        <div>
          <div className={styles.bannerT}>Centre de modération — Zone Conakry</div>
          <div className={styles.bannerP}>
            Les signalements envoyés par vos partenaires et les utilisateurs arrivent ici.
            Examinez les preuves, ouvrez une enquête, avertissez ou suspendez les comptes malveillants.
          </div>
        </div>
      </div>

      {/* ── Statistiques ── */}
      <div className={styles.stats}>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.vr}`}>4</div><div className={styles.cstatL}>À traiter</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.va}`}>2</div><div className={styles.cstatL}>Enquêtes en cours</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.vg}`}>31</div><div className={styles.cstatL}>Traités ce mois</div></div>
        <div className={styles.cstat}><div className={styles.cstatV}>9</div><div className={styles.cstatL}>Comptes suspendus</div></div>
      </div>

      {/* ── Liste des signalements avec onglets ── */}
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.chT}><i className="fas fa-flag" /> Signalements reçus</div>
          <div className={styles.chTabs}>
            <button className={`${styles.chTab} ${onglet === 'atraiter' ? styles.chTabOn : ''}`}
              onClick={() => setOnglet('atraiter')}>À traiter</button>
            <button className={`${styles.chTab} ${onglet === 'encours' ? styles.chTabOn : ''}`}
              onClick={() => setOnglet('encours')}>En cours</button>
            <button className={`${styles.chTab} ${onglet === 'traites' ? styles.chTabOn : ''}`}
              onClick={() => setOnglet('traites')}>Traités</button>
          </div>
        </div>
        <div className={styles.cb}>
          {visibles.length === 0 && (
            <p className={styles.empty}>Aucun signalement dans cette catégorie. ✨</p>
          )}
          {visibles.map(s => (
            <div key={s.id} className={styles.item}>
              <div className={styles.av}>{s.avatar}</div>
              <div className={styles.main}>
                <div className={styles.top}>
                  <span className={styles.nm}>{s.cible}</span>
                  <span className={`${styles.sev} ${styles['sev_' + s.gravite]}`}>{GRAVITE_LABEL[s.gravite]}</span>
                  <span className={`${styles.typePill} ${styles['t_' + s.type]}`}>
                    <i className={`fas ${TYPE_ICON[s.type]}`} /> {TYPE_LABEL[s.type]}
                  </span>
                  <span className={`${styles.st} ${styles['st_' + s.statut]}`}>
                    <i className={`fas ${ST[s.statut].icon}`} /> {ST[s.statut].label}
                  </span>
                </div>
                <div className={styles.reason}>{s.raison}</div>
                <div className={styles.meta}>
                  <span><i className="fas fa-user" /> Signalé par : {s.signalePar}</span>
                  <span><i className="fas fa-tag" /> {s.motifLabel}</span>
                  <span><i className="fas fa-hashtag" /> {s.id}</span>
                  <span><i className="fas fa-calendar" /> {s.quand}</span>
                </div>
                <div className={styles.acts}>
                  {s.statut === 'review' && (
                    <>
                      <button className={`${styles.rbtn} ${styles.inv}`}
                        onClick={() => onToast('🔍 Enquête ouverte sur ' + s.cible, 'i')}>
                        <i className="fas fa-magnifying-glass" /> Ouvrir une enquête
                      </button>
                      <button className={`${styles.rbtn} ${styles.warn}`}
                        onClick={() => onToast('⚠️ Avertissement envoyé', 'w')}>
                        <i className="fas fa-triangle-exclamation" /> Avertir
                      </button>
                      <button className={`${styles.rbtn} ${styles.susp}`} onClick={() => onSanction(s.cible)}>
                        <i className="fas fa-ban" /> Suspendre
                      </button>
                      <button className={`${styles.rbtn} ${styles.rej}`}
                        onClick={() => onToast('Signalement classé sans suite', 'i')}>
                        <i className="fas fa-xmark" /> Rejeter
                      </button>
                    </>
                  )}
                  {s.statut === 'invest' && (
                    <>
                      <button className={`${styles.rbtn} ${styles.susp}`} onClick={() => onSanction(s.cible)}>
                        <i className="fas fa-ban" /> Suspendre maintenant
                      </button>
                      <button className={`${styles.rbtn} ${styles.rej}`}
                        onClick={() => onToast('Enquête clôturée sans suite', 'i')}>
                        <i className="fas fa-xmark" /> Clore sans suite
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
