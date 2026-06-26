/*
 * FICHIER: src/dashboards/entreprise/pages/FinancesPage.tsx
 * Page Finances — solde, revenus, dépenses, transactions,
 * commissions Shopi, historique des virements.
 */

import React, { useState } from 'react';
import { useToast } from '../../../shared/context/ToastContext';
import { TRANSACTIONS, CA_DATA } from '../data/mockData';
import './FinancesPage.css';

/** Données de solde et de flux financiers */
const BALANCE_STATS = [
  { ic: '💳', v: '87 350 000', unit: 'GNF', l: 'Solde disponible',    k: 'k2', trend: '+45.2M ce mois' },
  { ic: '📈', v: '145 200 000', unit: 'GNF', l: 'Revenus janvier',   k: 'k1', trend: '+23% vs déc.' },
  { ic: '📉', v: '6 030 000',   unit: 'GNF', l: 'Dépenses janvier',  k: 'k5', trend: 'Commissions + livraison' },
  { ic: '⏳', v: '24 800 000',  unit: 'GNF', l: 'En attente virement',k: 'k3', trend: 'Disponible le 25 jan.' },
];

/** Périodes de filtrage */
const PERIODS = ['7 jours', '30 jours', '3 mois', '6 mois', 'Tout'];

/** Données des virements reçus */
const VIREMENTS = [
  { date: '15 jan. 2025', mt: '+45 200 000 GNF', ref: 'VIR-2025-0042', status: 'done',   period: 'Semaine 2 jan.' },
  { date: '08 jan. 2025', mt: '+38 900 000 GNF', ref: 'VIR-2025-0041', status: 'done',   period: 'Semaine 1 jan.' },
  { date: '25 déc. 2024', mt: '+52 100 000 GNF', ref: 'VIR-2024-0038', status: 'done',   period: 'Semaine 4 déc.' },
  { date: '25 jan. 2025', mt: '+24 800 000 GNF', ref: 'VIR-2025-0043', status: 'pending',period: 'Semaine 3 jan.' },
];

