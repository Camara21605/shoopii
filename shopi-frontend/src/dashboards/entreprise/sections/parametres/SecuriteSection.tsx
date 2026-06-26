// src/dashboards/entreprise/sections/parametres/SecuriteSection.tsx
import React, { useState } from 'react';
import FormCard from '../../components/parametres/FormCard';
import s from '../../styles/parametres/ParametresPage.module.css';

interface Props { onDirty: () => void; onToast: (m: string, t?: string) => void; }

const SESSIONS = [
  { ic:'fa-desktop', nm:'Chrome · Windows 11', sub:'Conakry, Guinée · Maintenant', cur:true },
  { ic:'fa-mobile-screen', nm:'Safari · iPhone 14', sub:'Conakry, Guinée · Il y a 2 heures', cur:false },
  { ic:'fa-tablet-screen-button', nm:'Chrome · Android', sub:'Coyah, Guinée · Hier à 18h34', cur:false },
];
const TWO_FA = [
  { em:'📱', ttl:"Application d'authentification", sub:'Google Authenticator ou Authy · Recommandé', badge:'Le plus sécurisé', sel:true },
  { em:'💬', ttl:'SMS / WhatsApp', sub:'Code envoyé par message à chaque connexion', badge:'Pratique', sel:false },
  { em:'📧', ttl:'Email uniquement', sub:'Code envoyé par email à votre adresse principale', badge:'Basique', sel:false },
];

