// pages/ColisPage.tsx
import React, { useState } from 'react';
import { COLIS, STATUS_CFG, fmtGNF, type ColisStatus } from '../data/correspondantData';
import { pop } from '../components/Toast';
import sh from '../styles/Shared.module.css';

const FILTERS: { label: string; value: ColisStatus | 'all' }[] = [
  { label:'Tous (7)', value:'all' },
  { label:'✓ Arrivés', value:'att' },
  { label:'📦 En stock', value:'stock' },
  { label:'🚀 Dispatchés', value:'dep' },
  { label:'✅ Livrés', value:'livr' },
  { label:'↩ Retours', value:'ret' },
];

const STATUS_CLS: Record<ColisStatus, string> = {
  att:'sAtt', stock:'sStock', dep:'sDep', ret:'sRet', livr:'sLivr'
};

export default function ColisPage() {
  const [filter, setFilter] = useState<ColisStatus | 'all'>('all');
  const visible = filter === 'all' ? COLIS : COLIS.filter(c => c.status === filter);
  return (
    <div className={sh.page}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {FILTERS.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)} style={{
              background: filter===f.value ? 'var(--cor,#B45309)' : '#fff',
              color:      filter===f.value ? '#fff' : 'var(--t2)',
              border:     filter===f.value ? '1.5px solid var(--cor)' : '1.5px solid var(--bdr2)',
              borderRadius:'var(--pill)', padding:'7px 14px', fontSize:12, fontWeight:filter===f.value?700:600,
              cursor:'pointer', transition:'all .2s',
            }}>{f.label}</button>
          ))}
        </div>
        <button onClick={() => pop('📥 Scanner / Enregistrer un colis', 'i')} style={{
          background:'var(--cor,#B45309)', color:'#fff', border:'none',
          borderRadius:'var(--pill)', padding:'10px 20px', fontSize:12, fontWeight:700,
          display:'flex', alignItems:'center', gap:7, cursor:'pointer',
        }}>
          <i className="fas fa-qrcode" /> Scanner / Enregistrer
        </button>
      </div>

      <div className={sh.card} style={{ marginBottom:0 }}>
        <div className={sh.tableWrap}>
          <table className={sh.table}>
            <thead>
              <tr>
                <th>Réf.</th><th>Colis</th><th>Boutique</th>
                <th>Client</th><th>Valeur</th><th>Date</th><th>Statut</th><th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(c => (
                <tr key={c.id} onClick={() => pop(`📦 ${c.nm}`, 'i')}>
                  <td style={{ fontFamily:'var(--fd)', fontSize:11, fontWeight:700, color:'#B45309' }}>
                    {c.urgent && <i className="fas fa-triangle-exclamation" style={{ color:'#DC2626', marginRight:4 }} />}
                    {c.id}
                  </td>
                  <td><span style={{ marginRight:6 }}>{c.em}</span><strong>{c.nm}</strong></td>
                  <td style={{ color:'var(--t2)' }}>{c.boutique}</td>
                  <td style={{ color:'var(--t2)' }}>{c.client}</td>
                  <td style={{ fontFamily:'var(--fd)', fontWeight:700 }}>{fmtGNF(c.valeur)}</td>
                  <td style={{ color:'var(--t3)', fontSize:11 }}>{c.date}</td>
                  <td>
                    <span className={`${sh.sPill} ${(sh as any)[STATUS_CLS[c.status]]}`}>
                      {STATUS_CFG[c.status].label}
                    </span>
                  </td>
                  <td>
                    <button onClick={e => { e.stopPropagation(); pop(`✏️ Modifier ${c.id}`, 'i'); }} style={{ background:'var(--cor-bg,rgba(180,83,9,.09))', color:'#B45309', border:'1px solid rgba(180,83,9,.22)', borderRadius:8, padding:'5px 11px', fontSize:10, fontWeight:700, cursor:'pointer' }}>
                      Gérer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}