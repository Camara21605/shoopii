/*
 * FICHIER : src/dashboards/livreur/pages/params/SecSecurite.tsx
 * ✅ CONNECTÉ — changement de mot de passe + 2FA vers l'API
 */
import React, { useState, useRef } from 'react';
import { SESSIONS } from '../../data/parametresData';
import type { LivreurData } from '../../hooks/useLivreurParametres';
import ps from '../../styles/ParamsShared.module.css';

interface Props {
  data:         LivreurData | null;
  saving:       boolean;
  dirty:        () => void;
  onPop:        (m: string, t?: string) => void;
  savePassword: (b: { currentPassword: string; newPassword: string; confirmPassword: string }) => Promise<void>;
  saveTwoFa:   (b: { twoFaEnabled: boolean; twoFaMethod?: string }) => Promise<void>;
}

function pwdStrength(v: string) {
  let s = 0;
  if (v.length >= 8)           s++;
  if (/[A-Z]/.test(v))         s++;
  if (/[0-9]/.test(v))         s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;
  return {
    score: s,
    label: ['','Trop faible','Faible','Bon','Fort'][s] ?? '',
    color: ['','#DC2626','#F59E0B','#84CC16','#16A34A'][s] ?? 'var(--t3)',
  };
}

export default function SecSecurite({ data, saving, dirty, onPop, savePassword, saveTwoFa }: Props) {
  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [showPwd,     setShowPwd]     = useState([false,false,false]);
  const [twoFaOn,     setTwoFaOn]     = useState(data?.twoFaEnabled ?? false);
  const [twoFaMethod, setTwoFaMethod] = useState(data?.twoFaMethod ?? 'sms');
  const [otp,         setOtp]         = useState(['','','','','','']);
  const otpRefs = useRef<(HTMLInputElement|null)[]>([]);
  const str = pwdStrength(newPwd);

  const updateOtp = (i: number, v: string) => {
    const next=[...otp]; next[i]=v.replace(/\D/,'').slice(-1); setOtp(next);
    if (v && i<5) otpRefs.current[i+1]?.focus();
  };

  async function handlePasswordSave() {
    if (!currentPwd) { onPop('⚠️ Saisissez votre mot de passe actuel', 'w'); return; }
    if (newPwd.length < 8) { onPop('⚠️ Le nouveau mot de passe doit contenir au moins 8 caractères', 'w'); return; }
    if (newPwd !== confirmPwd) { onPop('❌ Les mots de passe ne correspondent pas', 'e'); return; }
    if (str.score < 2) { onPop('⚠️ Mot de passe trop faible — ajoutez des majuscules et chiffres', 'w'); return; }
    try {
      await savePassword({ currentPassword:currentPwd, newPassword:newPwd, confirmPassword:confirmPwd });
      onPop('✅ Mot de passe modifié avec succès', 's');
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (err: any) {
      onPop(err?.message ?? '❌ Mot de passe actuel incorrect', 'e');
    }
  }

  async function handleTwoFaSave() {
    try {
      await saveTwoFa({ twoFaEnabled:twoFaOn, twoFaMethod:twoFaOn ? twoFaMethod : undefined });
      onPop(twoFaOn ? '✅ Double authentification activée' : '⚠️ Double authentification désactivée', twoFaOn ? 's' : 'w');
    } catch (err: any) {
      onPop(err?.message ?? '❌ Erreur lors de la mise à jour', 'e');
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={ps.psHd}>
        <h2><i className="fas fa-lock" /> Sécurité & Connexion</h2>
        <p>Protégez votre compte avec des couches de sécurité avancées.</p>
      </div>

      {/* Mot de passe */}
      <div className={ps.card}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-key" /> Changer le mot de passe</div></div>
        <div className={ps.cb}>
          <div className={ps.fiGroup} style={{ marginBottom:14 }}>
            <div className={ps.fiLabel}>Mot de passe actuel</div>
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
              <div className={ps.fiLabel}>Nouveau mot de passe</div>
              <div className={ps.fiWrap}>
                <i className="fas fa-lock" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                <input className={ps.fiInput} type={showPwd[1]?'text':'password'} value={newPwd}
                  onChange={e => { setNewPwd(e.target.value); dirty(); }} placeholder="Min. 8 caractères" />
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
              <div className={ps.fiLabel}>Confirmer</div>
              <div className={ps.fiWrap}>
                <i className="fas fa-lock" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                <input className={ps.fiInput} type={showPwd[2]?'text':'password'} value={confirmPwd}
                  onChange={e => { setConfirmPwd(e.target.value); dirty(); }} placeholder="Répétez" />
                <button type="button" onClick={() => { const n=[...showPwd]; n[2]=!n[2]; setShowPwd(n); }}
                  style={{ position:'absolute', right:12, background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:13 }}>
                  <i className={`fas ${showPwd[2]?'fa-eye-slash':'fa-eye'}`} />
                </button>
              </div>
              {confirmPwd && newPwd !== confirmPwd && (
                <div style={{ fontSize:11, color:'var(--red)', marginTop:4 }}>
                  <i className="fas fa-triangle-exclamation" /> Les mots de passe ne correspondent pas
                </div>
              )}
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12 }}>
            <button onClick={handlePasswordSave} disabled={saving}
              style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)',
                padding:'10px 24px', fontSize:12, fontWeight:700, cursor:'pointer', opacity:saving?0.6:1,
                display:'flex', alignItems:'center', gap:7 }}>
              {saving ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</> : <><i className="fas fa-key" /> Modifier le mot de passe</>}
            </button>
          </div>
        </div>
      </div>

      {/* 2FA */}
      <div className={ps.card}>
        <div className={ps.ch}>
          <div className={ps.chT}><i className="fas fa-mobile-screen" /> Authentification 2FA</div>
          <div style={{ background: twoFaOn ? 'var(--em-bg)' : 'rgba(220,38,38,.09)',
            color: twoFaOn ? 'var(--emerald)' : 'var(--red)', fontSize:11, fontWeight:700,
            padding:'4px 11px', borderRadius:'var(--pill)',
            border:`1px solid ${twoFaOn ? 'rgba(4,120,87,.2)' : 'rgba(220,38,38,.2)'}` }}>
            <i className={`fas ${twoFaOn ? 'fa-shield-check' : 'fa-shield-xmark'}`} />
            {twoFaOn ? ' Activé' : ' Désactivé'}
          </div>
        </div>
        <div className={ps.cb}>
          <div className={ps.setRow} style={{ marginBottom:14 }}>
            <div>
              <div className={ps.srLbl}>Activer la double authentification</div>
              <div className={ps.srSub}>Protège votre compte même si votre mot de passe est compromis</div>
            </div>
            <label className={ps.tog}>
              <input type="checkbox" checked={twoFaOn} onChange={e => { setTwoFaOn(e.target.checked); dirty(); }} />
              <span className={ps.togs} />
            </label>
          </div>

          {twoFaOn && (
            <div style={{ marginBottom:14 }}>
              <div className={ps.fiLabel} style={{ marginBottom:8 }}>Méthode de vérification</div>
              {[
                { val:'sms',   em:'💬', label:'Code par SMS',               sub:'Code envoyé à votre numéro à chaque connexion' },
                { val:'email', em:'📧', label:'Code par Email',             sub:'Code envoyé à votre adresse email' },
                { val:'app',   em:'🔑', label:'Application Authenticator', sub:'Google Authenticator ou Authy — plus sécurisé' },
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
              {saving ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</> : <><i className="fas fa-shield-check" /> Enregistrer la 2FA</>}
            </button>
          </div>
        </div>
      </div>

      {/* Sessions */}
      <div className={`${ps.card} ${ps.cardLast}`}>
        <div className={ps.ch}>
          <div className={ps.chT}><i className="fas fa-clock-rotate-left" /> Sessions actives</div>
          <button className={ps.chAction} onClick={() => onPop('⚠️ Toutes les autres sessions ont été déconnectées', 'w')}>
            <i className="fas fa-right-from-bracket" /> Tout déconnecter
          </button>
        </div>
        <div className={ps.cb}>
          {SESSIONS.map((s, i) => (
            <div key={i} className={ps.sessionItem}>
              <div className={ps.sessionIc}><i className={`fas ${s.ic}`} /></div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--navy)', display:'flex', alignItems:'center', gap:7 }}>
                  {s.nm}
                  {s.active && <span style={{ background:'#10B981', color:'#fff', fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:'var(--pill)' }}>Session actuelle</span>}
                </div>
                <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{s.detail}</div>
              </div>
              {!s.active && (
                <button onClick={() => onPop('⚠️ Session déconnectée avec succès', 'w')}
                  style={{ background:'rgba(220,38,38,.08)', color:'var(--red)', border:'1px solid rgba(220,38,38,.2)',
                    borderRadius:'var(--pill)', padding:'5px 13px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                  Déconnecter
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}