/* ================================================================
 * src/modules/home/components/settings/sections/SessionsSection.tsx
 * CONNECTÉ — GET + PATCH /client/parametres/sessions
 * ================================================================ */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../styles/SettingsCard.module.css';
import p from '../styles/SettingsPage.module.css';
import { settingsApi, type SessionItem } from '../../api/settings.api';

interface Props { onToast: (msg: string) => void; }

const DEV_CONFIG: Record<string, { cls: string; icon: string }> = {
  mobile:  { cls: s.devMob,  icon: 'fa-mobile-screen'         },
  web:     { cls: s.devWeb,  icon: 'fa-globe'                 },
  tablet:  { cls: s.devTab,  icon: 'fa-tablet-screen-button'  },
  suspect: { cls: s.devWarn, icon: 'fa-triangle-exclamation'  },
};

export default function SessionsSection({ onToast }: Props) {
  const { t } = useTranslation();
  const [sessions,  setSessions]  = useState<SessionItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [actionId,  setActionId]  = useState<string | null>(null);
  const [revoking,  setRevoking]  = useState(false);

  const suspectCount = sessions.filter(s => s.suspect).length;

  useEffect(() => {
    settingsApi.getSessions()
      .then(setSessions)
      .catch(() => onToast(t('settingsPage.sessions.loadError')))
      .finally(() => setLoading(false));
  }, []);

  async function handleRevoquer(id: string) {
    setActionId(id);
    try {
      await settingsApi.revoquerSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      onToast(t('settingsPage.sessions.toastRevoked'));
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setActionId(null); }
  }

  async function handleRevoquerToutes() {
    setRevoking(true);
    try {
      await settingsApi.revoquerToutes();
      setSessions(prev => prev.filter(s => s.isCurrent));
      onToast(t('settingsPage.sessions.toastRevokedAll'));
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setRevoking(false); }
  }

  const getDevType = (sess: SessionItem) => {
    if (sess.suspect) return 'suspect';
    if (sess.device?.toLowerCase().includes('iphone') || sess.device?.toLowerCase().includes('android')) return 'mobile';
    if (sess.device?.toLowerCase().includes('ipad') || sess.device?.toLowerCase().includes('tablet')) return 'tablet';
    return 'web';
  };

  if (loading) return <div className={s.card} style={{ padding:'48px 24px', textAlign:'center', color:'var(--t3)' }}><i className="fas fa-circle-notch fa-spin" style={{ fontSize:24 }} /></div>;

  return (
    <>
      <div className={s.card}>
        <div className={s.cardHd}>
          <div className={s.cardTitle}>
            <div className={`${s.cardIco} ${s.icoNavy}`}><i className="fas fa-desktop" /></div>
            <div>
              <div className={s.cardH}>{t('settingsPage.sessions.titre')}</div>
              <div className={s.cardSub}>
                {sessions.length} {t('settingsPage.sessions.subtitleSuffix', { count: sessions.length })}
                {suspectCount > 0 && <> — <span style={{ color:'var(--red)' }}>{suspectCount} {t('settingsPage.sessions.suspectSuffix', { count: suspectCount })}</span></>}
              </div>
            </div>
          </div>
          <button className={`${s.cardAction} ${s.cardActionRed}`} onClick={handleRevoquerToutes} disabled={revoking}>
            {revoking ? <><i className="fas fa-circle-notch fa-spin" /> {t('settingsPage.sessions.enCours')}</> : <><i className="fas fa-right-from-bracket" /> {t('settingsPage.sessions.deconnecterTout')}</>}
          </button>
        </div>
        <div className={s.cardBody}>
          {sessions.length === 0 && (
            <div style={{ padding:'24px', textAlign:'center', color:'var(--t3)', fontSize:13 }}>{t('settingsPage.sessions.aucuneSession')}</div>
          )}
          {sessions.map(sess => {
            const devType = getDevType(sess);
            const devCfg  = DEV_CONFIG[devType];
            return (
              <div key={sess.id} className={`${s.sessionRow} ${sess.suspect ? s.sessionRowSuspect : ''}`}>
                <div className={`${s.sessionDev} ${devCfg.cls}`}><i className={`fas ${devCfg.icon}`} /></div>
                <div className={s.sessionInfo}>
                  <div className={s.sessionName}>
                    {sess.suspect
                      ? <span className={s.sessionNameSuspect}>{sess.device} — {sess.browser}</span>
                      : `${sess.device} — ${sess.browser}`
                    }
                    {sess.isCurrent && <span className={s.sessionCur}><i className="fas fa-circle" style={{ fontSize:6 }} /> {t('settingsPage.sessions.sessionActuelle')}</span>}
                    {sess.suspect   && <span className={s.sessionSuspectBadge}><i className="fas fa-triangle-exclamation" style={{ fontSize:8 }} /> {t('settingsPage.sessions.suspect')}</span>}
                  </div>
                  <div className={s.sessionMeta}>
                    <span>{sess.browser}</span>
                    <span className={s.metaDot} />
                    <span style={{ color: sess.suspect ? 'var(--red)' : undefined }}>
                      <i className="fas fa-map-marker-alt" style={{ fontSize:9 }} /> {sess.location}
                    </span>
                    <span className={s.metaDot} />
                    <span>{sess.lastSeen}</span>
                    <span className={s.metaDot} />
                    <span className={`${s.actIp} ${sess.suspect ? s.actIpRed : ''}`}>{sess.ip}</span>
                  </div>
                </div>
                {!sess.isCurrent && (
                  <button
                    className={`${s.sessionRevoke} ${sess.suspect ? s.sessionRevokeSuspect : ''}`}
                    onClick={() => handleRevoquer(sess.id)}
                    disabled={actionId === sess.id}
                  >
                    {actionId === sess.id ? <i className="fas fa-circle-notch fa-spin" /> : t('settingsPage.sessions.revoquer')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {suspectCount > 0 && (
        <div className={p.infoBanner}>
          <i className="fas fa-circle-info" />
          <div><strong>{t('settingsPage.sessions.conseilTitre')}</strong> — {suspectCount} {t('settingsPage.sessions.conseilTexteSuffix', { count: suspectCount })}</div>
        </div>
      )}
    </>
  );
}