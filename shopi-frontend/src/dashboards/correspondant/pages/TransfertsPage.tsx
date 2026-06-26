// pages/TransfertsPage.tsx
import React from 'react';
import { TRANSFERTS, fmtGNF } from '../data/correspondantData';
import { pop } from '../components/Toast';
import sh from '../styles/Shared.module.css';

const STATUS_CFG = {
  'en-route':   { label:'🚀 En route',   bg:'rgba(14,116,144,.08)', c:'#0E7490' },
  'livre':      { label:'✅ Livré',      bg:'rgba(4,120,87,.08)',   c:'#047857' },
  'en-attente': { label:'⏳ En attente', bg:'rgba(180,83,9,.09)',   c:'#B45309' },
};

export default function TransfertsPage() {
  return (
    <div className={sh.page}>
      <div className={sh.card} style={{ marginBottom:16 }}>
        <div className={sh.ch}><div className={sh.chT}><i className="fas fa-arrows-rotate" /> Transferts en cours</div></div>
        <div className={sh.cb}>
          {TRANSFERTS.map(t => {
            const cfg = STATUS_CFG[t.status];
            return (
              <div key={t.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 0', borderBottom:'1px solid var(--bdr)', cursor:'pointer' }}
                   onClick={() => pop(`🚀 ${t.id} — ${t.colis}`, 'i')}>
                <div style={{ width:42, height:42, borderRadius:12, background:'rgba(14,116,144,.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>📦</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:'var(--fd)', fontSize:13, fontWeight:700, color:'var(--navy)' }}>{t.colis}</div>
                  <div style={{ fontSize:11, color:'var(--t3)', marginTop:2, display:'flex', gap:10, flexWrap:'wrap' }}>
                    <span><i className="fas fa-store" /> {t.from}</span>
                    <span style={{ color:'#B45309' }}><i className="fas fa-arrow-right" /></span>
                    <span><i className="fas fa-motorcycle" /> {t.to}</span>
                    <span><i className="fas fa-route" /> {t.dist}</span>
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontFamily:'var(--fd)', fontSize:13, fontWeight:800, color:'#B45309' }}>{fmtGNF(t.valeur)}</div>
                  <div style={{ fontSize:10, color:'var(--t4)', marginTop:2 }}>{t.date}</div>
                  <span style={{ display:'inline-block', marginTop:4, fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:'var(--pill)', background:cfg.bg, color:cfg.c }}>
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}