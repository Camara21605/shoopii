/*
 * FICHIER: src/dashboards/entreprise/pages/FinancesPage.tsx
 * Page Finances — solde, revenus, dépenses, transactions,
 * commissions Shopi, historique des virements. Données réelles
 * issues du wallet entreprise (GET /dashboard/entreprise/finances).
 */

import { useState, useEffect } from 'react';
import { useToast } from '../../../shared/context/ToastContext';
import { apiFetch } from '../../../shared/services/apiFetch';
import './FinancesPage.css';

interface Transaction {
  id: string; description: string; reference: string | null;
  montant: number; dir: 'in' | 'out'; date: string;
}
interface Virement { id: string; montant: number; statut: 'done' | 'pending'; date: string }
interface Repartition { label: string; montant: number; pct: number }
interface FinancesData {
  solde: number; soldeEnAttente: number;
  revenusMois: number; depensesMois: number; croissanceRevenus: number;
  caData: { m: string; v: number }[];
  transactions: Transaction[];
  virements: Virement[];
  repartition: Repartition[];
}

const EMPTY: FinancesData = {
  solde: 0, soldeEnAttente: 0, revenusMois: 0, depensesMois: 0, croissanceRevenus: 0,
  caData: [], transactions: [], virements: [], repartition: [],
};

function fmtGNF(n: number) {
  return Math.round(n).toLocaleString('fr-FR');
}

export default function FinancesPage() {
  const { pop } = useToast();
  const [data, setData]       = useState<FinancesData>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<FinancesData>('/dashboard/entreprise/finances')
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const { solde, soldeEnAttente, revenusMois, depensesMois, croissanceRevenus, caData, transactions, virements, repartition } = data;
  const maxCA = Math.max(1, ...caData.map(d => d.v));

  const BALANCE_STATS = [
    { ic: '💳', v: fmtGNF(solde),          l: 'Solde disponible',     k: 'k2', trend: 'Wallet entreprise' },
    { ic: '📈', v: fmtGNF(revenusMois),     l: 'Revenus ce mois',      k: 'k1', trend: `${croissanceRevenus >= 0 ? '+' : ''}${croissanceRevenus}% vs mois dernier` },
    { ic: '📉', v: fmtGNF(depensesMois),    l: 'Dépenses ce mois',     k: 'k5', trend: 'Commissions + livraison' },
    { ic: '⏳', v: fmtGNF(soldeEnAttente),  l: 'En attente (escrow)',  k: 'k3', trend: 'Libéré à la livraison' },
  ];

  return (
    <div className="page on" id="p-finances">

      <div className="kpi-grid">
        {BALANCE_STATS.map((s, i) => (
          <div key={i} className={`kpi ${s.k}`}>
            <div className="kpi-stripe"></div>
            <div className="kpi-top">
              <div className="kpi-icon">{s.ic}</div>
              <span className="kpi-badge up">{s.trend}</span>
            </div>
            <div className="kpi-val" style={{ fontSize: 20 }}>{s.v}</div>
            <div className="kpi-lbl">{s.l}</div>
            <div className="kpi-sub">GNF</div>
          </div>
        ))}
      </div>

      <div className="g3">
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-chart-area"></i> Évolution des revenus</div>
            </div>
            <div className="cb">
              {caData.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--t3)' }}>Aucune vente livrée pour l'instant.</div>
              )}
              <div className="chart-bars" style={{ height: 150 }}>
                {caData.map((d, i) => (
                  <div className="c-bar-wrap" key={i}>
                    <div
                      className="c-bar"
                      style={{
                        height: `${(d.v / maxCA) * 100}%`,
                        background: i === caData.length - 1
                          ? 'linear-gradient(180deg, var(--t2), var(--t2))'
                          : 'linear-gradient(180deg, var(--sky-3), var(--g200))',
                      }}
                    >
                      <div className="c-bar-v">{d.v}M</div>
                    </div>
                    <div className="c-lbl">{d.m}</div>
                  </div>
                ))}
              </div>
              <div className="chart-legend">
                <div className="cl-item"><div className="cl-dot" style={{ background: 'var(--t2)' }}></div>Revenus (M GNF)</div>
                <div className="cl-item"><div className="cl-dot" style={{ background: 'var(--sky-3)' }}></div>Mois précédents</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="ch">
              <div className="ch-t"><i className="fas fa-list-ul"></i> Transactions récentes</div>
            </div>
            <div className="cb">
              {transactions.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: 16, color: 'var(--t3)' }}>Aucune transaction pour l'instant.</div>
              )}
              <div className="tx-list">
                {transactions.map(t => (
                  <div key={t.id} className="tx-item" onClick={() => pop(`💰 ${t.description}`, 'i')}>
                    <div className="tx-ic" style={{ background: t.dir === 'in' ? 'var(--em-bg)' : 'var(--rs-bg)' }}>
                      <i className={`fas ${t.dir === 'in' ? 'fa-arrow-down' : 'fa-arrow-up'}`} style={{ fontSize: 14 }} />
                    </div>
                    <div className="tx-inf">
                      <div className="tx-nm">{t.description}</div>
                      <div className="tx-sub">{t.reference ?? new Date(t.date).toLocaleDateString('fr-FR')}</div>
                    </div>
                    <div className={`tx-amt ${t.dir}`}>
                      {t.montant >= 0 ? '+' : ''}{fmtGNF(t.montant)} <span className="tx-unit">GNF</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-chart-pie"></i> Répartition</div>
            </div>
            <div className="cb">
              {repartition.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: 16, color: 'var(--t3)' }}>Aucune donnée ce mois.</div>
              )}
              {repartition.map((r, i) => (
                <div key={i} style={{ marginBottom: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--t2)', fontWeight: 500 }}>{r.label}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, color: 'var(--t2)', fontFamily: 'var(--fd)', fontSize: 11 }}>
                        {r.montant >= 0 ? '' : '−'}{fmtGNF(Math.abs(r.montant) / 1_000_000)}M
                      </span>
                      <span style={{ color: 'var(--t3)', fontSize: 10 }}>{r.pct > 0 ? `+${r.pct}%` : `${r.pct}%`}</span>
                    </div>
                  </div>
                  <div style={{ background: 'var(--g200)', borderRadius: 'var(--pill)', height: 7, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.abs(r.pct)}%`, height: '100%', background: 'var(--t2)', borderRadius: 'var(--pill)', opacity: r.pct < 0 ? 0.7 : 1 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-building-columns"></i> Virements Shopi</div>
            </div>
            <div className="cb">
              {virements.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: 16, color: 'var(--t3)' }}>Aucun virement pour l'instant.</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {virements.map(v => (
                  <div key={v.id} className="vir-item" onClick={() => pop(`🏦 Virement ${v.id.slice(0, 8)}`, 'i')}>
                    <div className={`vir-dot ${v.statut}`}></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--navy)' }}>+{fmtGNF(v.montant)} GNF</div>
                      <div style={{ fontSize: 10.5, color: 'var(--t3)', marginTop: 1 }}>{new Date(v.date).toLocaleDateString('fr-FR')}</div>
                    </div>
                    <span className={`s-pill ${v.statut === 'done' ? 's-del' : 's-prep'}`} style={{ fontSize: 9 }}>
                      {v.statut === 'done' ? '✓ Reçu' : '⏳ Attente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

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
