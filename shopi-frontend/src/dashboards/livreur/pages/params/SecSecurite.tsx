/*
 * FICHIER : src/dashboards/livreur/pages/params/SecSecurite.tsx
 * ✅ CONNECTÉ — changement de mot de passe + 2FA vers l'API
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LivreurData } from '../../hooks/useLivreurParametres';
import ps from '../../styles/ParamsShared.module.css';
import TwoFaSetupModal from '../../../../shared/components/TwoFaSetupModal';

interface Props {
  data:         LivreurData | null;
  saving:       boolean;
  dirty:        () => void;
  onPop:        (m: string, t?: string) => void;
  savePassword: (b: { currentPassword: string; newPassword: string; confirmPassword: string }) => Promise<void>;
  saveTwoFa:   (b: { twoFaEnabled: boolean; twoFaMethod?: string }) => Promise<void>;
  /** Déconnexion réelle — voir "Se déconnecter" sur la carte Session. */
  onLogout:    () => void;
}

function pwdStrength(t: (key: string) => string, v: string) {
  let s = 0;
  if (v.length >= 8)           s++;
  if (/[A-Z]/.test(v))         s++;
  if (/[0-9]/.test(v))         s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;
  const labels = ['', t('livreurSecSecurite.pwdStrength.tropFaible'), t('livreurSecSecurite.pwdStrength.faible'), t('livreurSecSecurite.pwdStrength.bon'), t('livreurSecSecurite.pwdStrength.fort')];
  return {
    score: s,
    label: labels[s] ?? '',
    color: ['','#A1A1AA','#71717A','#3F3F46','#000000'][s] ?? 'var(--t3)',
  };
}

