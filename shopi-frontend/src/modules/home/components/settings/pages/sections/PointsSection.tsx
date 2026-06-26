
/* ================================================================
 * src/modules/home/components/settings/sections/PointsSection.tsx
 * CONNECTÉ — GET /client/parametres/points
 * ================================================================ */

import React, { useState, useEffect, useRef } from 'react';
import { settingsApi, type PointsData } from '../../api/settings.api';

export function PointsSection() {
  const [pts,     setPts]     = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    settingsApi.getPoints()
      .then(data => {
        setPts(data);
        setTimeout(() => {
          if (fillRef.current) fillRef.current.style.width = `${data.progression}%`;
        }, 300);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !pts) return (
    <div style={{ background:'linear-gradient(135deg,var(--navy),#183358)', borderRadius:'var(--r-xl)', padding:28, marginBottom:20 }}>
      <div style={{ color:'rgba(200,217,248,.4)', textAlign:'center', padding:24 }}>
        <i className="fas fa-circle-notch fa-spin" style={{ fontSize:24 }} />
      </div>
    </div>
  );

  return (
    <div style={{
      background:'linear-gradient(135deg,var(--navy),#183358)',
      borderRadius:'var(--r-xl)', padding:28, marginBottom:20,
      position:'relative', overflow:'hidden',
    }}>
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 60% 80% at 90% 20%,rgba(59,114,240,.25),transparent 60%)', pointerEvents:'none' }} />
      <div style={{ position:'relative', zIndex:1 }}>
        <div style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'1.2px', color:'rgba(200,217,248,.55)', marginBottom:8 }}>Mes Shopi Points</div>
        <div style={{ fontFamily:'var(--fd)', fontSize:48, fontWeight:800, color:'#fff', lineHeight:1, marginBottom:4 }}>
          {pts.points.toLocaleString('fr-FR')} <span style={{ fontSize:18, fontWeight:400, color:'rgba(200,217,248,.55)' }}>pts</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'rgba(200,217,248,.55)', marginBottom:7 }}>
          <span>Niveau {pts.niveau} · {pts.points.toLocaleString('fr-FR')} pts</span>
          {pts.prochainNiveau && <span>{pts.prochainNiveau} à {pts.seuilProchain?.toLocaleString('fr-FR')} pts</span>}
        </div>
        <div style={{ height:6, background:'rgba(255,255,255,.12)', borderRadius:3, overflow:'hidden', marginBottom:18 }}>
          <div ref={fillRef} style={{ height:'100%', background:'linear-gradient(90deg,var(--blue-2),var(--blue-lt))', borderRadius:3, width:0, transition:'width .8s var(--ease)' }} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
          {[
            { v: pts.pointsGagnes,   l:'Points gagnés ce mois' },
            { v: pts.pointsUtilises, l:'Points utilisés' },
            { v: pts.expirationProchaine ?? '—', l:'Expiration prochaine' },
          ].map((st, i) => (
            <div key={i} style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:'var(--r-md)', padding:12 }}>
              <div style={{ fontFamily:'var(--fd)', fontSize:16, fontWeight:700, color:'#fff' }}>{typeof st.v === 'number' ? st.v.toLocaleString('fr-FR') : st.v}</div>
              <div style={{ fontSize:10, color:'rgba(200,217,248,.45)', marginTop:1 }}>{st.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PointsSection;