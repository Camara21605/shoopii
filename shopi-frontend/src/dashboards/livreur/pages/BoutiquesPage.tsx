// src/dashboards/livreur/pages/BoutiquesPage.tsx
import React from 'react';
import { BOUTIQUES, fmtGNF } from '../data/livreurData';
import shared from '../styles/Shared.module.css';

interface Props { onPop: (m:string,t?:string)=>void; }

export default function BoutiquesPage({ onPop }: Props) {
  const total = BOUTIQUES.reduce((a,b) => a+b.delivs, 0);
  return (
    <div className={shared.page}>
      <div className={shared.g2}>
        <div>
          <div style={{ fontFamily:'var(--fd)',fontSize:16,fontWeight:700,color:'var(--navy)',marginBottom:14 }}>Boutiques partenaires</div>
          <div style={{ display:'flex',flexDirection:'column',gap:9 }}>
            {BOUTIQUES.map((b,i) => (
              <div key={i} style={{ display:'flex',alignItems:'center',gap:11,padding:'12px 14px',background:'var(--g50)',border:'1px solid var(--bdr)',borderRadius:'var(--r-lg)',cursor:'pointer',transition:'all .2s' }}
                onClick={() => onPop(`🏪 ${b.nm}`,'i')}
              >
                <div style={{ width:40,height:40,borderRadius:11,background:'linear-gradient(135deg,#EEF3FD,#D6E4F8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,flexShrink:0 }}>{b.em}</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontFamily:'var(--fd)',fontSize:13,fontWeight:700,color:'var(--navy)' }}>{b.nm}</div>
                  <div style={{ display:'flex',alignItems:'center',gap:7,fontSize:10,color:'var(--t3)',marginTop:2,flexWrap:'wrap' }}>
                    <span>{b.cat}</span>
                    <span><i className="fas fa-star" style={{color:'var(--amber)'}} /> {b.rat}</span>
                    <span>Depuis {b.since}</span>
                    {b.pending>0 && <span style={{background:'var(--am-bg)',color:'var(--amber)',fontWeight:700,padding:'1px 7px',borderRadius:'var(--pill)'}}>{b.pending} en attente</span>}
                  </div>
                </div>
                <div style={{ textAlign:'right',flexShrink:0 }}>
                  <div style={{ fontFamily:'var(--fd)',fontSize:14,fontWeight:800,color:'var(--blue)' }}>{b.delivs}</div>
                  <div style={{ fontSize:9,color:'var(--t3)' }}>livr.</div>
                </div>
                <button onClick={e=>{e.stopPropagation();onPop(`💬 Message à ${b.nm}`,'i');}} style={{ background:'var(--sky)',color:'var(--blue)',border:'1px solid var(--sky-3)',borderRadius:'var(--pill)',padding:'6px 11px',fontSize:10,fontWeight:700,cursor:'pointer' }}>Message</button>
              </div>
            ))}
          </div>
        </div>
        <div className={`${shared.card} ${shared.cardLast}`}>
          <div className={shared.ch}><div className={shared.chT}><i className="fas fa-chart-pie" /> Répartition</div></div>
          <div className={shared.cb}>
            {BOUTIQUES.map((b,i) => {
              const pct = Math.round((b.delivs/total)*100);
              return (
                <div key={i} style={{ marginBottom:12 }}>
                  <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:12,marginBottom:5 }}>
                    <span style={{ fontWeight:600,color:'var(--navy)',display:'flex',alignItems:'center',gap:6 }}>{b.em} {b.nm}</span>
                    <span style={{ fontWeight:700,color:'var(--teal)' }}>{pct}%</span>
                  </div>
                  <div style={{ background:'var(--g100)',borderRadius:'var(--pill)',height:7,overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`,height:'100%',background:'var(--teal)',borderRadius:'var(--pill)' }} />
                  </div>
                </div>
              );
            })}
            <div style={{ paddingTop:11,borderTop:'1px solid var(--bdr)',fontSize:12,color:'var(--t2)',display:'flex',justifyContent:'space-between' }}>
              <span>Total</span>
              <strong style={{ color:'var(--navy)',fontFamily:'var(--fd)' }}>{total} livraisons</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}