// src/dashboards/livreur/pages/EnCoursPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import shared from '../styles/Shared.module.css';
import styles from '../styles/EnCoursPage.module.css';
import { fmtGNF } from '../data/livreurData';
import type { PageId } from '../data/livreurData';
import { fetchEnCours } from '../services/encours.api';
import type { EnCoursApi } from '../services/encours.api';

interface Props {
  onPop: (m: string, t?: string) => void;
  onNavigate: (p: PageId) => void;
}

const POLL_MS = 30_000;

export default function EnCoursPage({ onPop, onNavigate }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mission, setMission] = useState<EnCoursApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  /* ── Chargement + rafraîchissement (pause quand onglet masqué) ── */
  const load = useCallback(() => {
    fetchEnCours()
      .then(setMission)
      .catch(() => onPop(t('livreurEnCours.loadError'), 'e'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    let id = setInterval(load, POLL_MS);
    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(id);
      } else {
        load();
        id = setInterval(load, POLL_MS);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisibility); };
  }, [load]);

  /* ── Tic-tac du chronomètre ── */
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className={shared.page}>
        <div style={{ padding:'60px 0', textAlign:'center', color:'var(--t3)', fontSize:14 }}>
          <i className="fas fa-circle-notch fa-spin" /> {t('livreurEnCours.chargement')}
        </div>
      </div>
    );
  }

  if (!mission) {
    return (
      <div className={shared.page}>
        <div style={{ padding:'60px 0', textAlign:'center', color:'var(--t3)' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🛵</div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--navy)' }}>{t('livreurEnCours.empty.title')}</div>
          <div style={{ fontSize:12, marginTop:4 }}>{t('livreurEnCours.empty.sub')}</div>
        </div>
      </div>
    );
  }

  let secs = 0;
  const hasEta = !!mission.etaAt;
  if (mission.etaAt) {
    secs = Math.max(0, Math.floor((new Date(mission.etaAt).getTime() - now) / 1000));
  }
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  const urgent = hasEta && secs < 5 * 60;

  const clientInitiale = mission.client.nom.trim().charAt(0).toUpperCase() || '?';
  const telephone = mission.client.telephone ?? t('livreurEnCours.telephoneNonRenseigne');

  const CLIENT_INFO = [
    { ic:'fa-phone',        lbl: t('livreurEnCours.clientInfo.telephone'), val: telephone },
    { ic:'fa-location-dot', lbl: t('livreurEnCours.clientInfo.adresse'),   val: mission.client.adresse },
    ...(mission.client.instructions
      ? [{ ic:'fa-comment', lbl: t('livreurEnCours.clientInfo.instruction'), val: mission.client.instructions }]
      : []),
  ];

  return (
    <div className={shared.page}>
      {/* Mission active banner */}
      <div className={styles.maBanner}>
        <div className={styles.maBg} /><div className={styles.maGrid} />
        <div className={styles.maPulse}>🛵</div>
        <div className={styles.maInfo}>
          <div className={styles.maLabel}>{t('livreurOverview.missionActive.label')} · {mission.id}</div>
          <div className={styles.maTitle}>{mission.nm}</div>
          <div className={styles.maMeta}>
            <span><i className="fas fa-store" /> {mission.shop}</span>
            <span><i className="fas fa-coins" /> {fmtGNF(mission.fee)}</span>
          </div>
        </div>
        <div className={styles.maRight}>
          {hasEta && (
            <div className={`${styles.maTimer} ${urgent ? styles.timerUrgent : ''}`}>
              <div className={`${styles.maTimerVal} ${urgent ? styles.timerValUrgent : ''}`}>{mm}:{ss}</div>
              <div className={styles.maTimerLbl}>{t('livreurOverview.missionActive.timeLeft')}</div>
            </div>
          )}
          <div className={styles.maActions}>
            <button className={styles.maBtnOk} onClick={() => navigate(`/commande/${mission.uuid}/suivi`)}>
              <i className="fas fa-check-circle" /> {t('livreurOverview.missionActive.voirCommande')}
            </button>
            <button className={styles.maBtnIssue} onClick={() => onPop(t('livreurEnCours.appelClientToast', { telephone }), 'i')}>
              <i className="fas fa-phone" /> {t('livreurEnCours.appelerLeClient')}
            </button>
          </div>
        </div>
      </div>

      {/* Steps + Client */}
      <div className={shared.g2}>
        <div className={`${shared.card} ${shared.cardLast}`}>
          <div className={shared.ch}><div className={shared.chT}><i className="fas fa-route" /> {t('livreurEnCours.etapesLivraison')}</div></div>
          <div className={shared.cb}>
            <div className={styles.steps}>
              {mission.steps.map((s, i) => (
                <div key={i} className={styles.step}>
                  <div className={`${styles.stepDot} ${styles[`dot_${s.status}`]}`}>
                    {s.status === 'done'   && <i className="fas fa-check" />}
                    {s.status === 'active' && <i className="fas fa-location-dot" />}
                  </div>
                  {i < mission.steps.length-1 && <div className={styles.stepLine} />}
                  <div className={styles.stepBody}>
                    <div className={styles.stepLbl}>{s.label}</div>
                    <div className={styles.stepSub}>{s.sub}</div>
                  </div>
                  <div className={styles.stepTime}>{s.time ?? '—'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={`${shared.card} ${shared.cardLast}`}>
          <div className={shared.ch}><div className={shared.chT}><i className="fas fa-user-circle" /> {t('livreurEnCours.informationsClient')}</div></div>
          <div className={shared.cb}>
            <div className={styles.clientHd}>
              <div className={styles.clientAva}>{clientInitiale}</div>
              <div>
                <div className={styles.clientNm}>{mission.client.nom}</div>
              </div>
            </div>
            {CLIENT_INFO.map((c, i) => (
              <div key={i} className={styles.clientRow}>
                <div className={styles.clientIc}><i className={`fas ${c.ic}`} style={{ color:'var(--teal)', fontSize:12 }} /></div>
                <div>
                  <div className={styles.clientLbl}>{c.lbl}</div>
                  <div className={styles.clientVal}>{c.val}</div>
                </div>
              </div>
            ))}
            <div className={styles.clientBtns}>
              <button className={styles.btnCall} onClick={() => onPop(t('livreurEnCours.appelEnCoursToast'), 'i')}>
                <i className="fas fa-phone" /> {t('livreurEnCours.appeler')}
              </button>
              <button className={styles.btnMsg} onClick={() => onNavigate('messagerie')}>
                <i className="fas fa-comment-dots" /> {t('livreurEnCours.messagerie')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
