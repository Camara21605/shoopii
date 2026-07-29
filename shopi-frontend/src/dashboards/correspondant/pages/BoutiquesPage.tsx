// pages/BoutiquesPage.tsx
import { useState, useEffect } from 'react';
import { pop } from '../components/Toast';
import sh from '../styles/Shared.module.css';
import { apiFetch } from '@/shared/services/apiFetch';

interface BoutiqueItem {
  nm: string; em: string; cat: string; rat: number;
  colis: number; pending: number; since: string;
}
interface BoutiquesResult {
  items: BoutiqueItem[];
  stats: { total: number; colisActifs: number; enAttente: number; noteMoyenne: number };
}

const EMPTY_STATS = { total: 0, colisActifs: 0, enAttente: 0, noteMoyenne: 0 };

export default function BoutiquesPage() {
  const [items, setItems]   = useState<BoutiqueItem[]>([]);
  const [stats, setStats]   = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<BoutiquesResult>('/dashboard/correspondant/boutiques')
      .then(d => { if (d) { setItems(d.items); setStats(d.stats); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={sh.page}>
      <div className={sh.g3r} style={{ marginBottom:0 }}>
        <div>
          <div style={{ fontFamily:'var(--fd)', fontSize:16, fontWeight:700, color:'var(--navy)', marginBottom:14 }}>Boutiques partenaires</div>
          {loading && <div style={{ padding:'20px 0', color:'var(--t3)' }}>Chargement…</div>}
          {!loading && items.length === 0 && (
            <div style={{ padding:'20px 0', color:'var(--t3)' }}>Aucune boutique n'a encore déposé de colis via ce relais.</div>
          )}
          <div className={sh.entityList}>
            {items.map(b => (
              <div key={b.nm} className={sh.entityItem} onClick={() => pop(`🏪 ${b.nm}`, 'i')}>
                <div className={sh.entityLogo}>{b.em}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div className={sh.entityNm}>{b.nm}</div>
                  <div className={sh.entityMeta}>
                    <span>{b.cat}</span>
                    <span><i className="fas fa-star" style={{ color:'var(--t2)' }} /> {b.rat.toFixed(1)}</span>
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
            {[
              { lbl:'Total boutiques', val:String(stats.total),       ic:'fa-store' },
              { lbl:'Colis actifs',    val:String(stats.colisActifs), ic:'fa-box'   },
              { lbl:'En attente',      val:String(stats.enAttente),   ic:'fa-clock' },
              { lbl:'Note moy.',       val:`${stats.noteMoyenne.toFixed(2)} ⭐`, ic:'fa-star' },
            ].map(s => (
              <div key={s.lbl} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderBottom:'1px solid var(--bdr)' }}>
                <div style={{ width:34, height:34, borderRadius:9, background:'var(--g100)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <i className={`fas ${s.ic}`} style={{ color:'var(--t2)', fontSize:13 }} />
                </div>
                <div style={{ flex:1 }}><div style={{ fontSize:12, color:'var(--t2)' }}>{s.lbl}</div></div>
                <div style={{ fontFamily:'var(--fd)', fontSize:15, fontWeight:800, color:'var(--navy)' }}>{s.val}</div>
              </div>
            ))}
            <button onClick={() => pop('📬 Invitation boutique envoyée', 's')} style={{
              width:'100%', marginTop:14, background:'var(--btn,#111113)', color:'#fff', border:'none',
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
