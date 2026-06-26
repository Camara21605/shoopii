/*
 * FICHIER: src/dashboards/entreprise/pages/RetoursPage.tsx
 * Page Retours & SAV — tableau des retours, motifs, tickets SAV
 */

import React from 'react';
import { useToast } from '../../../shared/context/ToastContext';
import { RETURNS } from '../data/mockData';
import type { ReturnStatus } from '../types';

const STATUS_LABELS: Record<ReturnStatus, JSX.Element> = {
  pending:  <span className="s-pill s-new">⏳ En attente</span>,
  approved: <span className="s-pill s-del">✓ Approuvé</span>,
  refused:  <span className="s-pill s-can">✕ Refusé</span>,
};

const MOTIFS: [string, string, string][] = [
  ['Produit défectueux', '42%', 'var(--red)'],
  ["Changement d'avis",  '26%', 'var(--amber)'],
  ['Mauvaise description','19%', 'var(--violet)'],
  ['Erreur commande',     '13%', 'var(--teal)'],
];

export default function RetoursPage() {
  const { pop } = useToast();

  return (
    <div className="page on" id="p-retours">
      {/* Stats retours */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
        {[
          { ic:'🔄', v:'6',   l:'Total ce mois', c:'var(--blue)' },
          { ic:'⏳', v:'3',   l:'En attente',    c:'var(--amber)' },
          { ic:'✅', v:'3',   l:'Remboursés',    c:'var(--emerald)' },
          { ic:'💸', v:'17.7M', l:'Montant retours', c:'var(--rose)' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding:16 }}>
            <div style={{ fontSize:22 }}>{s.ic}</div>
            <div style={{ fontFamily:'var(--fd)', fontSize:22, fontWeight:800, color:'var(--navy)', marginTop:6 }}>{s.v}</div>
            <div style={{ fontSize:11, color:'var(--t3)', marginTop:3 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div className="g2">
        {/* Tableau retours */}
        <div className="card">
          <div className="ch">
            <div className="ch-t"><i className="fas fa-rotate-left"></i> Demandes de retour</div>
            <span className="ch-badge" style={{ background:'var(--rs-bg)', color:'var(--rose)', borderColor:'rgba(225,29,72,.2)' }}>3 en attente</span>
          </div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Ref</th><th>Produit</th><th>Client</th><th>Motif</th><th>Montant</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                {RETURNS.map(r => (
                  <tr key={r.id}>
                    <td><div className="td-id">{r.id}</div></td>
                    <td>
                      <div className="td-prod">
                        <div className="td-em">{r.em}</div>
                        <div className="td-nm">{r.nm}</div>
                      </div>
                    </td>
                    <td><div className="td-client">{r.client}</div></td>
                    <td style={{ fontSize:12, color:'var(--t2)' }}>{r.motif}</td>
                    <td><div className="td-price" style={{ fontSize:12 }}>{r.montant} GNF</div></td>
                    <td>{STATUS_LABELS[r.status]}</td>
                    <td>
                      <div className="td-action">
                        <button className="ta-btn primary" onClick={e => { e.stopPropagation(); pop('📋 Détails retour', 'i'); }}>Voir</button>
                        {r.status === 'pending' && (
                          <button className="ta-btn" onClick={e => { e.stopPropagation(); pop('✅ Retour approuvé', 's'); }}>Valider</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          {/* Motifs */}
          <div className="card" style={{ marginBottom:14 }}>
            <div className="ch"><div className="ch-t"><i className="fas fa-chart-pie"></i> Motifs de retour</div></div>
            <div className="cb">
              {MOTIFS.map(([l, p, c]) => (
                <div key={l} style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                    <span style={{ color:'var(--t2)' }}>{l}</span>
                    <span style={{ fontWeight:700, color:c }}>{p}</span>
                  </div>
                  <div style={{ background:'var(--g200)', borderRadius:'var(--pill)', height:8, overflow:'hidden' }}>
                    <div style={{ width:p, height:'100%', background:c, borderRadius:'var(--pill)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SAV */}
          <div className="card">
            <div className="ch">
              <div className="ch-t"><i className="fas fa-comments"></i> SAV — Messages ouverts</div>
              <span className="ch-badge">2 tickets</span>
            </div>
            <div className="cb">
              {[
                { cl:'Mamadou K.', txt:'Chargeur manquant dans le colis', urgent:true },
                { cl:'Aminata D.', txt:'Délai de livraison dépassé', urgent:false },
              ].map((s, i) => (
                <div key={i} style={{ padding:11, background:'var(--g50)', border:'1px solid var(--bdr)', borderRadius:'var(--r-md)', display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12.5, fontWeight:700, color:'var(--navy)' }}>{s.cl}</div>
                    <div style={{ fontSize:11.5, color:'var(--t3)', marginTop:2 }}>{s.txt}</div>
                  </div>
                  {s.urgent && <span className="s-pill s-can" style={{ fontSize:9 }}>URGENT</span>}
                  <button onClick={() => pop('💬 Ticket SAV ouvert', 'i')} style={{ background:'var(--sky)', color:'var(--blue)', border:'1px solid var(--sky-3)', borderRadius:'var(--pill)', padding:'5px 12px', fontSize:10.5, fontWeight:700, cursor:'pointer' }}>Répondre</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}