// pages/EvaluationPage.tsx
import React from 'react';
import { AVIS } from '../data/correspondantData';
import { pop } from '../components/Toast';
import sh from '../styles/Shared.module.css';

const CRITERIA = [
  { lbl:'Disponibilité',  pct:98  },
  { lbl:'Soin des colis', pct:100 },
  { lbl:'Communication',  pct:96  },
  { lbl:'Ponctualité',    pct:98  },
];

export default function EvaluationPage() {
  return (
    <div className={sh.page}>
      <div className={sh.g2} style={{ marginBottom:0 }}>
        <div className={sh.card} style={{ marginBottom:0 }}>
          <div className={sh.ch}><div className={sh.chT}><i className="fas fa-star" /> Mon évaluation</div></div>
          <div className={sh.cb}>
            <div style={{ textAlign:'center', padding:'14px 0 20px' }}>
              <div style={{ fontFamily:'var(--fd)', fontSize:52, fontWeight:800, color:'var(--navy)', letterSpacing:'-3px', lineHeight:1 }}>4.9</div>
              <div style={{ fontSize:18, color:'#F59E0B', margin:'5px 0 4px', letterSpacing:'-1px' }}>★★★★★</div>
              <div style={{ fontSize:12, color:'var(--t3)' }}>Basé sur 38 évaluations ce mois</div>
            </div>
            <div style={{ borderTop:'1px solid var(--bdr)', paddingTop:16 }}>
              {CRITERIA.map(c => (
                <div key={c.lbl} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--bdr)' }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--navy)', minWidth:120, flexShrink:0 }}>{c.lbl}</div>
                  <div style={{ flex:1, height:6, background:'var(--g200)', borderRadius:'var(--pill)', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${c.pct}%`, background:'linear-gradient(90deg,#B45309,#F59E0B)', borderRadius:'var(--pill)' }} />
                  </div>
                  <div style={{ fontFamily:'var(--fd)', fontSize:12, fontWeight:800, color:'var(--navy)', minWidth:26, textAlign:'right' }}>
                    {(c.pct / 20).toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={sh.card} style={{ marginBottom:0 }}>
          <div className={sh.ch}><div className={sh.chT}><i className="fas fa-comment" /> Avis reçus</div></div>
          <div className={sh.cb}>
            {AVIS.map((a, i) => (
              <div key={i} className={sh.avItem}>
                <div className={sh.avTop}>
                  <div className={sh.avAva} style={{ background:a.bg }}>{a.init}</div>
                  <div>
                    <div className={sh.avNm}>{a.nm}</div>
                    <div className={sh.avDate}>{a.date}</div>
                  </div>
                  <div className={sh.avStars}>{'★'.repeat(a.stars)}</div>
                </div>
                <div className={sh.avTxt}>{a.txt}</div>
                {a.replied && (
                  <div className={sh.avReply}>
                    <div className={sh.avReplyLbl}>Votre réponse</div>
                    <div className={sh.avReplyTxt}>Merci pour votre confiance. C'est un plaisir de vous servir !</div>
                  </div>
                )}
                {!a.replied && (
                  <button onClick={() => pop('💬 Rédaction de réponse…', 'i')} style={{
                    marginTop:8, background:'var(--cor-bg,rgba(180,83,9,.09))', color:'#B45309',
                    border:'1px solid rgba(180,83,9,.22)', borderRadius:8, padding:'6px 13px',
                    fontSize:11, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:5,
                  }}><i className="fas fa-reply" /> Répondre</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}