/* SecSecurite.tsx — VERSION CONNECTÉE */
import React, { useState, useEffect } from 'react';
import s from '../../styles/ParamsShared.module.css';
import ToggleRow from './ToggleRow';
import { pop } from '../../components/Toast';
import { SEC_TOGGLES, type ToggleRow as TRow } from '../../data/parametresData';
import type { CorrespondantData } from '../../hooks/useCorrespondantParametres';
import TwoFaSetupModal from '../../../../shared/components/TwoFaSetupModal';

interface Props {
  data: CorrespondantData | null; saving: boolean;
  dirty: () => void; markClean: () => void; saveTrigger: number;
  onSave: (body: { twoFaEnabled?: boolean; twoFaMethod?: string }) => Promise<any>;
  onChangePassword: (body: { currentPassword: string; newPassword: string }) => Promise<any>;
  /** Déconnexion réelle — voir "Se déconnecter" sur la carte Session. */
  onLogout: () => void;
}

function strength(pwd: string) { let n=0; if(pwd.length>=8)n++; if(/[A-Z]/.test(pwd))n++; if(/[0-9]/.test(pwd))n++; if(/[^A-Za-z0-9]/.test(pwd))n++; return n; }
const STR_COLOR = ['var(--red)','var(--amber)','var(--teal)','var(--emerald)'];
const STR_LABEL = ['Trop faible','Faible','Bon','Fort'];

export default function SecSecurite({ data, saving, dirty, markClean, saveTrigger, onSave, onChangePassword, onLogout }: Props) {
  const [pwdAct,   setPwdAct]   = useState('');
  const [pwdNew,   setPwdNew]   = useState('');
  const [pwdConf,  setPwdConf]  = useState('');
  const [showPwd,  setShowPwd]  = useState([false,false,false]);
  const [secToggs, setSecToggs] = useState<TRow[]>(SEC_TOGGLES.map(t => ({ ...t })));
  const [changing, setChanging] = useState(false);
  const [show2fa,  setShow2fa]  = useState(false);
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
    const enabling = secToggs[0].checked || secToggs[1].checked;
    /* Activation : passe par POST /auth/2fa/setup + /confirm (TwoFaService),
     * qui exige un code TOTP valide avant d'activer réellement — l'ancien
     * chemin direct (twoFaEnabled:true) est désormais rejeté côté backend. */
    if (enabling && !data?.twoFaEnabled) {
      setShow2fa(true);
      return;
    }
    const method = secToggs[0].checked ? 'sms' : secToggs[1].checked ? 'authenticator' : null;
    try {
      await onSave({ twoFaEnabled: enabling, twoFaMethod: method as any });
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
                  style={{ borderColor: pwdConf?(pwdConf===pwdNew?'var(--emerald)':'var(--red)'):undefined }}
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
          <div style={{ background: data?.twoFaEnabled ? 'var(--em-bg)' : 'var(--g50)', color: data?.twoFaEnabled ? 'var(--emerald)' : 'var(--t3)', fontSize:11, fontWeight:700, padding:'4px 11px', borderRadius:'var(--pill)', border:`1px solid ${data?.twoFaEnabled ? 'rgba(4,120,87,.2)' : 'var(--bdr)'}` }}>
            <i className={`fas ${data?.twoFaEnabled ? 'fa-shield-check' : 'fa-shield'}`} /> {data?.twoFaEnabled ? 'Activé' : 'Désactivé'}
          </div>
        </div>
        <div className={s.fcBody}>
          {/* BUG CORRIGÉ — "Tester votre code 2FA" (6 cases + bouton
           * "Vérifier") affichait TOUJOURS "Code 2FA vérifié avec succès"
           * quel que soit ce qui était tapé, y compris rien du tout :
           * aucune vérification réelle n'avait jamais lieu, et aucune
           * route backend de test autonome n'existe (la vérification
           * réelle se fait déjà pendant l'activation, via TwoFaSetupModal
           * ci-dessous). Retiré plutôt que de continuer à prétendre
           * vérifier quoi que ce soit. */}
          {secToggs.map((t, i) => {
            /* BUG CORRIGÉ — le 3e toggle ("Alerte connexion inconnue")
             * n'a aucune colonne backend correspondante (seuls
             * twoFaEnabled/twoFaMethod existent sur Correspondent) :
             * jamais lu par handleSave2FA() ci-dessus, jamais envoyé au
             * serveur — bascule sans aucun effet. Marqué honnêtement
             * "Bientôt disponible" plutôt que de prétendre fonctionner. */
            const comingSoon = i === 2;
            return (
              <ToggleRow key={t.label} label={comingSoon ? `${t.label} (bientôt disponible)` : t.label} sub={t.sub}
                checked={comingSoon ? false : t.checked} badge={t.badge} disabled={comingSoon}
                onChange={v => { if (!comingSoon) { setSecToggs(p => p.map((x, j) => j === i ? { ...x, checked:v } : x)); dirty(); } }} />
            );
          })}
        </div>
      </div>

      {/* BUG CORRIGÉ — affichait 2 sessions ("iPhone 14 Pro", "MacBook
       * Air") entièrement codées en dur, identiques pour tout le monde,
       * avec "Déconnecter"/"Tout déconnecter" qui ne faisaient qu'un
       * toast sans jamais rien déconnecter. Shoneya n'autorise qu'UNE
       * session active à la fois par compte (voir SessionService côté
       * backend) : il n'y a donc jamais eu plusieurs appareils à
       * lister. Remplacé par la vraie session active (device/
       * navigateur/IP/date, voir ProfilService.attachCurrentSession)
       * avec un vrai bouton de déconnexion. */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div><div className={s.fcTtl}><i className="fas fa-clock-rotate-left" /> Session active</div></div>
        </div>
        <div className={s.fcBody}>
          {data?.currentSession ? (
            <div className={s.sessionItem}>
              <div className={s.sessionIc}><i className="fas fa-mobile-screen" /></div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--navy)', display:'flex', alignItems:'center', gap:7 }}>
                  {data.currentSession.device} · {data.currentSession.browser}
                  <span style={{ background:'var(--btn,#111113)', color:'#fff', fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:'var(--pill)' }}>Session actuelle</span>
                </div>
                <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>
                  {data.currentSession.ipAddress ?? '—'} · Connecté depuis le {new Date(data.currentSession.connectedSince).toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                </div>
              </div>
              <button onClick={onLogout} style={{ background:'var(--g100)', color:'var(--t1)', border:'1px solid var(--bdr2)', borderRadius:'var(--pill)', padding:'5px 13px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                Se déconnecter
              </button>
            </div>
          ) : (
            <div style={{ fontSize:12, color:'var(--t3)' }}>
              <i className="fas fa-circle-info" /> Informations de session indisponibles pour le moment.
            </div>
          )}
        </div>
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button className={s.saveBtn} onClick={handleSave2FA} disabled={saving}>
          {saving ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</> : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder la 2FA</>}
        </button>
      </div>

      {show2fa && (
        <TwoFaSetupModal
          onClose={() => setShow2fa(false)}
          onEnabled={() => {
            setSecToggs(p => p.map((x, j) => ({ ...x, checked: j === 1 ? true : j === 0 ? false : x.checked })));
            markClean();
            pop('🔐 2FA activée avec succès', 's');
          }}
        />
      )}
    </div>
  );
}