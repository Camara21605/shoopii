/* ================================================================
 * FICHIER : src/dashboards/partenaire/pages/SignalementsPage.tsx
 * Signalements : liste réelle depuis l'API.
 * ================================================================ */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/SignalementsPage.module.css';
import { TYPE_ICON } from '../data/partenaireData';
import { apiFetch } from '@/shared/services/apiFetch';
import type { Gravite } from '../data/types';

interface Props { onReport: () => void; }

type SignalementStatut = 'review' | 'invest' | 'resolved' | 'rejected';

interface SignalementRow {
  id:         string;
  cible:      string;
  type:       string;
  motif:      string;
  motifLabel: string;
  gravite:    Gravite;
  raison:     string;
  statut:     SignalementStatut;
  date:       string;
}

interface SignalementsData {
  stats: { total: number; enCours: number; traites: number; rejetes: number };
  signalements: SignalementRow[];
}

const ST_ICON: Record<SignalementStatut, string> = {
  review: 'fa-clock', invest: 'fa-magnifying-glass', resolved: 'fa-circle-check', rejected: 'fa-xmark',
};

export default function SignalementsPage({ onReport }: Props) {
  const { t } = useTranslation();
  const [data, setData]       = useState<SignalementsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<SignalementsData>('/dashboard/partenaire/signalements')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const stats = data?.stats ?? { total: 0, enCours: 0, traites: 0, rejetes: 0 };
  const list  = data?.signalements ?? [];

  return (
    <div>
      {/* Bandeau */}
      <div className={styles.banner}>
        <div className={styles.bannerIc}><i className="fas fa-shield-halved" /></div>
        <div>
          <div className={styles.bannerT}>{t('partenaireSignalements.page.bannerTitle')}</div>
          <div className={styles.bannerP}>{t('partenaireSignalements.page.bannerParagraph')}</div>
        </div>
        <button className={styles.bannerBtn} onClick={onReport}><i className="fas fa-flag" /> {t('partenaireSignalements.page.bannerBtn')}</button>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.stat}><div className={styles.statV}>{stats.total}</div><div className={styles.statL}>{t('partenaireSignalements.page.stats.total')}</div></div>
        <div className={styles.stat}><div className={`${styles.statV} ${styles.a}`}>{stats.enCours}</div><div className={styles.statL}>{t('partenaireSignalements.page.stats.enCours')}</div></div>
        <div className={styles.stat}><div className={`${styles.statV} ${styles.g}`}>{stats.traites}</div><div className={styles.statL}>{t('partenaireSignalements.page.stats.traites')}</div></div>
        <div className={styles.stat}><div className={styles.statV}>{stats.rejetes}</div><div className={styles.statL}>{t('partenaireSignalements.page.stats.rejetes')}</div></div>
      </div>

      {/* Liste */}
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.chT}><i className="fas fa-flag" /> {t('partenaireSignalements.page.cardTitle')}</div>
          <button className={styles.chLink} onClick={onReport}><i className="fas fa-plus" /> {t('partenaireSignalements.page.nouveauBtn')}</button>
        </div>
        <div className={styles.cb}>
          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}><i className="fas fa-spinner fa-spin" /></div>
          ) : list.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
              <i className="fas fa-shield-check" style={{ fontSize: 28, display: 'block', marginBottom: 8, opacity: 0.4 }} />
              {t('partenaireSignalements.page.empty')}
            </div>
          ) : list.map(s => {
            return (
              <div key={s.id} className={styles.repItem}>
                <div className={styles.repAv}>
                  {s.type === 'ent' ? 'E' : s.type === 'lvr' ? 'L' : 'C'}
                </div>
                <div className={styles.repMain}>
                  <div className={styles.repTop}>
                    <span className={styles.repNm}>{s.cible}</span>
                    <span className={`${styles.sev} ${styles['sev_' + s.gravite]}`}>{t(`partenaireSignalements.gravites.${s.gravite}`)}</span>
                    <span className={`${styles.typePill} ${styles['t_' + s.type]}`}>
                      <i className={`fas ${TYPE_ICON[s.type] ?? 'fa-user'}`} /> {t(`partenaireCodes.types.${s.type}`, { defaultValue: s.type })}
                    </span>
                  </div>
                  <div className={styles.repReason}>{s.raison}</div>
                  <div className={styles.repMeta}>
                    <span><i className="fas fa-tag" /> {s.motifLabel}</span>
                    <span><i className="fas fa-calendar" /> {t('partenaireSignalements.page.signaleLe', { date: s.date })}</span>
                    <span><i className="fas fa-hashtag" /> {s.id}</span>
                  </div>
                </div>
                <div className={styles.repRight}>
                  <span className={`${styles.repSt} ${styles['st_' + s.statut]}`}>
                    <i className={`fas ${ST_ICON[s.statut] ?? ST_ICON.review}`} /> {t(`partenaireSignalements.page.statuts.${s.statut}`)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
