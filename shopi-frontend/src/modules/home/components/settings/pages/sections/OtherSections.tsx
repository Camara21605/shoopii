/* ================================================================
 * src/modules/home/components/settings/sections/OtherSections.tsx
 * DYNAMIQUE — 
 *             Langue, Données, Danger — tous connectés au backend
 * ================================================================ */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../styles/SettingsCard.module.css';
import p from '../styles/SettingsPage.module.css';
import { Toggle } from '../components/Toggle';
import { settingsApi } from '../../api/settings.api';

interface Props { onToast: (msg: string) => void; }

/* ════════════════════════════════════════════════════════════
 * DONNÉES — routes export/rapport/portabilite
 * ════════════════════════════════════════════════════════════ */
export function DonneesSection({ onToast }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<string | null>(null);

  async function handle(action: () => Promise<{message:string}>, key: string) {
    setLoading(key);
    try {
      const res = await action();
      onToast(`✅ ${res.message}`);
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setLoading(null); }
  }

  const rows = [
    { key:'export',     ico:'icoBlue',    icon:'fa-file-export',       title: t('settingsPage.donnees.rowsLive.export.title'),      desc: t('settingsPage.donnees.rowsLive.export.desc'),      label: t('settingsPage.donnees.rowsLive.export.label'),      action:settingsApi.exportAll       },
    { key:'commandes',  ico:'icoTeal',    icon:'fa-clock-rotate-left', title: t('settingsPage.donnees.rowsLive.commandes.title'),   desc: t('settingsPage.donnees.rowsLive.commandes.desc'),   label: t('settingsPage.donnees.rowsLive.commandes.label'),   action:settingsApi.exportCommandes  },
    { key:'factures',   ico:'icoViolet',  icon:'fa-file-invoice',      title: t('settingsPage.donnees.rowsLive.factures.title'),    desc: t('settingsPage.donnees.rowsLive.factures.desc'),    label: t('settingsPage.donnees.rowsLive.factures.label'),    action:settingsApi.exportFactures   },
    { key:'rapport',    ico:'icoEmerald', icon:'fa-user-shield',       title: t('settingsPage.donnees.rowsLive.rapport.title'),     desc: t('settingsPage.donnees.rowsLive.rapport.desc'),     label: t('settingsPage.donnees.rowsLive.rapport.label'),     action:settingsApi.getRapport       },
    { key:'portabilite',ico:'icoAmber',   icon:'fa-right-from-bracket',title: t('settingsPage.donnees.rowsLive.portabilite2.title'),desc: t('settingsPage.donnees.rowsLive.portabilite2.desc'),label: t('settingsPage.donnees.rowsLive.portabilite2.label'),action:settingsApi.portabilite      },
  ];

  return (
    <>
      <div className={s.card}>
        <div className={s.cardHd}>
          <div className={s.cardTitle}>
            <div className={`${s.cardIco} ${s.icoNavy}`}><i className="fas fa-database" /></div>
            <div><div className={s.cardH}>{t('settingsPage.donnees.titre')}</div><div className={s.cardSub}>{t('settingsPage.donnees.subtitle')}</div></div>
          </div>
        </div>
        <div className={s.cardBody}>
          {rows.map(({ key, ico, icon, title, desc, label, action }) => (
            <div key={key} className={s.dexRow}>
              <div className={s.dexLeft}>
                <div className={`${s.dexIco} ${(s as any)[ico]}`}><i className={`fas ${icon}`} /></div>
                <div><div className={s.dexTitle}>{title}</div><div className={s.dexDesc}>{desc}</div></div>
              </div>
              <button className={s.dexBtn} onClick={() => handle(action, key)} disabled={loading === key}>
                {loading === key ? <i className="fas fa-circle-notch fa-spin" /> : label}
              </button>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'flex-start', gap:12, background:'var(--sky)', border:'1px solid var(--sky-3)', borderRadius:'var(--r-md)', padding:'14px 16px', fontSize:12, color:'var(--t2)', lineHeight:1.6 }}>
        <i className="fas fa-circle-info" style={{ color:'var(--blue)', flexShrink:0, marginTop:2 }} />
        <div><strong>{t('settingsPage.donnees.droitsTitre')}</strong> — {t('settingsPage.donnees.droitsTexteShort')} <strong>privacy@shopi.gn</strong>.</div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════
 * DANGER — routes danger avec confirmation
 *
 * "Désactiver" et "Supprimer" exigent désormais le mot de passe actuel
 * (voir DangerService.verifyPassword côté backend) : un simple double-clic
 * suffisait auparavant à désactiver/supprimer le compte, sans aucune
 * seconde preuve d'identité en cas de session/JWT compromis.
 *
 * "Révoquer les accès tiers" est désactivé ("Bientôt disponible") : le
 * site ne propose aucune intégration OAuth/application tierce à révoquer
 * — l'ancienne implémentation désactivait en réalité le 2FA de
 * l'utilisateur sous cet intitulé trompeur.
 * ════════════════════════════════════════════════════════════ */
const PASSWORD_GATED = new Set(['desactiver', 'supprimer']);

export function DangerSection({ onToast }: Props) {
  const { t } = useTranslation();
  const [loading,  setLoading]  = useState<string | null>(null);
  const [confirm,  setConfirm]  = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [pwdError, setPwdError] = useState<string | null>(null);

  function startConfirm(key: string) {
    setConfirm(key);
    setPassword('');
    setPwdError(null);
  }
  function cancelConfirm() {
    setConfirm(null);
    setPassword('');
    setPwdError(null);
  }

  async function handle(action: () => Promise<{message:string}>, key: string) {
    if (confirm !== key) { startConfirm(key); return; }
    if (PASSWORD_GATED.has(key) && !password) {
      setPwdError(t('settingsPage.danger.passwordRequired'));
      return;
    }
    setLoading(key);
    try {
      const res = await action();
      onToast(`✅ ${res.message}`);
      cancelConfirm();
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (PASSWORD_GATED.has(key) && /mot de passe|incorrect|401/i.test(msg)) {
        setPwdError(t('settingsPage.danger.passwordIncorrect'));
      } else {
        onToast(`❌ ${msg}`);
      }
    } finally {
      setLoading(null);
    }
  }

  const rows = [
    { key:'desactiver',    title: t('settingsPage.danger.rowsLive.desactiver.title'),    btn: t('settingsPage.danger.rowsLive.desactiver.btn'),    action:() => settingsApi.desactiver(password), hard:false, soon:false },
    { key:'revoquer',      title: t('settingsPage.danger.rowsLive.revoquer.title'),      btn: t('settingsPage.danger.rowsLive.revoquer.btn'),      action:null,                                    hard:false, soon:true  },
    { key:'reinitialiser', title: t('settingsPage.danger.rowsLive.reinitialiser.title'), btn: t('settingsPage.danger.rowsLive.reinitialiser.btn'), action:settingsApi.reinitialiser,               hard:false, soon:false },
    { key:'supprimer',     title: t('settingsPage.danger.rowsLive.supprimer.titre'),     btn: t('settingsPage.danger.rowsLive.supprimer.btn'),     action:() => settingsApi.supprimer(password),   hard:true,  soon:false },
  ] as const;

  return (
    <div className={`${s.card} ${s.cardDanger}`}>
      <div className={`${s.cardHd} ${s.cardHdDanger}`}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoRed}`}><i className="fas fa-triangle-exclamation" /></div>
          <div>
            <div className={`${s.cardH} ${s.cardHRed}`}>{t('settingsPage.danger.titre')}</div>
            <div className={s.cardSub}>{t('settingsPage.danger.subtitle')}</div>
          </div>
        </div>
      </div>
      <div className={s.cardBody}>
        {rows.map(({ key, title, btn, action, hard, soon }) => (
          <div key={key} className={s.dangerRow}>
            <div>
              <div className={hard ? `${s.dangerTitle} ${s.dangerTitleRed}` : s.dangerTitle}>{title}</div>
              <div className={s.dangerDesc}>
                {key === 'desactiver' && t('settingsPage.danger.rowsLive.desactiver.desc')}
                {key === 'revoquer' && t('settingsPage.danger.rowsLive.revoquer.desc')}
                {key === 'reinitialiser' && t('settingsPage.danger.rowsLive.reinitialiser.desc')}
                {key === 'supprimer' && (
                  <>
                    {t('settingsPage.danger.rowsLive.supprimer.descPart1')} <strong>{t('settingsPage.danger.rowsLive.supprimer.descStrong1')}</strong>{t('settingsPage.danger.rowsLive.supprimer.descPart2')} <strong>{t('settingsPage.danger.rowsLive.supprimer.descStrong2')}</strong>{t('settingsPage.danger.rowsLive.supprimer.descPart3')}
                  </>
                )}
              </div>
              {confirm === key && PASSWORD_GATED.has(key) && (
                <div style={{ marginTop: 10 }}>
                  <div className={s.dangerPwdRow}>
                    <input
                      type="password"
                      className={s.dangerPwdInput}
                      placeholder={t('settingsPage.danger.passwordPlaceholder')}
                      value={password}
                      onChange={e => { setPassword(e.target.value); setPwdError(null); }}
                      autoFocus
                    />
                  </div>
                  {pwdError && <div className={s.dangerPwdError}>{pwdError}</div>}
                </div>
              )}
            </div>
            {soon ? (
              <span className={s.dangerSoonBadge}>{t('settingsPage.danger.comingSoon')}</span>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end', flexShrink:0 }}>
                {confirm === key && !PASSWORD_GATED.has(key) && (
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--red)', marginBottom:2, textAlign:'right' }}>
                    {t('settingsPage.danger.clicAgain')}
                  </div>
                )}
                <button
                  className={hard ? `${s.dangerBtn} ${s.dangerBtnHard}` : s.dangerBtn}
                  onClick={() => handle(action as () => Promise<{message:string}>, key)}
                  disabled={loading === key}
                  style={{ opacity: confirm && confirm !== key ? 0.5 : 1 }}
                >
                  {loading === key
                    ? <i className="fas fa-circle-notch fa-spin" />
                    : confirm === key
                      ? <><i className="fas fa-triangle-exclamation" /> {t('settingsPage.danger.confirmerBtn')}</>
                      : btn
                  }
                </button>
                {confirm === key && (
                  <button style={{ fontSize:10, color:'var(--t3)', background:'none', border:'none', cursor:'pointer', padding:'2px 0' }} onClick={cancelConfirm}>
                    {t('settingsPage.danger.annulerBtn')}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}