// pages/RetoursPage.tsx
import { useState, useEffect } from 'react';
import { fmtGNF, type Colis } from '../data/correspondantData';
import { pop } from '../components/Toast';
import sh from '../styles/Shared.module.css';
import { apiFetch } from '@/shared/services/apiFetch';

interface ColisListResult { items: Colis[] }

export default function RetoursPage() {
  const [items, setItems]     = useState<Colis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<ColisListResult>('/dashboard/correspondant/colis')
      .then(d => { if (d) setItems(d.items.filter(c => c.status === 'ret')); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={sh.page}>
      <div className={sh.card} style={{ marginBottom:0 }}>
        <div className={sh.ch}><div className={sh.chT}><i className="fas fa-rotate-left" /> Retours & Litiges</div></div>
        <div className={sh.cb}>
          {loading && <div style={{ textAlign:'center', padding:24, color:'var(--t3)' }}>Chargement…</div>}
          {!loading && items.length === 0 && (
            <div style={{ textAlign:'center', padding:24, color:'var(--t3)' }}>Aucun retour ni litige.</div>
          )}
          {items.map(r => (
            <div key={r.id} style={{ display:'flex', alignItems:'flex-start', gap:14, padding:'14px 0', borderBottom:'1px solid var(--bdr)', cursor:'pointer' }}
                 onClick={() => pop(`↩️ Dossier ${r.id}`, 'i')}>
              <div style={{ width:44, height:44, borderRadius:12, background:'var(--g100)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{r.em}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:'var(--fd)', fontSize:13, fontWeight:700, color:'var(--navy)' }}>{r.nm}</div>
                <div style={{ fontSize:11, color:'var(--t3)', margin:'3px 0 5px', display:'flex', gap:10, flexWrap:'wrap' }}>
                  <span><i className="fas fa-store" /> {r.boutique}</span>
                  <span><i className="fas fa-user" /> {r.client}</span>
                </div>
                <div style={{ fontSize:11, background:'var(--g100)', color:'var(--t2)', padding:'4px 10px', borderRadius:8, display:'inline-flex', alignItems:'center', gap:5 }}>
                  <i className="fas fa-circle-exclamation" /> Motif : {r.motif ?? '—'}
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontFamily:'var(--fd)', fontSize:13, fontWeight:800, color:'var(--navy)' }}>{fmtGNF(r.valeur)}</div>
                <div style={{ fontSize:10, color:'var(--t4)', marginTop:2 }}>{r.date}</div>
                <span style={{ display:'inline-block', marginTop:6, fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:'var(--pill)', background:'var(--g100)', color:'var(--t2)' }}>
                  {r.motif === 'Litige ouvert' ? '⚠️ Litige' : '↩ Retour'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
