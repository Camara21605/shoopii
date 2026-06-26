// pages/ZonePage.tsx
import React from 'react';
import { pop } from '../components/Toast';
import sh from '../styles/Shared.module.css';

const COMMUNES = ['Kaloum','Dixinn','Matam','Ratoma','Matoto','Conakry Centre'];
const STATS = [
  { commune:'Kaloum',       colis:5,  livreurs:2, succes:'98%' },
  { commune:'Dixinn',       colis:3,  livreurs:2, succes:'95%' },
  { commune:'Matam',        colis:2,  livreurs:1, succes:'100%'},
  { commune:'Ratoma',       colis:2,  livreurs:1, succes:'90%' },
  { commune:'Matoto',       colis:1,  livreurs:1, succes:'92%' },
  { commune:'Conakry Centre',colis:1, livreurs:0, succes:'—'   },
];

export default function ZonePage() {
  return (
    <div className={sh.page}>
      <div className={sh.g2} style={{ marginBottom:0 }}>
        <div className={sh.card} style={{ marginBottom:0 }}>
          <div className={sh.ch}><div className={sh.chT}><i className="fas fa-map-location-dot" /> Ma zone de couverture</div></div>
          <div className={sh.cb}>
            <div className={sh.zoneMap}>
              <div style={{ fontFamily:'var(--fd)', fontSize:16, fontWeight:700, color:'var(--navy)', position:'relative', zIndex:1 }}>
                📍 Conakry · Régional
              </div>
              <div className={sh.zonePills}>
                {COMMUNES.map(c => (
                  <div key={c} className={sh.zonePill} onClick={() => pop(`📍 ${c}`, 'i')}>{c}</div>
                ))}
              </div>
              <div style={{ position:'relative', zIndex:1, fontSize:11, color:'var(--t3)', textAlign:'center' }}>
                Couverture : 6 communes · ~200 km²
              </div>
            </div>
            <div style={{ marginTop:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--navy)', marginBottom:10 }}>Performances par commune</div>
              {STATS.map(s => (
                <div key={s.commune} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 0', borderBottom:'1px solid var(--bdr)' }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:'#B45309', flexShrink:0 }} />
                  <div style={{ flex:1, fontSize:12, color:'var(--navy)', fontWeight:500 }}>{s.commune}</div>
                  <span style={{ fontSize:11, color:'var(--t3)' }}>{s.colis} colis</span>
                  <span style={{ fontSize:11, color:'#0E7490' }}>{s.livreurs} livreurs</span>
                  <span style={{ fontSize:11, fontWeight:700, color:'#047857' }}>{s.succes}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={sh.card} style={{ marginBottom:0 }}>
          <div className={sh.ch}><div className={sh.chT}><i className="fas fa-chart-bar" /> Stats globales</div></div>
          <div className={sh.cb}>
            {[{lbl:'Communes couvertes',val:'6',ic:'fa-map-pin'},{lbl:'Surface estimée',val:'~200 km²',ic:'fa-ruler'},{lbl:'Livreurs actifs',val:'7',ic:'fa-motorcycle'},{lbl:'Taux couverture',val:'92%',ic:'fa-check-circle'}].map(s => (
              <div key={s.lbl} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:'1px solid var(--bdr)' }}>
                <div style={{ width:36, height:36, borderRadius:9, background:'rgba(180,83,9,.09)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <i className={`fas ${s.ic}`} style={{ color:'#B45309', fontSize:13 }} />
                </div>
                <div style={{ flex:1, fontSize:12, color:'var(--t2)' }}>{s.lbl}</div>
                <div style={{ fontFamily:'var(--fd)', fontSize:16, fontWeight:800, color:'var(--navy)' }}>{s.val}</div>
              </div>
            ))}
            <button onClick={() => pop('🗺️ Demande d\'extension de zone envoyée', 's')} style={{
              width:'100%', marginTop:14, background:'var(--cor,#B45309)', color:'#fff', border:'none',
              borderRadius:'var(--pill)', padding:'11px', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7,
            }}><i className="fas fa-expand" /> Demander une extension</button>
          </div>
        </div>
      </div>
    </div>
  );
}