export default function SecSecurite({ data, saving, dirty, onPop, savePassword, saveTwoFa, onLogout }: Props) {
  const { t } = useTranslation();
  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [showPwd,     setShowPwd]     = useState([false,false,false]);
  const [twoFaOn,     setTwoFaOn]     = useState(data?.twoFaEnabled ?? false);
  const [twoFaMethod, setTwoFaMethod] = useState(data?.twoFaMethod ?? 'sms');
  const [show2fa,     setShow2fa]     = useState(false);
  const str = pwdStrength(t, newPwd);

  async function handlePasswordSave() {
    if (!currentPwd) { onPop(t('livreurSecSecurite.toasts.currentRequired'), 'w'); return; }
    if (newPwd.length < 8) { onPop(t('livreurSecSecurite.toasts.tooShort'), 'w'); return; }
    if (newPwd !== confirmPwd) { onPop(t('livreurSecSecurite.toasts.mismatch'), 'e'); return; }
    if (str.score < 2) { onPop(t('livreurSecSecurite.toasts.tooWeak'), 'w'); return; }
    try {
      await savePassword({ currentPassword:currentPwd, newPassword:newPwd, confirmPassword:confirmPwd });
      onPop(t('livreurSecSecurite.toasts.pwdChanged'), 's');
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (err: any) {
      onPop(err?.message ?? t('livreurSecSecurite.toasts.currentWrong'), 'e');
    }
  }

  async function handleTwoFaSave() {
    /* Activation : passe par POST /auth/2fa/setup + /confirm (TwoFaService),
     * qui exige un code TOTP valide avant d'activer réellement — l'ancien
     * chemin direct (twoFaEnabled:true) est désormais rejeté côté backend. */
    if (twoFaOn && !data?.twoFaEnabled) {
      setShow2fa(true);
      return;
    }
    try {
      await saveTwoFa({ twoFaEnabled:twoFaOn, twoFaMethod:twoFaOn ? twoFaMethod : undefined });
      onPop(twoFaOn ? t('livreurSecSecurite.toasts.twoFaEnabled') : t('livreurSecSecurite.toasts.twoFaDisabled'), twoFaOn ? 's' : 'w');
    } catch (err: any) {
      onPop(err?.message ?? t('livreurSecSecurite.toasts.twoFaUpdateError'), 'e');
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={ps.psHd}>
        <h2><i className="fas fa-lock" /> {t('livreurSecSecurite.header.titre')}</h2>
        <p>{t('livreurSecSecurite.header.sub')}</p>
      </div>

      {/* Mot de passe */}
      <div className={ps.card}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-key" /> {t('livreurSecSecurite.pwdCard.titre')}</div></div>
        <div className={ps.cb}>
          <div className={ps.fiGroup} style={{ marginBottom:14 }}>
            <div className={ps.fiLabel}>{t('livreurSecSecurite.pwdCard.actuel')}</div>
            <div className={ps.fiWrap}>
              <i className="fas fa-lock" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
              <input className={ps.fiInput} type={showPwd[0]?'text':'password'} value={currentPwd}
                onChange={e => { setCurrentPwd(e.target.value); dirty(); }} placeholder="••••••••" />
              <button type="button" onClick={() => { const n=[...showPwd]; n[0]=!n[0]; setShowPwd(n); }}
                style={{ position:'absolute', right:12, background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:13 }}>
                <i className={`fas ${showPwd[0]?'fa-eye-slash':'fa-eye'}`} />
              </button>
            </div>
          </div>
          <div className={ps.grid2}>
            <div className={ps.fiGroup}>
              <div className={ps.fiLabel}>{t('livreurSecSecurite.pwdCard.nouveau')}</div>
              <div className={ps.fiWrap}>
                <i className="fas fa-lock" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                <input className={ps.fiInput} type={showPwd[1]?'text':'password'} value={newPwd}
                  onChange={e => { setNewPwd(e.target.value); dirty(); }} placeholder={t('livreurSecSecurite.pwdCard.nouveauPlaceholder')} />
                <button type="button" onClick={() => { const n=[...showPwd]; n[1]=!n[1]; setShowPwd(n); }}
                  style={{ position:'absolute', right:12, background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:13 }}>
                  <i className={`fas ${showPwd[1]?'fa-eye-slash':'fa-eye'}`} />
                </button>
              </div>
              {newPwd && (
                <>
                  <div className={ps.pwdBars}>
                    {[1,2,3,4].map(i => (
                      <div key={i} className={ps.pwdBar} style={{ background: i<=str.score ? str.color : 'var(--g200)' }} />
                    ))}
                  </div>
                  <div style={{ fontSize:11, color:str.color, marginTop:4 }}>{str.label}</div>
                </>
              )}
            </div>
            <div className={ps.fiGroup}>
              <div className={ps.fiLabel}>{t('livreurSecSecurite.pwdCard.confirmer')}</div>
              <div className={ps.fiWrap}>
                <i className="fas fa-lock" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                <input className={ps.fiInput} type={showPwd[2]?'text':'password'} value={confirmPwd}
                  onChange={e => { setConfirmPwd(e.target.value); dirty(); }} placeholder={t('livreurSecSecurite.pwdCard.confirmerPlaceholder')} />
                <button type="button" onClick={() => { const n=[...showPwd]; n[2]=!n[2]; setShowPwd(n); }}
                  style={{ position:'absolute', right:12, background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:13 }}>
                  <i className={`fas ${showPwd[2]?'fa-eye-slash':'fa-eye'}`} />
                </button>
              </div>
              {confirmPwd && newPwd !== confirmPwd && (
                <div style={{ fontSize:11, color:'var(--red)', marginTop:4 }}>
                  <i className="fas fa-triangle-exclamation" /> {t('livreurSecSecurite.pwdCard.mismatch')}
                </div>
              )}
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12 }}>
            <button onClick={handlePasswordSave} disabled={saving}
              style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)',
                padding:'10px 24px', fontSize:12, fontWeight:700, cursor:'pointer', opacity:saving?0.6:1,
                display:'flex', alignItems:'center', gap:7 }}>
              {saving ? <><i className="fas fa-spinner fa-spin" /> {t('livreurSecSecurite.saving')}</> : <><i className="fas fa-key" /> {t('livreurSecSecurite.modifierMdp')}</>}
            </button>
          </div>
        </div>
      </div>

      {/* 2FA */}
      <div className={ps.card}>
        <div className={ps.ch}>
          <div className={ps.chT}><i className="fas fa-mobile-screen" /> {t('livreurSecSecurite.twoFaCard.titre')}</div>
          <div style={{ background: twoFaOn ? 'var(--em-bg)' : 'rgba(0,0,0,.09)',
            color: twoFaOn ? 'var(--emerald)' : 'var(--red)', fontSize:11, fontWeight:700,
            padding:'4px 11px', borderRadius:'var(--pill)',
            border:`1px solid ${twoFaOn ? 'rgba(0,0,0,.2)' : 'rgba(0,0,0,.2)'}` }}>
            <i className={`fas ${twoFaOn ? 'fa-shield-check' : 'fa-shield-xmark'}`} />
            {twoFaOn ? t('livreurSecSecurite.twoFaCard.active') : t('livreurSecSecurite.twoFaCard.inactive')}
          </div>
        </div>
        <div className={ps.cb}>
          <div className={ps.setRow} style={{ marginBottom:14 }}>
            <div>
              <div className={ps.srLbl}>{t('livreurSecSecurite.twoFaCard.activerLabel')}</div>
              <div className={ps.srSub}>{t('livreurSecSecurite.twoFaCard.activerSub')}</div>
            </div>
            <label className={ps.tog}>
              <input type="checkbox" checked={twoFaOn} onChange={e => { setTwoFaOn(e.target.checked); dirty(); }} />
              <span className={ps.togs} />
            </label>
          </div>

          {twoFaOn && (
            <div style={{ marginBottom:14 }}>
              <div className={ps.fiLabel} style={{ marginBottom:8 }}>{t('livreurSecSecurite.twoFaCard.methodeLabel')}</div>
              {[
                { val:'sms',   em:'💬', label: t('livreurSecSecurite.twoFaCard.methods.sms.label'),   sub: t('livreurSecSecurite.twoFaCard.methods.sms.sub')   },
                { val:'email', em:'📧', label: t('livreurSecSecurite.twoFaCard.methods.email.label'), sub: t('livreurSecSecurite.twoFaCard.methods.email.sub') },
                { val:'app',   em:'🔑', label: t('livreurSecSecurite.twoFaCard.methods.app.label'),   sub: t('livreurSecSecurite.twoFaCard.methods.app.sub')   },
              ].map(m => (
                <div key={m.val} onClick={() => { setTwoFaMethod(m.val); dirty(); }}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', marginBottom:6,
                    borderRadius:'var(--r-lg)', cursor:'pointer',
                    background: twoFaMethod===m.val ? 'var(--tl-bg)' : 'var(--g50)',
                    border:`1.5px solid ${twoFaMethod===m.val ? 'var(--teal)' : 'var(--bdr2)'}` }}>
                  <span style={{ fontSize:18 }}>{m.em}</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--navy)' }}>{m.label}</div>
                    <div style={{ fontSize:11, color:'var(--t3)' }}>{m.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button onClick={handleTwoFaSave} disabled={saving}
              style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)',
                padding:'10px 24px', fontSize:12, fontWeight:700, cursor:'pointer', opacity:saving?0.6:1,
                display:'flex', alignItems:'center', gap:7 }}>
              {saving ? <><i className="fas fa-spinner fa-spin" /> {t('livreurSecSecurite.saving')}</> : <><i className="fas fa-shield-check" /> {t('livreurSecSecurite.twoFaCard.enregistrer2fa')}</>}
            </button>
          </div>
        </div>
      </div>

      {/* BUG CORRIGÉ — affichait 2 sessions ("iPhone", "MacBook")
       * entièrement codées en dur, identiques pour tout le monde, avec
       * "Déconnecter"/"Tout déconnecter" qui ne faisaient qu'un toast
       * sans jamais rien déconnecter. Shoneya n'autorise qu'UNE session
       * active à la fois par compte (voir SessionService côté backend) :
       * il n'y a donc jamais eu plusieurs appareils à lister. Remplacé
       * par la vraie session active (device/navigateur/IP/date, voir
       * ProfilLivreurService.attachCurrentSession) avec un vrai bouton
       * de déconnexion. */}
      <div className={`${ps.card} ${ps.cardLast}`}>
        <div className={ps.ch}>
          <div className={ps.chT}><i className="fas fa-clock-rotate-left" /> {t('livreurSecSecurite.sessionsCard.titre')}</div>
        </div>
        <div className={ps.cb}>
          {data?.currentSession ? (
            <div className={ps.sessionItem}>
              <div className={ps.sessionIc}><i className="fas fa-mobile-screen" /></div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--navy)', display:'flex', alignItems:'center', gap:7 }}>
                  {data.currentSession.device} · {data.currentSession.browser}
                  <span style={{ background:'#000000', color:'#fff', fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:'var(--pill)' }}>{t('livreurSecSecurite.sessionsCard.sessionActuelle')}</span>
                </div>
                <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>
                  {data.currentSession.ipAddress ?? '—'} · {t('livreurSecSecurite.sessionsCard.connecteDepuis', {
                    date: new Date(data.currentSession.connectedSince).toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }),
                  })}
                </div>
              </div>
              <button onClick={onLogout}
                style={{ background:'rgba(0,0,0,.08)', color:'var(--red)', border:'1px solid rgba(0,0,0,.2)',
                  borderRadius:'var(--pill)', padding:'5px 13px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                {t('livreurSecSecurite.sessionsCard.deconnecter')}
              </button>
            </div>
          ) : (
            <div style={{ fontSize:12, color:'var(--t3)' }}>
              <i className="fas fa-circle-info" /> {t('livreurSecSecurite.sessionsCard.unavailable')}
            </div>
          )}
        </div>
      </div>

      {show2fa && (
        <TwoFaSetupModal
          onClose={() => setShow2fa(false)}
          onEnabled={() => {
            setTwoFaMethod('app');
            onPop(t('livreurSecSecurite.toasts.twoFaEnabledModal'), 's');
          }}
        />
      )}
    </div>
  );
}