// pages/ClientsPage.tsx
import React from 'react';
import { CLIENTS, fmtGNF } from '../data/correspondantData';
import { pop } from '../components/Toast';
import sh from '../styles/Shared.module.css';

export default function ClientsPage() {
  return (
    <div className={sh.page}>
      <div className={sh.card} style={{ marginBottom:0 }}>
        <div className={sh.ch}><div className={sh.chT}><i className="fas fa-users" /> Clients zone</div></div>
        <div className={sh.tableWrap}>
          <table className={sh.table}>
            <thead><tr><th>Client</th><th>Téléphone</th><th>Colis</th><th>Dernier dépôt</th><th>Valeur totale</th><th>Statut</th></tr></thead>
            <tbody>
              {CLIENTS.map(c => (
                <tr key={c.nm} onClick={() => pop(`👤 ${c.nm}`, 'i')}>
                  <td style={{ fontFamily:'var(--fd)', fontWeight:700 }}>{c.nm}</td>
                  <td style={{ color:'var(--t2)' }}>{c.tel}</td>
                  <td style={{ fontFamily:'var(--fd)', fontWeight:700, color:'#B45309' }}>{c.colis}</td>
                  <td style={{ color:'var(--t3)', fontSize:11 }}>{c.dernier}</td>
                  <td style={{ fontFamily:'var(--fd)', fontWeight:700 }}>{fmtGNF(c.val)}</td>
                  <td>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:9, fontWeight:800, padding:'3px 8px', borderRadius:'var(--pill)', textTransform:'uppercase',
                      background: c.status==='att' ? 'rgba(180,83,9,.09)' : c.status==='retour' ? 'rgba(220,38,38,.1)' : 'rgba(4,120,87,.08)',
                      color:      c.status==='att' ? '#B45309'            : c.status==='retour' ? '#DC2626'            : '#047857',
                    }}>
                      {c.status==='att' ? '⏳ En attente' : c.status==='retour' ? '↩ Retour' : '✓ OK'}
                    </span>
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