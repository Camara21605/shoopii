// pages/LivreursPage.tsx
import React from 'react';
import { LIVREURS } from '../data/correspondantData';
import { pop } from '../components/Toast';
import sh from '../styles/Shared.module.css';

export default function LivreursPage() {
  const online = LIVREURS.filter(l => l.online).length;
  return (
    <div className={sh.page}>
      <div className={sh.g3r} style={{ marginBottom:0 }}>
        <div>
          <div style={{ fontFamily:'var(--fd)', fontSize:16, fontWeight:700, color:'var(--navy)', marginBottom:14 }}>
            Livreurs locaux abonnés
          </div>
          <div className={sh.entityList}>
            {LIVREURS.map(l => (
              <div key={l.nm} className={sh.entityItem} onClick={() => pop(`🛵 ${l.nm}`, 'i')}>
                <div className={sh.entityLogo} style={{ position:'relative' }}>
                  {l.em}
                  {l.online && (
                    <div style={{ position:'absolute', bottom:2, right:2, width:9, height:9, borderRadius:'50%', background:'#10B981', border:'2px solid #fff' }} />
                  )}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div className={sh.entityNm}>{l.nm}</div>
                  <div className={sh.entityMeta}>
                    <span><i className="fas fa-map-pin" /> {l.zone}</span>
                    <span style={{ color:l.online ? '#047857':'var(--t3)', fontWeight:600 }}>
                      <i className={`fas ${l.online ? 'fa-circle':'fa-moon'}`} />
                      {l.online ? ' En ligne' : ' Hors ligne'}
                    </span>
                  </div>
                </div>
                <div className={sh.entityRight}>
                  <div className={sh.entityStat}>{l.rat} ⭐</div>
                  <div className={sh.entityStatL}>{l.missions} missions</div>
                  {l.pending > 0 && <span className={`${sh.eb} ${sh.ebPend}`}>{l.pending} en cours</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={sh.card} style={{ marginBottom:0, height:'fit-content' }}>
          <div className={sh.ch}><div className={sh.chT}><i className="fas fa-chart-bar" /> Disponibilité</div></div>
          <div className={sh.cb}>
            <div style={{ textAlign:'center', padding:'12px 0 16px' }}>
              <div style={{ fontFamily:'var(--fd)', fontSize:40, fontWeight:800, color:'#B45309', letterSpacing:'-2px' }}>{online}</div>
              <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>livreurs en ligne sur {LIVREURS.length}</div>
              <div style={{ marginTop:10, height:8, background:'var(--g200)', borderRadius:'var(--pill)', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${Math.round((online/LIVREURS.length)*100)}%`, background:'linear-gradient(90deg,#B45309,#F59E0B)', borderRadius:'var(--pill)', transition:'width 1s' }} />
              </div>
            </div>
            {[{lbl:'Total livreurs',val:LIVREURS.length},{lbl:'En ligne',val:online},{lbl:'Missions ce mois',val:LIVREURS.reduce((a,l)=>a+l.missions,0)}].map(s => (
              <div key={s.lbl} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderTop:'1px solid var(--bdr)', fontSize:12 }}>
                <span style={{ color:'var(--t2)' }}>{s.lbl}</span>
                <strong style={{ fontFamily:'var(--fd)', color:'var(--navy)' }}>{s.val}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}