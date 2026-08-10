// src/dashboards/livreur/pages/BoutiquesPage.tsx
// Boutiques avec lesquelles ce livreur a réellement effectué des
// livraisons — dérivé des commandes (GET /dashboard/livreur/boutiques),
// jamais une liste statique de "partenaires".
import { useState, useEffect } from 'react';
import { apiFetch } from '@/shared/services/apiFetch';
import { useStartConversation } from '@/shared/hooks/useStartConversation';
import shared from '../styles/Shared.module.css';

interface Props { onPop: (m:string,t?:string)=>void; }

interface BoutiqueItem {
  id: string; nm: string; em: string; logo: string | null; cat: string; rat: number;
  delivs: number; pending: number; since: string;
}
interface BoutiquesResult {
  items: BoutiqueItem[];
  totalDeliveries: number;
}

export default function BoutiquesPage({ onPop }: Props) {
  const [items, setItems]     = useState<BoutiqueItem[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const { start: startConv }  = useStartConversation();

  useEffect(() => {
    apiFetch<BoutiquesResult>('/dashboard/livreur/boutiques')
      .then(d => { if (d) { setItems(d.items); setTotal(d.totalDeliveries); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={shared.page}>
      <div className={shared.g2}>
        <div>
          <div style={{ fontFamily:'var(--fd)',fontSize:16,fontWeight:700,color:'var(--navy)',marginBottom:14 }}>Boutiques partenaires</div>

          {loading && <div style={{ padding:'20px 0', color:'var(--t3)' }}>Chargement…</div>}
          {!loading && items.length === 0 && (
            <div style={{ padding:'20px 0', color:'var(--t3)' }}>Aucune livraison effectuée pour une boutique pour le moment.</div>
          )}

          <div style={{ display:'flex',flexDirection:'column',gap:9 }}>
            {items.map(b => (
              <div key={b.id} style={{ display:'flex',alignItems:'center',gap:11,padding:'12px 14px',background:'var(--g50)',border:'1px solid var(--bdr)',borderRadius:'var(--r-lg)',cursor:'pointer',transition:'all .2s' }}
                onClick={() => onPop(`🏪 ${b.nm}`,'i')}
              >
                <div style={{ width:40,height:40,borderRadius:11,background:'linear-gradient(135deg,#F4F4F5,#E4E4E7)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,flexShrink:0,overflow:'hidden' }}>
                  {b.logo
                    ? <img src={b.logo} alt={b.nm} style={{ width:'100%',height:'100%',objectFit:'cover' }} />
                    : b.em}
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontFamily:'var(--fd)',fontSize:13,fontWeight:700,color:'var(--navy)' }}>{b.nm}</div>
                  <div style={{ display:'flex',alignItems:'center',gap:7,fontSize:10,color:'var(--t3)',marginTop:2,flexWrap:'wrap' }}>
                    <span>{b.cat}</span>
                    <span><i className="fas fa-star" style={{color:'var(--amber)'}} /> {b.rat.toFixed(1)}</span>
                    <span>Depuis {b.since}</span>
                    {b.pending>0 && <span style={{background:'var(--am-bg)',color:'var(--amber)',fontWeight:700,padding:'1px 7px',borderRadius:'var(--pill)'}}>{b.pending} en attente</span>}
                  </div>
                </div>
                <div style={{ textAlign:'right',flexShrink:0 }}>
                  <div style={{ fontFamily:'var(--fd)',fontSize:14,fontWeight:800,color:'var(--blue)' }}>{b.delivs}</div>
                  <div style={{ fontSize:9,color:'var(--t3)' }}>livr.</div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); startConv('company', b.id, msg => onPop(msg,'w')); }}
                  style={{ background:'var(--sky)',color:'var(--blue)',border:'1px solid var(--sky-3)',borderRadius:'var(--pill)',padding:'6px 11px',fontSize:10,fontWeight:700,cursor:'pointer' }}
                >
                  Message
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className={`${shared.card} ${shared.cardLast}`}>
          <div className={shared.ch}><div className={shared.chT}><i className="fas fa-chart-pie" /> Répartition</div></div>
          <div className={shared.cb}>
            {items.length === 0 && !loading && (
              <div style={{ color:'var(--t3)', fontSize:12, textAlign:'center', padding:'8px 0' }}>Aucune donnée à répartir.</div>
            )}
            {items.map(b => {
              const pct = total > 0 ? Math.round((b.delivs/total)*100) : 0;
              return (
                <div key={b.id} style={{ marginBottom:12 }}>
                  <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:12,marginBottom:5 }}>
                    <span style={{ fontWeight:600,color:'var(--navy)',display:'flex',alignItems:'center',gap:6 }}>{b.em} {b.nm}</span>
                    <span style={{ fontWeight:700,color:'var(--teal)' }}>{pct}%</span>
                  </div>
                  <div style={{ background:'var(--g100)',borderRadius:'var(--pill)',height:7,overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`,height:'100%',background:'var(--teal)',borderRadius:'var(--pill)' }} />
                  </div>
                </div>
              );
            })}
            {items.length > 0 && (
              <div style={{ paddingTop:11,borderTop:'1px solid var(--bdr)',fontSize:12,color:'var(--t2)',display:'flex',justifyContent:'space-between' }}>
                <span>Total</span>
                <strong style={{ color:'var(--navy)',fontFamily:'var(--fd)' }}>{total} livraisons</strong>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
