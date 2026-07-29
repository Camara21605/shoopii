// pages/TransfertsPage.tsx
import { useState, useEffect } from 'react';
import { fmtGNF, type Colis } from '../data/correspondantData';
import { pop } from '../components/Toast';
import sh from '../styles/Shared.module.css';
import { apiFetch } from '@/shared/services/apiFetch';

interface ColisListResult { items: Colis[] }

export default function TransfertsPage() {
  const [items, setItems]     = useState<Colis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<ColisListResult>('/dashboard/correspondant/colis')
      .then(d => { if (d) setItems(d.items.filter(c => c.status === 'dep')); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={sh.page}>
      <div className={sh.card} style={{ marginBottom:16 }}>
        <div className={sh.ch}><div className={sh.chT}><i className="fas fa-arrows-rotate" /> Transferts en cours</div></div>
        <div className={sh.cb}>
          {loading && <div style={{ textAlign:'center', padding:24, color:'var(--t3)' }}>Chargement…</div>}
          {!loading && items.length === 0 && (
            <div style={{ textAlign:'center', padding:24, color:'var(--t3)' }}>Aucun transfert en cours.</div>
          )}
          {items.map(t => (
            <div key={t.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 0', borderBottom:'1px solid var(--bdr)', cursor:'pointer' }}
                 onClick={() => pop(`🚀 ${t.id} — ${t.nm}`, 'i')}>
              <div style={{ width:42, height:42, borderRadius:12, background:'var(--g100)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{t.em}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:'var(--fd)', fontSize:13, fontWeight:700, color:'var(--navy)' }}>{t.nm}</div>
                <div style={{ fontSize:11, color:'var(--t3)', marginTop:2, display:'flex', gap:10, flexWrap:'wrap' }}>
                  <span><i className="fas fa-store" /> {t.boutique}</span>
                  <span style={{ color:'var(--t2)' }}><i className="fas fa-arrow-right" /></span>
                  <span><i className="fas fa-motorcycle" /> {t.livreur ?? 'Livreur non assigné'}</span>
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontFamily:'var(--fd)', fontSize:13, fontWeight:800, color:'var(--navy)' }}>{fmtGNF(t.valeur)}</div>
                <div style={{ fontSize:10, color:'var(--t4)', marginTop:2 }}>{t.date}</div>
                <span style={{ display:'inline-block', marginTop:4, fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:'var(--pill)', background:'var(--g100)', color:'var(--t2)' }}>
                  🚀 En route
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
