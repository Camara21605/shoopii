// pages/RetoursPage.tsx
import React from 'react';
import { RETOURS, fmtGNF } from '../data/correspondantData';
import { pop } from '../components/Toast';
import sh from '../styles/Shared.module.css';

export default function RetoursPage() {
  return (
    <div className={sh.page}>
      <div className={sh.card} style={{ marginBottom:0 }}>
        <div className={sh.ch}><div className={sh.chT}><i className="fas fa-rotate-left" /> Retours & Litiges</div></div>
        <div className={sh.cb}>
          {RETOURS.map(r => (
            <div key={r.id} style={{ display:'flex', alignItems:'flex-start', gap:14, padding:'14px 0', borderBottom:'1px solid var(--bdr)', cursor:'pointer' }}
                 onClick={() => pop(`↩️ Dossier ${r.id}`, 'i')}>
              <div style={{ width:44, height:44, borderRadius:12, background:'rgba(220,38,38,.07)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{r.em}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:'var(--fd)', fontSize:13, fontWeight:700, color:'var(--navy)' }}>{r.nm}</div>
                <div style={{ fontSize:11, color:'var(--t3)', margin:'3px 0 5px', display:'flex', gap:10, flexWrap:'wrap' }}>
                  <span><i className="fas fa-store" /> {r.boutique}</span>
                  <span><i className="fas fa-user" /> {r.client}</span>
                </div>
                <div style={{ fontSize:11, background:'rgba(220,38,38,.06)', color:'#DC2626', padding:'4px 10px', borderRadius:8, display:'inline-flex', alignItems:'center', gap:5 }}>
                  <i className="fas fa-circle-exclamation" /> Motif : {r.motif}
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontFamily:'var(--fd)', fontSize:13, fontWeight:800, color:'var(--navy)' }}>{fmtGNF(r.valeur)}</div>
                <div style={{ fontSize:10, color:'var(--t4)', marginTop:2 }}>{r.date}</div>
                <span style={{ display:'inline-block', marginTop:6, fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:'var(--pill)',
                  background: r.status==='litige' ? 'rgba(220,38,38,.1)' : 'rgba(180,83,9,.09)',
                  color: r.status==='litige' ? '#DC2626' : '#B45309' }}>
                  {r.status === 'litige' ? '⚠️ Litige' : '⏳ En attente'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}