// src/dashboards/livreur/pages/HistoriquePage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SPEED_LABEL, SPEED_CLASS, fmtGNF } from '../data/livreurData';
import type { HistStatus } from '../data/livreurData';
import { fetchHistorique } from '../services/historique.api';
import type { HistApi } from '../services/historique.api';
import shared from '../styles/Shared.module.css';

interface Props { onPop: (m:string,t?:string)=>void; }
const HIST_FILTERS = ['Tout','Livré','Incident','Annulé'];
const HIST_MAP: Record<string,HistStatus|null> = { 'Tout':null,'Livré':'done','Incident':'iss','Annulé':'can' };

export default function HistoriquePage({ onPop }: Props) {
  const navigate = useNavigate();
  const [active, setActive] = useState('Tout');
  const [historique, setHistorique] = useState<HistApi[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistorique()
      .then(setHistorique)
      .catch(() => onPop('❌ Impossible de charger l\'historique', 'e'))
      .finally(() => setLoading(false));
  }, []);

  const data = active === 'Tout' ? historique : historique.filter(h => h.status === HIST_MAP[active]);

  return (
    <div className={shared.page}>
      <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:16,flexWrap:'wrap' }}>
        <div style={{ display:'flex',gap:7 }}>
          {HIST_FILTERS.map(f => (
            <button key={f} className={`${shared.filterBtn} ${active===f?shared.filterBtnOn:''}`} onClick={() => setActive(f)}>{f}</button>
          ))}
        </div>
        <button onClick={() => onPop('📥 Export CSV téléchargé','s')} style={{ marginLeft:'auto',background:'var(--white)',border:'1.5px solid var(--bdr2)',borderRadius:'var(--pill)',padding:'8px 16px',fontSize:12,fontWeight:600,color:'var(--t2)',cursor:'pointer',display:'flex',alignItems:'center',gap:6 }}>
          <i className="fas fa-download" /> Exporter
        </button>
      </div>

      {loading && (
        <div style={{ padding:'60px 0', textAlign:'center', color:'var(--t3)', fontSize:14 }}>
          <i className="fas fa-circle-notch fa-spin" /> Chargement de l'historique…
        </div>
      )}

      {!loading && data.length === 0 && (
        <div style={{ padding:'60px 0', textAlign:'center', color:'var(--t3)' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--navy)' }}>Aucune livraison dans l'historique</div>
          <div style={{ fontSize:12, marginTop:4 }}>Vos missions terminées apparaîtront ici.</div>
        </div>
      )}

      {!loading && data.length > 0 && (
        <div className={shared.card}>
          <div className={shared.tableWrap}>
            <table className={shared.table}>
              <thead>
                <tr><th>ID</th><th>Produit</th><th>Boutique</th><th>Distance</th><th>Vitesse</th><th>Statut</th><th>Date</th><th style={{textAlign:'right'}}>Gain</th></tr>
              </thead>
              <tbody>
                {data.map((h,i) => (
                  <tr key={i} onClick={() => navigate(`/commande/${h.uuid}/suivi`)} style={{ cursor:'pointer' }}>
                    <td className={shared.tdId}>{h.id}</td>
                    <td><div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:28,height:28,borderRadius:7,background:'var(--sky-2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0}}>{h.em}</div><span style={{fontSize:12,fontWeight:600,color:'var(--navy)'}}>{h.nm}</span></div></td>
                    <td style={{color:'var(--t2)'}}>{h.shop}</td>
                    <td style={{color:'var(--t3)'}}>{h.dist}</td>
                    <td><span className={`${shared.speedBadge} ${shared[SPEED_CLASS[h.speed] as keyof typeof shared]}`}>{SPEED_LABEL[h.speed]}</span></td>
                    <td><span className={`${shared.sPill} ${h.status==='done'?shared.sDone:h.status==='iss'?shared.sIss:shared.sCan}`}>{h.status==='done'?'✓ Livré':h.status==='iss'?'⚠ Incident':'✕ Annulé'}</span></td>
                    <td style={{fontSize:11,color:'var(--t3)'}}>{h.date}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--fd)',fontSize:13,fontWeight:800,color:h.earn?'var(--emerald)':'var(--red)'}}>{h.earn?'+':'-'}{fmtGNF(h.fee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