export default function SecuriteSection({ onDirty, onToast }: Props) {
  const [pwdVis, setPwdVis] = useState({ c:false, n:false, cf:false });
  const [pwdStr, setPwdStr] = useState(0);
  const [fa2, setFa2] = useState(0);

  function checkPwd(v: string) {
    let s = 0;
    if (v.length >= 8) s++;
    if (/[A-Z]/.test(v)) s++;
    if (/[0-9]/.test(v)) s++;
    if (/[^A-Za-z0-9]/.test(v)) s++;
    setPwdStr(s);
    onDirty();
  }

  const PWD_COLORS = ['#DC2626', '#F59E0B', '#84CC16', '#16A34A'];
  const PWD_LABELS = ['Trop faible', 'Faible', 'Bon', 'Fort'];

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-lock" /> Sécurité &amp; Connexion</h1>
        <p>Protégez votre compte boutique avec un mot de passe fort et la double authentification.</p>
      </div>
      <FormCard title="Changer le mot de passe" icon="fa-key">
        <div className={s.fg}>
          <div className={s.fl}>Mot de passe actuel</div>
          <div className={s.fw}>
            <i className={`fas fa-lock ${s.fi}`} />
            <input className={s.fin} type={pwdVis.c ? 'text' : 'password'} placeholder="••••••••" onChange={onDirty} />
            <button onClick={() => setPwdVis(p => ({ ...p, c: !p.c }))} style={{ position:'absolute', right:12, background:'none', border:'none', color:'var(--t3)', cursor:'pointer' }}><i className={`fas fa-${pwdVis.c ? 'eye-slash' : 'eye'}`} /></button>
          </div>
        </div>
        <div className={s.fg}>
          <div className={s.fl}>Nouveau mot de passe</div>
          <div className={s.fw}>
            <i className={`fas fa-lock-open ${s.fi}`} />
            <input className={s.fin} type={pwdVis.n ? 'text' : 'password'} placeholder="Min. 8 caractères" onChange={e => checkPwd(e.target.value)} />
            <button onClick={() => setPwdVis(p => ({ ...p, n: !p.n }))} style={{ position:'absolute', right:12, background:'none', border:'none', color:'var(--t3)', cursor:'pointer' }}><i className={`fas fa-${pwdVis.n ? 'eye-slash' : 'eye'}`} /></button>
          </div>
          {pwdStr > 0 && (
            <>
              <div className={s.pwdBars}>
                {[1,2,3,4].map(i => <div key={i} className={s.pwdBar} style={{ background: i <= pwdStr ? PWD_COLORS[pwdStr-1] : 'var(--g200)' }} />)}
              </div>
              <div style={{ fontSize:11, color:'var(--t3)', marginTop:4, display:'flex', justifyContent:'space-between' }}>
                <span>Force :</span><span style={{ fontWeight:700, color: PWD_COLORS[pwdStr-1] }}>{PWD_LABELS[pwdStr-1]}</span>
              </div>
            </>
          )}
        </div>
        <div className={s.fg}>
          <div className={s.fl}>Confirmer le nouveau mot de passe</div>
          <div className={s.fw}>
            <i className={`fas fa-shield-check ${s.fi}`} />
            <input className={s.fin} type={pwdVis.cf ? 'text' : 'password'} placeholder="Répétez le nouveau mot de passe" onChange={onDirty} />
            <button onClick={() => setPwdVis(p => ({ ...p, cf: !p.cf }))} style={{ position:'absolute', right:12, background:'none', border:'none', color:'var(--t3)', cursor:'pointer' }}><i className={`fas fa-${pwdVis.cf ? 'eye-slash' : 'eye'}`} /></button>
          </div>
        </div>
        <button className={s.saveBtn} style={{ marginTop:4 }} onClick={() => onToast('🔐 Mot de passe mis à jour', 's')}><i className="fas fa-key" /> Mettre à jour le mot de passe</button>
      </FormCard>

      <FormCard title="Double Authentification (2FA)" icon="fa-mobile-screen-button" subtitle="Ajoutez une couche de sécurité supplémentaire"
        action={<span className={`${s.badge} ${s.amber}`} style={{ fontSize:11, padding:'4px 12px' }}>Non activé</span>}
      >
        <div className={s.radioGroup}>
          {TWO_FA.map((p, i) => (
            <div key={p.ttl} className={`${s.radioOpt} ${fa2 === i ? s.selected : ''}`} onClick={() => { setFa2(i); onDirty(); }}>
              <div className={s.roDot} />
              <span className={s.roEm}>{p.em}</span>
              <div><div className={s.roTtl}>{p.ttl}</div><div className={s.roSub}>{p.sub}</div></div>
              <div className={s.roBadge}>{p.badge}</div>
            </div>
          ))}
        </div>
      </FormCard>

      <FormCard title="Sessions actives" icon="fa-desktop" subtitle="Appareils connectés à votre compte boutique"
        action={<button style={{ background:'rgba(26,79,196,.09)', color:'var(--blue)', border:'1px solid var(--bdrb)', borderRadius:'var(--pill)', padding:'5px 13px', fontSize:11, fontWeight:700, cursor:'pointer' }} onClick={() => onToast('🔐 Toutes les sessions terminées', 'w')}><i className="fas fa-right-from-bracket" /> Déconnecter tout</button>}
      >
        {SESSIONS.map(session => (
          <div key={session.nm} className={s.item} style={{ border:'none', borderBottom:'1px solid var(--bdr)', borderRadius:0, padding:'12px 0' }}>
            <div className={s.itemIco} style={{ background:'rgba(26,79,196,.09)', borderRadius:10 }}><i className={`fas ${session.ic}`} style={{ color:'var(--blue)' }} /></div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--navy)' }}>
                {session.nm}
                {session.cur && <span className={`${s.badge} ${s.green}`} style={{ marginLeft:8, fontSize:10, verticalAlign:'middle' }}>Session actuelle</span>}
              </div>
              <div style={{ fontSize:11, color:'var(--t3)', marginTop:3 }}>{session.sub}</div>
            </div>
            {!session.cur && <button className={`${s.itemBtn} ${s.itemBtnDanger}`} onClick={() => onToast('🔐 Session terminée', 'w')}>Révoquer</button>}
          </div>
        ))}
      </FormCard>
    </>
  );
}
