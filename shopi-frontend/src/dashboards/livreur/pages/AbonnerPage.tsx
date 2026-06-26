// src/dashboards/livreur/pages/AbonnerPage.tsx
import React, { useState } from 'react';
import shared from '../styles/Shared.module.css';

interface Props { onPop:(m:string,t?:string)=>void; }

export default function AbonnerPage({ onPop }: Props) {
  const [code, setCode] = useState('');
  const join = () => {
    if (!code.trim()) { onPop('⚠️ Entrez un code boutique','w'); return; }
    onPop(`✅ Abonné avec succès via le code ${code.toUpperCase()} !`,'s');
    setCode('');
  };
  return (
    <div className={shared.page}>
      <div className={shared.card} style={{ maxWidth:520, margin:'0 auto', marginBottom:0 }}>
        <div className={shared.ch}><div className={shared.chT}><i className="fas fa-plus-circle" /> Rejoindre une boutique</div></div>
        <div className={shared.cb}>
          {/* Mon code livreur */}
          <div style={{ background:'var(--tl-bg)',border:'1.5px solid rgba(14,116,144,.22)',borderRadius:'var(--r-xl)',padding:18,marginBottom:14 }}>
            <div style={{ fontFamily:'var(--fd)',fontSize:13,fontWeight:700,color:'var(--teal)',marginBottom:10,display:'flex',alignItems:'center',gap:7 }}>
              <i className="fas fa-key" /> Mon code livreur
            </div>
            <div style={{ display:'flex',alignItems:'center',gap:10,background:'var(--white)',border:'1px solid rgba(14,116,144,.2)',borderRadius:'var(--r-md)',padding:'12px 14px',marginBottom:10 }}>
              <div style={{ fontFamily:'var(--fd)',fontSize:20,fontWeight:800,color:'var(--navy)',letterSpacing:4,flex:1 }}>LV-MD24</div>
              <button onClick={() => onPop('📋 Code copié !','s')} style={{ background:'var(--teal)',color:'#fff',border:'none',borderRadius:'var(--r-sm)',padding:'7px 16px',fontSize:11,fontWeight:700,cursor:'pointer' }}>Copier</button>
            </div>
            <div style={{ fontSize:11,color:'var(--t2)',display:'flex',alignItems:'flex-start',gap:6,lineHeight:1.5 }}>
              <i className="fas fa-circle-info" style={{ color:'var(--teal)',flexShrink:0,marginTop:1 }} />
              Partagez ce code avec une boutique pour y être automatiquement lié comme livreur.
            </div>
          </div>
          {/* Code invitation */}
          <div style={{ paddingTop:16,borderTop:'1px solid var(--bdr)' }}>
            <div style={{ fontSize:13,fontWeight:700,color:'var(--navy)',marginBottom:11 }}>Ou entrez un code d'invitation</div>
            <div style={{ display:'flex',gap:9,marginBottom:9 }}>
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="Code boutique (ex: TC-SHOP7)"
                style={{ flex:1,background:'var(--g50)',border:'1.5px solid var(--bdr2)',borderRadius:'var(--r-md)',padding:'11px 14px',fontSize:13,color:'var(--t1)',outline:'none',letterSpacing:.8,fontFamily:'var(--fb)' }}
                onFocus={e => (e.target.style.borderColor='var(--teal)')}
                onBlur={e  => (e.target.style.borderColor='var(--bdr2)')}
              />
              <button onClick={join} style={{ background:'var(--teal)',color:'#fff',border:'none',borderRadius:'var(--r-md)',padding:'0 20px',fontSize:13,fontWeight:700,cursor:'pointer' }}>Rejoindre</button>
            </div>
            <div style={{ fontSize:11,color:'var(--t3)',display:'flex',alignItems:'flex-start',gap:6 }}>
              <i className="fas fa-circle-info" style={{ color:'var(--teal)',flexShrink:0,marginTop:1 }} />
              Le code est fourni par la boutique ou un partenaire Shopi.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}