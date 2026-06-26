// src/dashboards/livreur/pages/EvaluationPage.tsx
import React from 'react';
import { AVIS } from '../data/livreurData';
import shared from '../styles/Shared.module.css';

interface Props { onPop:(m:string,t?:string)=>void; }

const CRITERES = [
  ['Ponctualité',4.9],['Communication',4.8],['Colis protégé',5.0],['Professionnalisme',4.9],['Réactivité',4.8],
] as [string,number][];

export default function EvaluationPage({ onPop }: Props) {
  return (
    <div className={shared.page}>
      <div className={shared.g2}>
        <div className={`${shared.card} ${shared.cardLast}`}>
          <div className={shared.ch}><div className={shared.chT}><i className="fas fa-star" /> Mon évaluation</div></div>
          <div className={shared.cb}>
            {/* Note globale */}
            <div style={{ textAlign:'center',padding:'14px 0 18px' }}>
              <div style={{ fontFamily:'var(--fd)',fontSize:52,fontWeight:800,color:'var(--navy)',letterSpacing:-3,lineHeight:1 }}>4.9</div>
              <div style={{ fontSize:18,color:'var(--amber)',margin:'5px 0 4px',letterSpacing:-1 }}>★★★★★</div>
              <div style={{ fontSize:12,color:'var(--t3)' }}>248 avis · 97% satisfaction · <strong style={{ color:'var(--teal)' }}>Top 5% Shopi</strong></div>
            </div>
            {/* Barres par étoile */}
            {[[5,82],[4,12],[3,4],[2,1],[1,1]].map(([s,p]) => (
              <div key={s} style={{ display:'flex',alignItems:'center',gap:9,fontSize:12,marginBottom:7 }}>
                <span style={{ minWidth:18 }}>{s}★</span>
                <div style={{ flex:1,height:6,background:'var(--g200)',borderRadius:'var(--pill)',overflow:'hidden' }}>
                  <div style={{ width:`${p}%`,height:'100%',background:'var(--amber)',borderRadius:'var(--pill)' }} />
                </div>
                <span style={{ minWidth:24,textAlign:'right',fontSize:10,color:'var(--t3)' }}>{p}%</span>
              </div>
            ))}
            {/* Critères */}
            <div style={{ paddingTop:14,borderTop:'1px solid var(--bdr)',marginTop:8 }}>
              <div style={{ fontSize:11,fontWeight:800,color:'var(--t3)',textTransform:'uppercase',letterSpacing:.5,marginBottom:11 }}>Critères d'évaluation</div>
              {CRITERES.map(([l,v]) => (
                <div key={l} style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid var(--bdr)' }}>
                  <div style={{ fontSize:12,fontWeight:600,color:'var(--navy)',minWidth:118,flexShrink:0 }}>{l}</div>
                  <div style={{ flex:1,height:6,background:'var(--g200)',borderRadius:'var(--pill)',overflow:'hidden' }}>
                    <div style={{ width:`${(v/5)*100}%`,height:'100%',background:'linear-gradient(90deg,var(--teal),var(--tl-lt))',borderRadius:'var(--pill)' }} />
                  </div>
                  <div style={{ fontFamily:'var(--fd)',fontSize:12,fontWeight:800,color:'var(--navy)',minWidth:26,textAlign:'right' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={`${shared.card} ${shared.cardLast}`}>
          <div className={shared.ch}><div className={shared.chT}><i className="fas fa-comment" /> Avis des clients</div></div>
          <div className={shared.cb}>
            {AVIS.map((a,i) => (
              <div key={i} style={{ paddingBottom:14,borderBottom:i<AVIS.length-1?'1px solid var(--bdr)':'none',paddingTop:i>0?14:0 }}>
                <div style={{ display:'flex',alignItems:'center',gap:9,marginBottom:7 }}>
                  <div style={{ width:36,height:36,borderRadius:'50%',background:a.bg,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--fd)',fontSize:14,fontWeight:700,color:'var(--navy)',flexShrink:0 }}>{a.init}</div>
                  <div>
                    <div style={{ fontSize:13,fontWeight:700,color:'var(--navy)' }}>{a.nm}</div>
                    <div style={{ fontSize:10,color:'var(--t4)',marginTop:1 }}>{a.date}</div>
                  </div>
                  <div style={{ color:'var(--amber)',fontSize:12,marginLeft:'auto',letterSpacing:-1 }}>{'★'.repeat(a.stars)}{'☆'.repeat(5-a.stars)}</div>
                </div>
                <div style={{ fontSize:12,color:'var(--t2)',lineHeight:1.6,background:'var(--g50)',borderRadius:'var(--r-md)',padding:'9px 12px',marginBottom:7 }}>"{a.txt}"</div>
                <div style={{ display:'flex',gap:5,flexWrap:'wrap' }}>
                  {a.chips.map(c => (
                    <span key={c} style={{ fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:'var(--pill)',background:'var(--em-bg)',color:'var(--emerald)' }}>
                      <i className="fas fa-check" /> {c}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}