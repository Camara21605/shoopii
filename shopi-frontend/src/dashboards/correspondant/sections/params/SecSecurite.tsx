/* SecSecurite.tsx — VERSION CONNECTÉE */
import React, { useState, useEffect, useRef } from 'react';
import s from '../../styles/ParamsShared.module.css';
import ToggleRow from './ToggleRow';
import { pop } from '../../components/Toast';
import { SESSIONS, SEC_TOGGLES, type ToggleRow as TRow } from '../../data/parametresData';
import type { CorrespondantData } from '../../hooks/useCorrespondantParametres';

interface Props {
  data: CorrespondantData | null; saving: boolean;
  dirty: () => void; markClean: () => void; saveTrigger: number;
  onSave: (body: { twoFaEnabled?: boolean; twoFaMethod?: string }) => Promise<any>;
  onChangePassword: (body: { currentPassword: string; newPassword: string }) => Promise<any>;
}

const SEC_KEYS: Record<number, string> = { 0:'sms', 1:'authenticator', 2:'alerteConnexion' };
function strength(pwd: string) { let n=0; if(pwd.length>=8)n++; if(/[A-Z]/.test(pwd))n++; if(/[0-9]/.test(pwd))n++; if(/[^A-Za-z0-9]/.test(pwd))n++; return n; }
const STR_COLOR = ['#DC2626','#F59E0B','#84CC16','#16A34A'];
const STR_LABEL = ['Trop faible','Faible','Bon','Fort'];

