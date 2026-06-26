// src/dashboards/livreur/pages/RevenusPage.tsx
import React from 'react';
import { TRANSACTIONS, SPEED_LABEL, SPEED_CLASS, fmtGNF } from '../data/livreurData';
import shared from '../styles/Shared.module.css';

interface Props { onPop:(m:string,t?:string)=>void; }

const STATS = [
  { bg:'var(--tl-bg)',c:'var(--teal)',   ic:'fa-motorcycle',        ttl:'CA total Jan.',    val:'145 250 000 GNF', trend:'+23%', up:true  },
  { bg:'var(--em-bg)',c:'var(--emerald)',ic:'fa-hand-holding-dollar',ttl:'Revenus nets',     val:'132 118 750 GNF', trend:'+21%', up:true  },
  { bg:'var(--sky-2)',c:'var(--blue)',   ic:'fa-clock',              ttl:'Temps moyen',      val:'28 min / livraison', trend:'-8%', up:false },
  { bg:'var(--am-bg)',c:'var(--amber)', ic:'fa-box',                 ttl:'Total livraisons', val:'1 240 missions',  trend:'+18%', up:true  },
];
const SPEED_STATS = [
  { l:'🐢 Éco',      nb:8,  c:'var(--blue)',    ca:96000  },
  { l:'🚴 Standard', nb:18, c:'var(--emerald)', ca:396000 },
  { l:'🚀 Express',  nb:11, c:'var(--amber)',   ca:396000 },
  { l:'⚡ Ultra',    nb:5,  c:'var(--red)',     ca:200000 },
];

export default function RevenusPage({ onPop }: Props) {
  return (
    <div className={shared.page}>
      <div className={shared.g4} style={{ marginBottom:20 }}>
        {STATS.map((s,i) => (
          <div key={i} className={`${shared.kpi} ${shared.cardLast}`}>
            <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:12 }}>
              <div style={{ width:38,height:38,borderRadius:10,background:s.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                <i className={`fas ${s.ic}`} style={{ color:s.c,fontSize:15 }} />
              </div>
              <span className={`${shared.kpiBadge} ${s.up?shared.badgeUp:shared.badgeDn}`}><i className={`fas fa-arrow-trend-${s.up?'up':'down'}`} /> {s.trend}</span>
            </div>
            <div style={{ fontSize:11,color:'var(--t3)',textTransform:'uppercase',letterSpacing:.5,marginBottom:4 }}>{s.ttl}</div>
            <div style={{ fontFamily:'var(--fd)',fontSize:16,fontWeight:800,color:'var(--navy)',letterSpacing:-.3 }}>{s.val}</div>
          </div>
        ))}
      </div>
      <div className={shared.g2}>
        <div className={`${shared.card} ${shared.cardLast}`}>
          <div className={shared.ch}><div className={shared.chT}><i className="fas fa-chart-bar" /> Revenus par vitesse</div></div>
          <div className={shared.cb}>
            {SPEED_STATS.map((s,i) => (
              <div key={i} style={{ display:'flex',alignItems:'center',gap:11,padding:'10px 0',borderBottom:'1px solid var(--bdr)' }}>
                <div style={{ fontSize:18,flexShrink:0,width:24,textAlign:'center' }}>{s.l.split(' ')[0]}</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:12,fontWeight:700,color:'var(--navy)',marginBottom:4 }}>{s.l}</div>
                  <div style={{ background:'var(--g200)',borderRadius:'var(--pill)',height:5,overflow:'hidden' }}>
                    <div style={{ width:`${Math.round(s.nb/42*100)}%`,height:'100%',background:s.c,borderRadius:'var(--pill)' }} />
                  </div>
                </div>
                <div style={{ textAlign:'right',flexShrink:0,minWidth:80 }}>
                  <div style={{ fontSize:11,fontWeight:700,color:s.c }}>{s.nb} livr.</div>
                  <div style={{ fontSize:10,color:'var(--t3)' }}>{fmtGNF(s.ca)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={`${shared.card} ${shared.cardLast}`}>
          <div className={shared.ch}><div className={shared.chT}><i className="fas fa-list" /> Dernières transactions</div></div>
          <div className={shared.cb}>
            {TRANSACTIONS.map((tx,i) => (
              <div key={i} className={shared.txItem}>
                <div className={shared.txIc} style={{ background:tx.bg }}><i className={`fas ${tx.ic}`} style={{ color:tx.c,fontSize:12 }} /></div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:12,fontWeight:600,color:'var(--navy)' }}>{tx.nm}</div>
                  <div style={{ fontSize:10,color:'var(--t3)',marginTop:1 }}>{tx.date}</div>
                </div>
                <div style={{ fontFamily:'var(--fd)',fontSize:13,fontWeight:800,color:tx.type==='in'?'var(--emerald)':'var(--red)',flexShrink:0 }}>
                  {tx.type==='in'?'+':'-'}{fmtGNF(tx.amt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}