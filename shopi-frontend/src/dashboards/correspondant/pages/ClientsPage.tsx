// pages/ClientsPage.tsx
import { useState, useEffect } from 'react';
import { fmtGNF } from '../data/correspondantData';
import { pop } from '../components/Toast';
import sh from '../styles/Shared.module.css';
import { apiFetch } from '@/shared/services/apiFetch';

interface ClientItem {
  nm: string; tel: string; colis: number; dernier: string;
  val: number; status: 'att' | 'retour' | 'ok';
}

export default function ClientsPage() {
  const [items, setItems]     = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<ClientItem[]>('/dashboard/correspondant/clients')
      .then(d => { if (d) setItems(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={sh.page}>
      <div className={sh.card} style={{ marginBottom:0 }}>
        <div className={sh.ch}><div className={sh.chT}><i className="fas fa-users" /> Clients zone</div></div>
        <div className={sh.tableWrap}>
          <table className={sh.table}>
            <thead><tr><th>Client</th><th>Téléphone</th><th>Colis</th><th>Dernier dépôt</th><th>Valeur totale</th><th>Statut</th></tr></thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} style={{ textAlign:'center', padding:24, color:'var(--t3)' }}>Chargement…</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign:'center', padding:24, color:'var(--t3)' }}>Aucun client servi via ce relais.</td></tr>
              )}
              {items.map(c => (
                <tr key={c.nm} onClick={() => pop(`👤 ${c.nm}`, 'i')}>
                  <td style={{ fontFamily:'var(--fd)', fontWeight:700 }}>{c.nm}</td>
                  <td style={{ color:'var(--t2)' }}>{c.tel}</td>
                  <td style={{ fontFamily:'var(--fd)', fontWeight:700, color:'var(--navy)' }}>{c.colis}</td>
                  <td style={{ color:'var(--t3)', fontSize:11 }}>{c.dernier}</td>
                  <td style={{ fontFamily:'var(--fd)', fontWeight:700 }}>{fmtGNF(c.val)}</td>
                  <td>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:9, fontWeight:800, padding:'3px 8px', borderRadius:'var(--pill)', textTransform:'uppercase',
                      background: 'var(--g100)',
                      color:      'var(--t2)',
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