export default function SecSecurite({ data, saving, dirty, markClean, saveTrigger, onSave, onChangePassword }: Props) {
  const [pwdAct,   setPwdAct]   = useState('');
  const [pwdNew,   setPwdNew]   = useState('');
  const [pwdConf,  setPwdConf]  = useState('');
  const [showPwd,  setShowPwd]  = useState([false,false,false]);
  const [secToggs, setSecToggs] = useState<TRow[]>(SEC_TOGGLES.map(t => ({ ...t })));
  const [otp,      setOtp]      = useState(Array(6).fill(''));
  const [changing, setChanging] = useState(false);
  const otpRefs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null));
  const str = strength(pwdNew);

  /* ── Init 2FA depuis API ── */
  useEffect(() => {
    if (!data) return;
    setSecToggs(prev => prev.map((t, i) => ({
      ...t,
      checked: i === 0 ? (data.twoFaMethod === 'sms')
              : i === 1 ? (data.twoFaMethod === 'authenticator')
              : t.checked,
    })));
  }, [data]);

  useEffect(() => { if (saveTrigger > 0) handleSave2FA(); }, [saveTrigger]);

  async function handleSave2FA() {
    const method = secToggs[0].checked ? 'sms' : secToggs[1].checked ? 'authenticator' : null;
    try {
      await onSave({ twoFaEnabled: secToggs[0].checked || secToggs[1].checked, twoFaMethod: method as any });
      markClean();
      pop('✅ Sécurité mise à jour', 's');
    } catch (e: any) { pop(`❌ ${e.message}`, 'e'); }
  }

  async function handleChangePwd() {
    if (pwdNew !== pwdConf) return pop('❌ Les mots de passe ne correspondent pas', 'e');
    if (str < 2) return pop('⚠️ Mot de passe trop faible', 'w');
    setChanging(true);
    try {
      await onChangePassword({ currentPassword: pwdAct, newPassword: pwdNew });
      setPwdAct(''); setPwdNew(''); setPwdConf('');
      pop('✅ Mot de passe modifié', 's');
    } catch (e: any) { pop(`❌ ${e.message}`, 'e'); }
    finally { setChanging(false); }
  }

  function handleOtp(i: number, val: string) {
    const d = val.replace(/\D/,'').slice(-1);
    setOtp(p => p.map((v, j) => j === i ? d : v));
    if (d && i < 5) otpRefs[i + 1].current?.focus();
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={s.psHd}>
        <h1><i className="fas fa-lock" /> Sécurité & Connexion</h1>
        <p>Protégez votre compte avec des options de sécurité avancées.</p>
      </div>

      {/* Mot de passe */}
      <div className={s.fc}>
        <div className={s.fcHd}><div><div className={s.fcTtl}><i className="fas fa-key" /> Changer le mot de passe</div></div></div>
        <div className={s.fcBody}>
          <div className={s.fg}>
            <div className={s.fl}>Mot de passe actuel</div>
            <div className={s.fw}>
              <i className="fas fa-lock" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none', zIndex:1 }} />
              <input className={s.fin} type={showPwd[0]?'text':'password'} value={pwdAct} placeholder="••••••••" onChange={e => { setPwdAct(e.target.value); dirty(); }} />
              <button onClick={() => setShowPwd(p => p.map((v,j)=>j===0?!v:v))} style={{ position:'absolute', right:12, background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:13 }}><i className={`fas ${showPwd[0]?'fa-eye-slash':'fa-eye'}`}/></button>
            </div>
          </div>
          <div className={s.grid2}>
            <div className={s.fg}>
              <div className={s.fl}>Nouveau mot de passe</div>
              <div className={s.fw}>
                <i className="fas fa-lock" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none', zIndex:1 }} />
                <input className={s.fin} type={showPwd[1]?'text':'password'} value={pwdNew} placeholder="Min. 8 caractères" onChange={e => { setPwdNew(e.target.value); dirty(); }} />
                <button onClick={() => setShowPwd(p => p.map((v,j)=>j===1?!v:v))} style={{ position:'absolute', right:12, background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:13 }}><i className={`fas ${showPwd[1]?'fa-eye-slash':'fa-eye'}`}/></button>
              </div>
              {pwdNew && (<><div className={s.pwdBars}>{[1,2,3,4].map(n=><div key={n} className={s.pwdBar} style={{ background:n<=str?STR_COLOR[str-1]:'var(--g200)' }}/>)}</div><div style={{ fontSize:11, color:STR_COLOR[str-1]??'var(--t3)', marginTop:4 }}>{str>0?STR_LABEL[str-1]:''}</div></>)}
            </div>
            <div className={s.fg}>
              <div className={s.fl}>Confirmer</div>
              <div className={s.fw}>
                <i className="fas fa-lock" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none', zIndex:1 }} />
                <input className={s.fin} type={showPwd[2]?'text':'password'} value={pwdConf} placeholder="Répétez"
                  style={{ borderColor: pwdConf?(pwdConf===pwdNew?'var(--green,#16A34A)':'var(--red,#DC2626)'):undefined }}
                  onChange={e => { setPwdConf(e.target.value); dirty(); }} />
                <button onClick={() => setShowPwd(p => p.map((v,j)=>j===2?!v:v))} style={{ position:'absolute', right:12, background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:13 }}><i className={`fas ${showPwd[2]?'fa-eye-slash':'fa-eye'}`}/></button>
              </div>
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:6 }}>
            <button className={s.saveBtn} onClick={handleChangePwd} disabled={changing || !pwdAct || !pwdNew || pwdNew!==pwdConf}>
              {changing ? <><i className="fas fa-spinner fa-spin" /> Modification…</> : <><i className="fas fa-key" /> Changer le mot de passe</>}
            </button>
          </div>
        </div>
      </div>

      {/* 2FA */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div><div className={s.fcTtl}><i className="fas fa-mobile-screen" /> Double authentification (2FA)</div></div>
          <div style={{ background: data?.twoFaEnabled ? 'var(--em-bg)' : 'var(--g50)', color: data?.twoFaEnabled ? 'var(--emerald,#047857)' : 'var(--t3)', fontSize:11, fontWeight:700, padding:'4px 11px', borderRadius:'var(--pill)', border:`1px solid ${data?.twoFaEnabled ? 'rgba(4,120,87,.2)' : 'var(--bdr)'}` }}>
            <i className={`fas ${data?.twoFaEnabled ? 'fa-shield-check' : 'fa-shield'}`} /> {data?.twoFaEnabled ? 'Activé' : 'Désactivé'}
          </div>
        </div>
        <div className={s.fcBody}>
          {secToggs.map((t, i) => (
            <ToggleRow key={t.label} label={t.label} sub={t.sub} checked={t.checked} badge={t.badge}
              onChange={v => { setSecToggs(p => p.map((x, j) => j === i ? { ...x, checked:v } : x)); dirty(); }} />
          ))}
          <div style={{ paddingTop:14, borderTop:'1px solid var(--bdr)', marginTop:2 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--navy)', marginBottom:9 }}>Tester votre code 2FA</div>
            <div className={s.otpRow}>
              {otp.map((d, i) => (
                <input key={i} ref={otpRefs[i]} className={s.otpD} type="text" maxLength={1} inputMode="numeric" value={d}
                  onChange={e => handleOtp(i, e.target.value)}
                  onKeyDown={e => e.key==='Backspace' && !otp[i] && i>0 && otpRefs[i-1].current?.focus()} />
              ))}
            </div>
            <button onClick={() => pop('✅ Code 2FA vérifié avec succès','s')} style={{ marginTop:11, background:'var(--cor,#B45309)', color:'#fff', border:'none', borderRadius:'var(--pill)', padding:'9px 20px', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
              <i className="fas fa-check" /> Vérifier
            </button>
          </div>
        </div>
      </div>

      {/* Sessions */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div><div className={s.fcTtl}><i className="fas fa-clock-rotate-left" /> Sessions actives</div></div>
          <button className={s.fcAction} onClick={() => pop('⚠️ Toutes les sessions déconnectées','w')}>
            <i className="fas fa-right-from-bracket" /> Tout déconnecter
          </button>
        </div>
        <div className={s.fcBody}>
          {SESSIONS.map(sess => (
            <div key={sess.nm} className={s.sessionItem}>
              <div className={s.sessionIc}><i className={`fas ${sess.ic}`} /></div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--navy)', display:'flex', alignItems:'center', gap:7 }}>
                  {sess.nm}
                  {sess.active && <span style={{ background:'#10B981', color:'#fff', fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:'var(--pill)' }}>Session actuelle</span>}
                </div>
                <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{sess.detail}</div>
              </div>
              {!sess.active && (
                <button onClick={() => pop('⚠️ Session déconnectée','w')} style={{ background:'rgba(220,38,38,.08)', color:'var(--red,#DC2626)', border:'1px solid rgba(220,38,38,.2)', borderRadius:'var(--pill)', padding:'5px 13px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                  Déconnecter
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button className={s.saveBtn} onClick={handleSave2FA} disabled={saving}>
          {saving ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</> : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder la 2FA</>}
        </button>
      </div>
    </div>
  );
}