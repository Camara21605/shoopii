// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/sections/FinancesSection.tsx
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import type { SuperAdminStore } from '../hooks/useSuperAdminState';

interface Props { store: SuperAdminStore; isActive: boolean; }

export default function FinancesSection({ store, isActive }: Props) {
  const revenueRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!isActive || !revenueRef.current) return;
    const svg = revenueRef.current;
    const W = 760, H = 180, pL = 10, pR = 10, pT = 20, pB = 10;
    const gW = W - pL - pR, gH = H - pT - pB, months = 6;
    const revenue  = [1200000, 1850000, 1400000, 2300000, 1900000, 2780000];
    const expenses = [400000, 600000, 500000, 800000, 650000, 900000];
    const mx = Math.max(...revenue) * 1.1;
    const toX = (i: number) => pL + (i / (months - 1)) * gW;
    const toY = (v: number) => pT + gH - (v / mx) * gH;

    const pathR = 'M' + revenue.map((d, i)  => `${toX(i)},${toY(d)}`).join('L');
    const pathE = 'M' + expenses.map((d, i) => `${toX(i)},${toY(d)}`).join('L');
    const areaR = pathR + `L${toX(months-1)},${pT+gH}L${toX(0)},${pT+gH}Z`;

    svg.innerHTML = `
      <defs>
        <linearGradient id="ga-rev" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#00C88A" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#00C88A" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${[0,.25,.5,.75,1].map(p=>`<line x1="${pL}" y1="${pT+gH*p}" x2="${W-pR}" y2="${pT+gH*p}" stroke="rgba(128,128,128,0.07)" stroke-width="1"/>`).join('')}
      <path d="${areaR}" fill="url(#ga-rev)"/>
      <path d="${pathR}" fill="none" stroke="var(--acid)"  stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="${pathE}" fill="none" stroke="var(--rose)"  stroke-width="2"   stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="6 3"/>
      ${revenue.map((d,i) => `<circle cx="${toX(i)}" cy="${toY(d)}" r="3.5" fill="var(--surface)" stroke="var(--acid)" stroke-width="1.5"/>`).join('')}
      ${expenses.map((d,i)=> `<circle cx="${toX(i)}" cy="${toY(d)}" r="3" fill="var(--surface)" stroke="var(--rose)" stroke-width="1.5"/>`).join('')}
    `;
  }, [isActive]);

  if (!isActive) return null;

  const MONTHS = ['Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr'];

  const finCards = [
    { label: 'Revenus totaux',    val: '2 780 000 GNF', sub: 'Ce mois',         trend: '↑ +46%', color: 'var(--acid)',   ico: '💰' },
    { label: 'Dépenses',          val: '900 000 GNF',   sub: 'Ce mois',         trend: '↑ +12%', color: 'var(--rose)',   ico: '📤' },
    { label: 'Bénéfice net',      val: '1 880 000 GNF', sub: 'Marge 67.6%',     trend: '↑ +62%', color: 'var(--sky)',    ico: '📈' },
    { label: 'Transactions MTN',  val: '1 340',          sub: 'Mobile Money',    trend: '↑ +28%', color: 'var(--gold)',   ico: '📱' },
    { label: 'Transactions Orange',val: '892',           sub: 'Orange Money',    trend: '↑ +18%', color: 'var(--coral)',  ico: '📱' },
    { label: 'Commissions',       val: '278 000 GNF',   sub: '10% du CA',       trend: '↑ +46%', color: 'var(--violet)', ico: '🤝' },
    { label: 'Abonnements actifs',val: '34',             sub: 'Plans premiums',  trend: '↑ +5',   color: 'var(--sky)',    ico: '⭐' },
    { label: 'Remboursements',    val: '45 000 GNF',     sub: '3 litiges',       trend: '↓ -2',   color: 'var(--rose)',   ico: '↩' },
  ];

  return (
    <div className="section active">
      <div className="page-header">
        <div>
          <div className="ph-title">Tableau <mark>Financier</mark></div>
          <div className="ph-sub">Revenus, dépenses et transactions — temps réel</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost btn-sm">⬇ Export PDF</button>
          <button className="btn btn-primary btn-sm">📊 Rapport complet</button>
        </div>
      </div>

      {/* Finance cards */}
      <div className="finance-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {finCards.slice(0, 4).map((f, i) => (
          <div key={i} className="fin-card">
            <div className="fin-label">{f.ico} {f.label}</div>
            <div className="fin-val" style={{ color: f.color }}>{f.val}</div>
            <div className="fin-sub">{f.sub}</div>
            <div className="fin-trend" style={{ color: f.trend.startsWith('↑') ? 'var(--acid)' : 'var(--rose)' }}>{f.trend}</div>
          </div>
        ))}
      </div>
      <div className="finance-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {finCards.slice(4).map((f, i) => (
          <div key={i} className="fin-card">
            <div className="fin-label">{f.ico} {f.label}</div>
            <div className="fin-val" style={{ color: f.color }}>{f.val}</div>
            <div className="fin-sub">{f.sub}</div>
            <div className="fin-trend" style={{ color: f.trend.startsWith('↑') ? 'var(--acid)' : 'var(--rose)' }}>{f.trend}</div>
          </div>
        ))}
      </div>

      {/* Graphique revenus */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Évolution Revenus / Dépenses — 6 mois</div>
            <div className="card-sub">En francs guinéens (GNF)</div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11 }}>
            <span><span style={{ display:'inline-block', width:12, height:3, background:'var(--acid)', borderRadius:2, marginRight:5, verticalAlign:'middle' }}/>Revenus</span>
            <span><span style={{ display:'inline-block', width:12, height:3, background:'var(--rose)', borderRadius:2, marginRight:5, verticalAlign:'middle', opacity:0.7 }}/>Dépenses</span>
          </div>
        </div>
        <div className="chart-wrap">
          <svg ref={revenueRef} className="svg-chart" viewBox="0 0 760 180" height={180} preserveAspectRatio="none" />
        </div>
        <div className="chart-labels">
          {MONTHS.map(m => <span key={m}>{m}</span>)}
        </div>
      </div>

      {/* Tableau transactions récentes */}
      <div className="card">
        <div className="card-head">
          <div className="card-title">Transactions récentes</div>
          <span className="badge b-sky">30 derniers jours</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>ID Transaction</th>
                <th>Utilisateur</th>
                <th>Type</th>
                <th>Montant</th>
                <th>Opérateur</th>
                <th>Statut</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {[
                { id:'TXN-00421', user:'Mamadou Diallo',  type:'Commande',    amount:'145 000 GNF', op:'MTN',    status:'success', date:'04/04/2025' },
                { id:'TXN-00420', user:'Fatoumata Bah',   type:'Abonnement',  amount:'50 000 GNF',  op:'Orange', status:'success', date:'03/04/2025' },
                { id:'TXN-00419', user:'Sekou Camara',    type:'Commande',    amount:'87 500 GNF',  op:'MTN',    status:'success', date:'03/04/2025' },
                { id:'TXN-00418', user:'Hawa Diawara',    type:'Remboursement',amount:'32 000 GNF', op:'Orange', status:'refund',  date:'02/04/2025' },
                { id:'TXN-00417', user:'Nènè Konaté',     type:'Commande',    amount:'210 000 GNF', op:'MTN',    status:'pending', date:'02/04/2025' },
              ].map(t => (
                <tr key={t.id}>
                  <td style={{ fontFamily:'var(--font-m)', fontSize:11 }}>{t.id}</td>
                  <td style={{ fontWeight:600 }}>{t.user}</td>
                  <td>{t.type}</td>
                  <td style={{ fontFamily:'var(--font-m)', color:'var(--acid)', fontWeight:700 }}>{t.amount}</td>
                  <td>{t.op === 'MTN' ? '🟡 MTN' : '🟠 Orange'}</td>
                  <td>
                    <span className={`badge ${t.status === 'success' ? 'b-acid' : t.status === 'refund' ? 'b-rose' : 'b-gold'}`}>
                      {t.status === 'success' ? '✅ Succès' : t.status === 'refund' ? '↩ Remboursé' : '⏳ En attente'}
                    </span>
                  </td>
                  <td style={{ fontFamily:'var(--font-m)', fontSize:11, color:'var(--txt-3)' }}>{t.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}