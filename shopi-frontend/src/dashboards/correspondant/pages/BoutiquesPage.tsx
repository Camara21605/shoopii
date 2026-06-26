// pages/BoutiquesPage.tsx
import React from 'react';
import { BOUTIQUES } from '../data/correspondantData';
import { pop } from '../components/Toast';
import sh from '../styles/Shared.module.css';

export default function BoutiquesPage() {
  return (
    <div className={sh.page}>
      <div className={sh.g3r} style={{ marginBottom:0 }}>
        <div>
          <div style={{ fontFamily:'var(--fd)', fontSize:16, fontWeight:700, color:'var(--navy)', marginBottom:14 }}>Boutiques partenaires</div>
          <div className={sh.entityList}>
            {BOUTIQUES.map(b => (
              <div key={b.nm} className={sh.entityItem} onClick={() => pop(`🏪 ${b.nm}`, 'i')}>
                <div className={sh.entityLogo}>{b.em}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div className={sh.entityNm}>{b.nm}</div>
                  <div className={sh.entityMeta}>
                    <span>{b.cat}</span>
                    <span><i className="fas fa-star" style={{ color:'#F59E0B' }} /> {b.rat}</span>
                    <span><i className="fas fa-calendar" /> Depuis {b.since}</span>
                  </div>
                </div>
                <div className={sh.entityRight}>
                  <div className={sh.entityStat}>{b.colis}</div>
                  <div className={sh.entityStatL}>colis actifs</div>
                  <span className={`${sh.eb} ${b.pending > 0 ? sh.ebPend : sh.ebOk}`}>
                    {b.pending > 0 ? `${b.pending} en attente` : '✓ À jour'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={sh.card} style={{ marginBottom:0, height:'fit-content' }}>
          <div className={sh.ch}><div className={sh.chT}><i className="fas fa-chart-bar" /> Statistiques</div></div>
          <div className={sh.cb}>
            {[{lbl:'Total boutiques',val:'4',ic:'fa-store'},{lbl:'Colis actifs',val:'14',ic:'fa-box'},{lbl:'En attente',val:'3',ic:'fa-clock'},{lbl:'Note moy.',val:'4.75 ⭐',ic:'fa-star'}].map(s => (
              <div key={s.lbl} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderBottom:'1px solid var(--bdr)' }}>
                <div style={{ width:34, height:34, borderRadius:9, background:'rgba(180,83,9,.09)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <i className={`fas ${s.ic}`} style={{ color:'#B45309', fontSize:13 }} />
                </div>
                <div style={{ flex:1 }}><div style={{ fontSize:12, color:'var(--t2)' }}>{s.lbl}</div></div>
                <div style={{ fontFamily:'var(--fd)', fontSize:15, fontWeight:800, color:'var(--navy)' }}>{s.val}</div>
              </div>
            ))}
            <button onClick={() => pop('📬 Invitation boutique envoyée', 's')} style={{
              width:'100%', marginTop:14, background:'var(--cor,#B45309)', color:'#fff', border:'none',
              borderRadius:'var(--pill)', padding:'11px', fontSize:12, fontWeight:700, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:7,
            }}>
              <i className="fas fa-plus" /> Inviter une boutique
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}