/* ================================================================
 * src/modules/home/components/settings/sections/SessionsSection.tsx
 * CONNECTÉ — GET + PATCH /client/parametres/sessions
 *
 * Sessions RÉELLES (refresh tokens + session Redis) : la session en cours est
 * toujours listée (avant : « 0 session active » en permanence). « Révoquer »
 * et « Déconnecter les autres appareils » déconnectent réellement.
 * Shoneya n'autorise qu'une session active à la fois : la page l'explique.
 * ================================================================ */

import { useState, useEffect, useCallback } from 'react';
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

/** « il y a 5 min » dans la langue de l'interface. */
function relativeTime(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = (d.getTime() - Date.now()) / 1000;             // négatif = passé
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60)        return rtf.format(0, 'second');        // « maintenant »
  if (abs < 3600)      return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400)     return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

export default function SessionsSection({ onToast }: Props) {
  const { t, i18n } = useTranslation();
  const [sessions,  setSessions]  = useState<SessionItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId,  setActionId]  = useState<string | null>(null);
  const [revoking,  setRevoking]  = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  const suspectCount = sessions.filter(x => x.suspect).length;
  const others       = sessions.filter(x => !x.isCurrent).length;

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    setError(false);
    try { setSessions(await settingsApi.getSessions()); }
    catch { setError(true); if (silent) onToast(t('settingsPage.sessions.loadError')); }
    finally { setLoading(false); setRefreshing(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRevoquer(id: string) {
    setActionId(id);
    try {
      await settingsApi.revoquerSession(id);
      setSessions(prev => prev.filter(x => x.id !== id));
      onToast(t('settingsPage.sessions.toastRevoked'));
    } catch (err: any) { onToast(`❌ ${err.message}`); load(true); }
    finally { setActionId(null); }
  }

  async function handleRevoquerToutes() {
    setRevoking(true);
    try {
      await settingsApi.revoquerToutes();
      setSessions(prev => prev.filter(x => x.isCurrent));
      setConfirmAll(false);
      onToast(t('settingsPage.sessions.toastRevokedAll'));
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setRevoking(false); }
  }

  const getDevType = (sess: SessionItem) => {
    if (sess.suspect) return 'suspect';
    const d = (sess.device ?? '').toLowerCase();
    const b = (sess.browser ?? '').toLowerCase();
    if (d === 'android' || d === 'ios' || d.includes('iphone') || b.includes('mobile')) return 'mobile';
    if (d.includes('ipad') || d.includes('tablet')) return 'tablet';
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className={`${s.cardAction} ${s.cardActionOutline}`} onClick={() => load(true)} disabled={refreshing} aria-label={t('settingsPage.sessions.actualiser')}>
              <i className={`fas fa-rotate-right ${refreshing ? 'fa-spin' : ''}`} /> {t('settingsPage.sessions.actualiser')}
            </button>
            {others > 0 && !confirmAll && (
              <button className={`${s.cardAction} ${s.cardActionRed}`} onClick={() => setConfirmAll(true)}>
                <i className="fas fa-right-from-bracket" /> {t('settingsPage.sessions.deconnecterAutres')}
              </button>
            )}
          </div>
        </div>

        {confirmAll && (
          <div className={s.sessionConfirm} role="alertdialog" aria-live="polite">
            <span>{t('settingsPage.sessions.confirmAutres', { count: others })}</span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button className={s.btnSave} onClick={handleRevoquerToutes} disabled={revoking}>
                {revoking ? <><i className="fas fa-circle-notch fa-spin" /> {t('settingsPage.sessions.enCours')}</> : t('settingsPage.sessions.confirmer')}
              </button>
              <button className={s.btnCancel} onClick={() => setConfirmAll(false)} disabled={revoking}>{t('settingsPage.sessions.annuler')}</button>
            </span>
          </div>
        )}

        <div className={s.cardBody}>
          {error && (
            <div style={{ padding:'24px', textAlign:'center', color:'var(--t3)', fontSize:13 }}>
              {t('settingsPage.sessions.loadErrorInline')}{' '}
              <button type="button" className={s.linkBtn} onClick={() => { setLoading(true); load(); }}>{t('settingsPage.sessions.reessayer')}</button>
            </div>
          )}
          {!error && sessions.length === 0 && (
            <div style={{ padding:'24px', textAlign:'center', color:'var(--t3)', fontSize:13 }}>{t('settingsPage.sessions.aucuneSession')}</div>
          )}
          {sessions.map(sess => {
            const devType = getDevType(sess);
            const devCfg  = DEV_CONFIG[devType];
            const seen    = relativeTime(sess.lastSeen, i18n.language);
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
                    <span style={{ color: sess.suspect ? 'var(--red)' : undefined }}>
                      <i className="fas fa-map-marker-alt" style={{ fontSize:9 }} /> {sess.location || t('settingsPage.sessions.localisationInconnue')}
                    </span>
                    <span className={s.metaDot} />
                    <span title={new Date(sess.lastSeen).toLocaleString(i18n.language)}>{sess.isCurrent ? t('settingsPage.sessions.activeMaintenant') : t('settingsPage.sessions.activite', { when: seen })}</span>
                    {sess.ip && <><span className={s.metaDot} /><span className={`${s.actIp} ${sess.suspect ? s.actIpRed : ''}`}>{sess.ip}</span></>}
                  </div>
                  {sess.createdAt && (
                    <div className={s.sessionMeta} style={{ marginTop: 2 }}>
                      <span>{t('settingsPage.sessions.connecteDepuis', { date: new Date(sess.createdAt).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }) })}</span>
                    </div>
                  )}
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

      <div className={p.infoBanner}>
        <i className="fas fa-circle-info" />
        <div>{t('settingsPage.sessions.uneSeule')}</div>
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
