// pages/RevenusPage.tsx
import React, { useState } from 'react';
import { REV_WEEK, REV_MONTH, fmtGNF, fmtMini } from '../data/correspondantData';
import sh from '../styles/Shared.module.css';

export default function RevenusPage() {
  const [mode, setMode] = useState<'sem'|'mois'>('mois');
  const data = mode === 'sem' ? REV_WEEK : REV_MONTH;
  const max  = Math.max(...data.map(d => d.v));
  const total = data.reduce((a,d)=>a+d.v,0);
  return (
    <div className={sh.page}>
      <div className={sh.g2}>
        <div className={sh.card} style={{ marginBottom:0 }}>
          <div className={sh.ch}>
            <div className={sh.chT}><i className="fas fa-chart-line" /> Revenus</div>
            <div style={{ display:'flex', gap:4, background:'var(--g100)', borderRadius:10, padding:3 }}>
              {(['sem','mois'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  background:mode===m?'#fff':'transparent', border:'none', borderRadius:8,
                  padding:'5px 12px', fontSize:12, fontWeight:mode===m?700:600,
                  color:mode===m?'var(--navy)':'var(--t2)', cursor:'pointer',
                  boxShadow:mode===m?'0 1px 3px rgba(11,31,58,.06)':'none',
                }}>{m==='sem'?'Semaine':'Mois'}</button>
              ))}
            </div>
          </div>
          <div className={sh.cb}>
            <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:130, marginBottom:12 }}>
              {data.map((d,i) => (
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                  <div style={{ width:'100%', borderRadius:'5px 5px 0 0', minHeight:4, position:'relative', cursor:'pointer',
                    height: Math.max(4, Math.round((d.v/max)*120)),
                    background: d.today ? 'linear-gradient(180deg,#B45309,rgba(180,83,9,.5))' : 'linear-gradient(180deg,rgba(245,158,11,.3),rgba(180,83,9,.1))',
                  }} />
                  <div style={{ fontSize:9, color:d.today?'#B45309':'var(--t3)', fontWeight:d.today?700:400 }}>{d.j}</div>
                </div>
              ))}
            </div>
            <div style={{ padding:'10px 0', borderTop:'1px solid var(--bdr)', display:'flex', justifyContent:'space-between', fontSize:12 }}>
              <span>Total : <strong style={{ fontFamily:'var(--fd)', color:'var(--navy)' }}>{fmtGNF(total)}</strong></span>
              <span style={{ color:'#B45309', fontWeight:700 }}>Moy. : {fmtGNF(Math.round(total/data.length))}</span>
            </div>
          </div>
        </div>

        <div>
          {[{lbl:'Revenus ce mois',val:'730 000 GNF',sub:'+18% vs mois dernier',ic:'fa-coins',c:'#B45309'},
            {lbl:'Revenus cette semaine',val:'364 000 GNF',sub:'+38 000 GNF aujourd\'hui',ic:'fa-chart-line',c:'#047857'},
            {lbl:'Commission Shopi (5%)',val:'36 500 GNF',sub:'Déduit automatiquement',ic:'fa-percent',c:'#0E7490'},
          ].map(item => (
            <div key={item.lbl} className={sh.card} style={{ padding:18, marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:44, height:44, borderRadius:12, background:`rgba(180,83,9,.09)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <i className={`fas ${item.ic}`} style={{ color:item.c, fontSize:18 }} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:'var(--t3)', marginBottom:3 }}>{item.lbl}</div>
                  <div style={{ fontFamily:'var(--fd)', fontSize:20, fontWeight:800, color:'var(--navy)', letterSpacing:'-.5px' }}>{item.val}</div>
                  <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{item.sub}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}