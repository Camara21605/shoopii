// pages/ZonePage.tsx
import { useState, useEffect } from 'react';
import { pop } from '../components/Toast';
import sh from '../styles/Shared.module.css';
import { apiFetch } from '@/shared/services/apiFetch';

interface CommuneStat { commune: string; colis: number; livreurs: number; succes: string }
interface ZoneResult {
  typeCorrespondant: string;
  zonesActives: string[];
  communes: CommuneStat[];
  stats: { communesCouvertes: number; livreursActifs: number; tauxCouverture: string };
}

const TYPE_LABEL: Record<string, string> = {
  regional: 'Régional', zonal: 'Zonal', national: 'National',
};

const EMPTY: ZoneResult = {
  typeCorrespondant: 'regional', zonesActives: [], communes: [],
  stats: { communesCouvertes: 0, livreursActifs: 0, tauxCouverture: '—' },
};

export default function ZonePage() {
  const [data, setData]       = useState<ZoneResult>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<ZoneResult>('/dashboard/correspondant/zone')
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={sh.page}>
      <div className={sh.g2} style={{ marginBottom:0 }}>
        <div className={sh.card} style={{ marginBottom:0 }}>
          <div className={sh.ch}><div className={sh.chT}><i className="fas fa-map-location-dot" /> Ma zone de couverture</div></div>
          <div className={sh.cb}>
            <div className={sh.zoneMap}>
              <div style={{ fontFamily:'var(--fd)', fontSize:16, fontWeight:700, color:'var(--navy)', position:'relative', zIndex:1 }}>
                📍 {TYPE_LABEL[data.typeCorrespondant] ?? data.typeCorrespondant}
              </div>
              <div className={sh.zonePills}>
                {data.zonesActives.length === 0 && (
                  <span style={{ fontSize:11, color:'var(--t3)' }}>Aucune zone déclarée — configurez-la dans Paramètres.</span>
                )}
                {data.zonesActives.map(c => (
                  <div key={c} className={sh.zonePill} onClick={() => pop(`📍 ${c}`, 'i')}>{c}</div>
                ))}
              </div>
              <div style={{ position:'relative', zIndex:1, fontSize:11, color:'var(--t3)', textAlign:'center' }}>
                Couverture : {data.stats.communesCouvertes} commune{data.stats.communesCouvertes > 1 ? 's' : ''}
              </div>
            </div>
            <div style={{ marginTop:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--navy)', marginBottom:10 }}>Performances par commune</div>
              {loading && <div style={{ padding:'12px 0', color:'var(--t3)' }}>Chargement…</div>}
              {!loading && data.communes.length === 0 && (
                <div style={{ padding:'12px 0', color:'var(--t3)' }}>Aucune commande encore livrée dans cette zone.</div>
              )}
              {data.communes.map(s => (
                <div key={s.commune} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 0', borderBottom:'1px solid var(--bdr)' }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--t2)', flexShrink:0 }} />
                  <div style={{ flex:1, fontSize:12, color:'var(--navy)', fontWeight:500 }}>{s.commune}</div>
                  <span style={{ fontSize:11, color:'var(--t3)' }}>{s.colis} colis</span>
                  <span style={{ fontSize:11, color:'var(--t2)' }}>{s.livreurs} livreurs</span>
                  <span style={{ fontSize:11, fontWeight:700, color:'var(--t1)' }}>{s.succes}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={sh.card} style={{ marginBottom:0 }}>
          <div className={sh.ch}><div className={sh.chT}><i className="fas fa-chart-bar" /> Stats globales</div></div>
          <div className={sh.cb}>
            {[
              { lbl:'Communes couvertes', val:String(data.stats.communesCouvertes), ic:'fa-map-pin' },
              { lbl:'Livreurs actifs',    val:String(data.stats.livreursActifs),    ic:'fa-motorcycle' },
              { lbl:'Taux couverture',    val:data.stats.tauxCouverture,            ic:'fa-check-circle' },
            ].map(s => (
              <div key={s.lbl} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:'1px solid var(--bdr)' }}>
                <div style={{ width:36, height:36, borderRadius:9, background:'var(--g100)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <i className={`fas ${s.ic}`} style={{ color:'var(--t2)', fontSize:13 }} />
                </div>
                <div style={{ flex:1, fontSize:12, color:'var(--t2)' }}>{s.lbl}</div>
                <div style={{ fontFamily:'var(--fd)', fontSize:16, fontWeight:800, color:'var(--navy)' }}>{s.val}</div>
              </div>
            ))}
            <button onClick={() => pop('🗺️ Demande d\'extension de zone envoyée', 's')} style={{
              width:'100%', marginTop:14, background:'var(--btn,#111113)', color:'#fff', border:'none',
              borderRadius:'var(--pill)', padding:'11px', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7,
            }}><i className="fas fa-expand" /> Demander une extension</button>
          </div>
        </div>
      </div>
    </div>
  );
}