export default function FinancesPage() {
  const { pop } = useToast();
  const [period, setPeriod] = useState('30 jours');

  const maxCA = Math.max(...CA_DATA.map(d => d.v));

  return (
    <div className="page on" id="p-finances">

      {/* ── KPIs solde ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 13, marginBottom: 20 }}>
        {BALANCE_STATS.map((s, i) => (
          <div key={i} className={`kpi ${s.k}`}>
            <div className="kpi-stripe"></div>
            <div className="kpi-top">
              <div className="kpi-icon">{s.ic}</div>
              <span className="kpi-badge up">{s.trend}</span>
            </div>
            <div className="kpi-val" style={{ fontSize: 20 }}>{s.v}</div>
            <div className="kpi-lbl">{s.l}</div>
            <div className="kpi-sub">{s.unit}</div>
          </div>
        ))}
      </div>

      <div className="g3">
        {/* ── Colonne principale ── */}
        <div>
          {/* Graphique CA */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-chart-area"></i> Évolution des revenus</div>
              <div className="sh-tabs">
                {PERIODS.map(p => (
                  <button
                    key={p}
                    className={`sh-tab${period === p ? ' on' : ''}`}
                    onClick={() => { setPeriod(p); pop('📊 Période mise à jour', 'i'); }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="cb">
              <div className="chart-bars" style={{ height: 150 }}>
                {CA_DATA.map((d, i) => (
                  <div className="c-bar-wrap" key={i}>
                    <div
                      className="c-bar"
                      style={{
                        height: `${(d.v / maxCA) * 100}%`,
                        background: i === CA_DATA.length - 1
                          ? 'linear-gradient(180deg, var(--emerald), #34D399)'
                          : 'linear-gradient(180deg, var(--sky-3), #bfdbfe)',
                      }}
                    >
                      <div className="c-bar-v">{d.v}M</div>
                    </div>
                    <div className="c-lbl">{d.m}</div>
                  </div>
                ))}
              </div>
              <div className="chart-legend">
                <div className="cl-item"><div className="cl-dot" style={{ background: 'var(--emerald)' }}></div>Revenus (M GNF)</div>
                <div className="cl-item"><div className="cl-dot" style={{ background: 'var(--sky-3)' }}></div>Mois précédents</div>
              </div>
            </div>
          </div>

          {/* Transactions récentes */}
          <div className="card">
            <div className="ch">
              <div className="ch-t"><i className="fas fa-list-ul"></i> Transactions récentes</div>
              <button className="sh-action" onClick={() => pop('📥 Export relevé PDF', 's')}>
                <i className="fas fa-download"></i> Relevé PDF
              </button>
            </div>
            <div className="cb">
              <div className="tx-list">
                {TRANSACTIONS.map((t, i) => (
                  <div key={i} className="tx-item" onClick={() => pop(`💰 Détail: ${t.nm}`, 'i')}>
                    <div className="tx-ic" style={{ background: t.bg }}>
                      <span style={{ fontSize: 16 }}>{t.ic}</span>
                    </div>
                    <div className="tx-inf">
                      <div className="tx-nm">{t.nm}</div>
                      <div className="tx-sub">{t.sub}</div>
                    </div>
                    <div className={`tx-amt ${t.dir}`}>
                      {t.amt} <span className="tx-unit">GNF</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Panneau latéral ── */}
        <div>
          {/* Répartition des revenus */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-chart-pie"></i> Répartition</div>
            </div>
            <div className="cb">
              {[
                { l: 'Ventes produits',    pct: 76, color: 'var(--blue)',    v: '110.4M' },
                { l: 'Livraisons facturées',pct: 14, color: 'var(--emerald)','v': '20.3M' },
                { l: 'Commissions Shopi',  pct: -8, color: 'var(--rose)',    v: '−11.6M' },
                { l: 'Frais divers',       pct: -2, color: 'var(--amber)',   v: '−2.9M' },
              ].map((r, i) => (
                <div key={i} style={{ marginBottom: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--t2)', fontWeight: 500 }}>{r.l}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, color: r.color, fontFamily: 'var(--fd)', fontSize: 11 }}>{r.v}</span>
                      <span style={{ color: 'var(--t3)', fontSize: 10 }}>{r.pct > 0 ? `+${r.pct}%` : `${r.pct}%`}</span>
                    </div>
                  </div>
                  <div style={{ background: 'var(--g200)', borderRadius: 'var(--pill)', height: 7, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.abs(r.pct)}%`, height: '100%', background: r.color, borderRadius: 'var(--pill)', opacity: r.pct < 0 ? 0.7 : 1 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Historique virements */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-building-columns"></i> Virements Shopi</div>
            </div>
            <div className="cb">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {VIREMENTS.map((v, i) => (
                  <div key={i} className="vir-item" onClick={() => pop(`🏦 Virement ${v.ref}`, 'i')}>
                    <div className={`vir-dot ${v.status}`}></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--navy)' }}>{v.mt}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--t3)', marginTop: 1 }}>{v.period} · {v.date}</div>
                    </div>
                    <span className={`s-pill ${v.status === 'done' ? 's-del' : 's-prep'}`} style={{ fontSize: 9 }}>
                      {v.status === 'done' ? '✓ Reçu' : '⏳ Attente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions rapides */}
          <div className="card">
            <div className="ch"><div className="ch-t"><i className="fas fa-bolt"></i> Actions</div></div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { ic: '📊', l: 'Télécharger bilan mensuel' },
                { ic: '🏦', l: 'Demander virement anticipé' },
                { ic: '⚙️', l: 'Modifier infos bancaires' },
                { ic: '📋', l: 'Voir factures Shopi' },
              ].map((a, i) => (
                <button key={i} onClick={() => pop(`⚙️ ${a.l}`, 'i')}
                  style={{ background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 12.5, fontWeight: 600, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', textAlign: 'left', transition: 'all .18s' }}>
                  <span style={{ fontSize: 16 }}>{a.ic}</span>{a.l}
                  <i className="fas fa-arrow-right" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t4)' }}></i>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}