// pages/LivreursPage.tsx
import { useState, useEffect } from 'react';
import { pop } from '../components/Toast';
import sh from '../styles/Shared.module.css';
import { apiFetch } from '@/shared/services/apiFetch';

interface LivreurItem {
  nm: string; em: string; zone: string; rat: number;
  missions: number; online: boolean; pending: number;
}
interface LivreursResult {
  items: LivreurItem[];
  stats: { total: number; enLigne: number; missionsCeMois: number };
}

const EMPTY_STATS = { total: 0, enLigne: 0, missionsCeMois: 0 };

export default function LivreursPage() {
  const [items, setItems]     = useState<LivreurItem[]>([]);
  const [stats, setStats]     = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<LivreursResult>('/dashboard/correspondant/livreurs')
      .then(d => { if (d) { setItems(d.items); setStats(d.stats); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={sh.page}>
      <div className={sh.g3r} style={{ marginBottom:0 }}>
        <div>
          <div style={{ fontFamily:'var(--fd)', fontSize:16, fontWeight:700, color:'var(--navy)', marginBottom:14 }}>
            Livreurs locaux abonnés
          </div>
          {loading && <div style={{ padding:'20px 0', color:'var(--t3)' }}>Chargement…</div>}
          {!loading && items.length === 0 && (
            <div style={{ padding:'20px 0', color:'var(--t3)' }}>Aucun livreur n'a encore reçu de colis via ce relais.</div>
          )}
          <div className={sh.entityList}>
            {items.map(l => (
              <div key={l.nm} className={sh.entityItem} onClick={() => pop(`🛵 ${l.nm}`, 'i')}>
                <div className={sh.entityLogo} style={{ position:'relative' }}>
                  {l.em}
                  {l.online && (
                    <div style={{ position:'absolute', bottom:2, right:2, width:9, height:9, borderRadius:'50%', background:'var(--t1)', border:'2px solid var(--white)' }} />
                  )}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div className={sh.entityNm}>{l.nm}</div>
                  <div className={sh.entityMeta}>
                    <span><i className="fas fa-map-pin" /> {l.zone}</span>
                    <span style={{ color:l.online ? 'var(--t1)':'var(--t3)', fontWeight:600 }}>
                      <i className={`fas ${l.online ? 'fa-circle':'fa-moon'}`} />
                      {l.online ? ' En ligne' : ' Hors ligne'}
                    </span>
                  </div>
                </div>
                <div className={sh.entityRight}>
                  <div className={sh.entityStat}>{l.rat.toFixed(1)} ⭐</div>
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
              <div style={{ fontFamily:'var(--fd)', fontSize:40, fontWeight:800, color:'var(--navy)', letterSpacing:'-2px' }}>{stats.enLigne}</div>
              <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>livreurs en ligne sur {stats.total}</div>
              <div style={{ marginTop:10, height:8, background:'var(--g200)', borderRadius:'var(--pill)', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${stats.total ? Math.round((stats.enLigne/stats.total)*100) : 0}%`, background:'var(--t2)', borderRadius:'var(--pill)', transition:'width 1s' }} />
              </div>
            </div>
            {[
              { lbl:'Total livreurs',     val:stats.total },
              { lbl:'En ligne',           val:stats.enLigne },
              { lbl:'Missions ce mois',   val:stats.missionsCeMois },
            ].map(s => (
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
