// src/dashboards/livreur/pages/RevenusPage.tsx
import React, { useState, useEffect } from 'react';
import { fmtGNF } from '../data/livreurData';
import shared from '../styles/Shared.module.css';
import { apiFetch } from '@/shared/services/apiFetch';

interface Props { onPop:(m:string,t?:string)=>void; }

interface Transaction {
  id:      string;
  source:  string;
  montant: number;
  date:    string;
  statut:  string;
}
interface RevenusData {
  tauxCommission:   number;
  totalRevenus:     number;
  revenusThisMonth: number;
  transactions:     Transaction[];
}

const STATUS_COLOR: Record<string, string> = {
  released:  'var(--emerald)',
  escrow:    'var(--amber)',
  cancelled: 'var(--red)',
  refunded:  'var(--blue)',
};

export default function RevenusPage({ onPop }: Props) {
  const [data,    setData]    = useState<RevenusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<RevenusData>('/dashboard/livreur/revenus')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const tauxCommission   = data?.tauxCommission   ?? 0;
  const totalRevenus     = data?.totalRevenus     ?? 0;
  const revenusThisMonth = data?.revenusThisMonth ?? 0;
  const transactions     = data?.transactions     ?? [];

  const STATS = [
    { bg:'var(--tl-bg)', c:'var(--teal)',    ic:'fa-coins',             ttl:'Total revenus',    val: fmtGNF(totalRevenus)     },
    { bg:'var(--em-bg)', c:'var(--emerald)', ic:'fa-hand-holding-dollar',ttl:'Ce mois',          val: fmtGNF(revenusThisMonth) },
    { bg:'var(--sky-2)', c:'var(--blue)',    ic:'fa-percent',            ttl:'Taux Shoneya',       val: `${tauxCommission}%`     },
  ];

  if (loading) return (
    <div className={shared.page} style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'64px 0' }}>
      <i className="fas fa-spinner fa-spin" style={{ fontSize:28, color:'var(--muted)' }} />
    </div>
  );

  return (
    <div className={shared.page}>
      <div className={shared.g4} style={{ marginBottom:20 }}>
        {STATS.map((s, i) => (
          <div key={i} className={`${shared.kpi} ${shared.cardLast}`}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <div style={{ width:38, height:38, borderRadius:10, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className={`fas ${s.ic}`} style={{ color:s.c, fontSize:15 }} />
              </div>
            </div>
            <div style={{ fontSize:11, color:'var(--t3)', textTransform:'uppercase', letterSpacing:.5, marginBottom:4 }}>{s.ttl}</div>
            <div style={{ fontFamily:'var(--fd)', fontSize:16, fontWeight:800, color:'var(--navy)', letterSpacing:'-.3px' }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div className={`${shared.card} ${shared.cardLast}`}>
        <div className={shared.ch}><div className={shared.chT}><i className="fas fa-list" /> Dernières transactions</div></div>
        <div className={shared.cb}>
          {transactions.length === 0 ? (
            <div style={{ padding:'32px', textAlign:'center', color:'var(--muted)', fontSize:14 }}>
              Aucune transaction pour le moment
            </div>
          ) : transactions.map(tx => (
            <div key={tx.id} className={shared.txItem}>
              <div className={shared.txIc} style={{ background:'var(--em-bg)' }}>
                <i className="fas fa-motorcycle" style={{ color:'var(--emerald)', fontSize:12 }} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--navy)' }}>{tx.source}</div>
                <div style={{ fontSize:10, color:'var(--t3)', marginTop:1 }}>{tx.date}</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 }}>
                <div style={{ fontFamily:'var(--fd)', fontSize:13, fontWeight:800, color:'var(--emerald)', flexShrink:0 }}>
                  +{fmtGNF(tx.montant)}
                </div>
                <span style={{ fontSize:10, color: STATUS_COLOR[tx.statut] ?? 'var(--t3)', fontWeight:600 }}>
                  {tx.statut}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
