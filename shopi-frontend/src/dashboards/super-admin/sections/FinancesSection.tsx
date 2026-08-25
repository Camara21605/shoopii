// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/sections/FinancesSection.tsx
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';
import type { SuperAdminStore } from '../hooks/useSuperAdminState';

interface Props { store: SuperAdminStore; isActive: boolean; }

// ─── Types API ─────────────────────────────────────────────

interface TimeSeriesPoint { date: string; value: number; count?: number; }

interface FinancesDashboard {
  kpis: {
    paiements: {
      total:            number;
      montantConfirme:  number;
      montantRembourse: number;
      nbConfirmes:      number;
      tauxReussite:     number;
      panierMoyen:      number;
      parProvider:      Record<string, { nb: number; montant: number }>;
      parMethode:       Record<string, { nb: number; montant: number }>;
    };
    commissions: {
      shopiTotal:    number;
      livreurs:      number;
      correspondants: number;
      totalDistribue: number;
    };
    retraits: {
      montantTotal:     number;
      montantCompleted: number;
      nbCompleted:      number;
      tauxReussite:     number;
    };
    litiges: {
      total:                number;
      ouverts:              number;
      montantRembourseTotal: number;
    };
    chiffreAffairesBrut: number;
    chiffreAffairesNet:  number;
    revenusShopi:        number;
    croissance:          number | null;
  };
  revenueTrend:    { points: TimeSeriesPoint[] };
  withdrawalTrend: { points: TimeSeriesPoint[] };
  topEntreprises:  Array<{ userId: string; nom: string; montant: number; nbCommandes: number }>;
  topLivreurs:     Array<{ userId: string; nom: string; montant: number; nbCommandes: number }>;
  generatedAt:     string;
}

// ─── Helpers ───────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' GNF';
}

function fmtN(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n);
}

function pct(n: number | null): string {
  if (n === null || n === undefined) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function drawChart(
  svg: SVGSVGElement,
  revenue:  TimeSeriesPoint[],
  withdrawals: TimeSeriesPoint[],
) {
  if (!revenue.length) { svg.innerHTML = ''; return; }

  const W = 760, H = 180, pL = 10, pR = 10, pT = 20, pB = 10;
  const gW = W - pL - pR, gH = H - pT - pB;
  const n  = revenue.length;

  const mx = Math.max(...revenue.map(p => p.value), ...withdrawals.map(p => p.value), 1) * 1.15;
  const toX = (i: number) => pL + (i / Math.max(n - 1, 1)) * gW;
  const toY = (v: number) => pT + gH - (v / mx) * gH;

  const pathR = 'M' + revenue.map((p, i)     => `${toX(i)},${toY(p.value)}`).join('L');
  const pathW = withdrawals.length
    ? 'M' + withdrawals.map((p, i) => `${toX(i)},${toY(p.value)}`).join('L')
    : '';
  const areaR = pathR + `L${toX(n - 1)},${pT + gH}L${toX(0)},${pT + gH}Z`;

  svg.innerHTML = `
    <defs>
      <linearGradient id="ga-rev" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#00C88A" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#00C88A" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${[0, .25, .5, .75, 1].map(p =>
      `<line x1="${pL}" y1="${pT + gH * p}" x2="${W - pR}" y2="${pT + gH * p}"
             stroke="rgba(128,128,128,0.07)" stroke-width="1"/>`
    ).join('')}
    <path d="${areaR}" fill="url(#ga-rev)"/>
    <path d="${pathR}" fill="none" stroke="var(--acid)" stroke-width="2.5"
          stroke-linejoin="round" stroke-linecap="round"/>
    ${pathW ? `<path d="${pathW}" fill="none" stroke="var(--rose)" stroke-width="2"
          stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="6 3"/>` : ''}
    ${revenue.map((p, i) =>
      `<circle cx="${toX(i)}" cy="${toY(p.value)}" r="3.5"
               fill="var(--surface)" stroke="var(--acid)" stroke-width="1.5"/>`
    ).join('')}
    ${withdrawals.map((p, i) =>
      `<circle cx="${toX(i)}" cy="${toY(p.value)}" r="3"
               fill="var(--surface)" stroke="var(--rose)" stroke-width="1.5"/>`
    ).join('')}
  `;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ─── Composant ─────────────────────────────────────────────

export default function FinancesSection({ isActive }: Props) {
  const revenueRef = useRef<SVGSVGElement>(null);
  const [data, setData]       = useState<FinancesDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!isActive) return;
    setLoading(true);
    setError(null);
    apiFetch<FinancesDashboard>('/dashboard/super-admin/finances')
      .then(d => setData(d))
      .catch(e => setError(e?.message ?? 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [isActive]);

  useEffect(() => {
    if (!data || !revenueRef.current) return;
    drawChart(
      revenueRef.current,
      data.revenueTrend?.points    ?? [],
      data.withdrawalTrend?.points ?? [],
    );
  }, [data]);

  if (!isActive) return null;

  const kpis = data?.kpis;

  /* Fournisseurs de paiement (MTN, Orange, …) */
  const providers = kpis
    ? Object.entries(kpis.paiements.parProvider ?? {})
        .sort((a, b) => b[1].montant - a[1].montant)
    : [];

  /* Étiquettes de l'axe X du graphique */
  const chartLabels = (data?.revenueTrend?.points ?? []).map(p => shortDate(p.date));

  const croissancePos = (kpis?.croissance ?? 0) >= 0;

  const finCards = kpis ? [
    {
      label: 'CA Brut',
      val:   fmt(kpis.chiffreAffairesBrut),
      sub:   '30 derniers jours',
      trend: pct(kpis.croissance),
      up:    croissancePos,
      color: 'var(--acid)',
      ico:   '💰',
    },
    {
      label: 'Revenus Shoneya',
      val:   fmt(kpis.revenusShopi),
      sub:   'Commissions + frais',
      trend: '',
      up:    true,
      color: 'var(--sky)',
      ico:   '📈',
    },
    {
      label: 'CA Net',
      val:   fmt(kpis.chiffreAffairesNet),
      sub:   `Marge ${kpis.chiffreAffairesBrut > 0 ? ((kpis.chiffreAffairesNet / kpis.chiffreAffairesBrut) * 100).toFixed(1) : 0}%`,
      trend: '',
      up:    true,
      color: 'var(--violet)',
      ico:   '📊',
    },
    {
      label: 'Paiements confirmés',
      val:   fmtN(kpis.paiements.nbConfirmes),
      sub:   `Taux réussite ${kpis.paiements.tauxReussite.toFixed(1)}%`,
      trend: '',
      up:    true,
      color: 'var(--gold)',
      ico:   '✅',
    },
    ...providers.slice(0, 2).map(([name, p]) => ({
      label: name,
      val:   fmtN(p.nb),
      sub:   fmt(p.montant),
      trend: '',
      up:    true,
      color: name.toLowerCase().includes('orange') ? 'var(--coral)' : 'var(--gold)',
      ico:   '📱',
    })),
    {
      label: 'Commissions Shoneya',
      val:   fmt(kpis.commissions.shopiTotal),
      sub:   `Total distribué ${fmt(kpis.commissions.totalDistribue)}`,
      trend: '',
      up:    true,
      color: 'var(--violet)',
      ico:   '🤝',
    },
    {
      label: 'Retraits effectués',
      val:   fmt(kpis.retraits.montantCompleted),
      sub:   `${kpis.retraits.nbCompleted} retraits validés`,
      trend: '',
      up:    true,
      color: 'var(--sky)',
      ico:   '🏦',
    },
    {
      label: 'Remboursements',
      val:   fmt(kpis.paiements.montantRembourse),
      sub:   `${kpis.litiges.total} litiges (${kpis.litiges.ouverts} ouverts)`,
      trend: '',
      up:    false,
      color: 'var(--rose)',
      ico:   '↩',
    },
  ] : [];

  return (
    <div className="section active">
      <div className="page-header">
        <div>
          <div className="ph-title">Tableau <mark>Financier</mark></div>
          <div className="ph-sub">Revenus, dépenses et transactions — 30 derniers jours</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost btn-sm">⬇ Export PDF</button>
          <button className="btn btn-primary btn-sm">📊 Rapport complet</button>
        </div>
      </div>

      {/* ── État de chargement ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 32, color: 'var(--acid)' }} />
          <div style={{ marginTop: 12, color: 'var(--txt-3)', fontSize: 13 }}>Chargement des données financières…</div>
        </div>
      )}

      {/* ── Erreur ── */}
      {error && !loading && (
        <div className="card" style={{ padding: 24, color: 'var(--rose)', textAlign: 'center' }}>
          <i className="fas fa-triangle-exclamation" style={{ marginRight: 8 }} />
          {error}
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 16 }}
            onClick={() => {
              setLoading(true);
              setError(null);
              apiFetch<FinancesDashboard>('/dashboard/super-admin/finances')
                .then(d => setData(d))
                .catch(e => setError(e?.message ?? 'Erreur'))
                .finally(() => setLoading(false));
            }}
          >
            <i className="fas fa-rotate" /> Réessayer
          </button>
        </div>
      )}

      {/* ── Contenu réel ── */}
      {data && !loading && (
        <>
          {/* Finance cards — ligne 1 */}
          <div className="finance-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {finCards.slice(0, 4).map((f, i) => (
              <div key={i} className="fin-card">
                <div className="fin-label">{f.ico} {f.label}</div>
                <div className="fin-val" style={{ color: f.color }}>{f.val}</div>
                <div className="fin-sub">{f.sub}</div>
                {f.trend && (
                  <div className="fin-trend" style={{ color: f.up ? 'var(--acid)' : 'var(--rose)' }}>
                    {f.up ? '↑' : '↓'} {f.trend}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Finance cards — ligne 2 */}
          <div className="finance-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {finCards.slice(4).map((f, i) => (
              <div key={i} className="fin-card">
                <div className="fin-label">{f.ico} {f.label}</div>
                <div className="fin-val" style={{ color: f.color }}>{f.val}</div>
                <div className="fin-sub">{f.sub}</div>
              </div>
            ))}
          </div>

          {/* Graphique revenus */}
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Évolution CA brut / Retraits — 30 jours</div>
                <div className="card-sub">En francs guinéens (GNF)</div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11 }}>
                <span>
                  <span style={{ display: 'inline-block', width: 12, height: 3, background: 'var(--acid)', borderRadius: 2, marginRight: 5, verticalAlign: 'middle' }} />
                  CA brut
                </span>
                <span>
                  <span style={{ display: 'inline-block', width: 12, height: 3, background: 'var(--rose)', borderRadius: 2, marginRight: 5, verticalAlign: 'middle', opacity: 0.7 }} />
                  Retraits
                </span>
              </div>
            </div>
            <div className="chart-wrap">
              <svg ref={revenueRef} className="svg-chart" viewBox="0 0 760 180" height={180} preserveAspectRatio="none" />
            </div>
            {chartLabels.length > 0 && (
              <div className="chart-labels">
                {chartLabels.map((l, i) => <span key={i}>{l}</span>)}
              </div>
            )}
          </div>

          {/* Top entreprises */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">Top entreprises — CA généré</div>
              <span className="badge b-sky">30 derniers jours</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              {data.topEntreprises.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--txt-3)', fontSize: 13 }}>
                  Aucune donnée pour la période
                </div>
              ) : (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Entreprise</th>
                      <th>Commandes</th>
                      <th>CA généré</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topEntreprises.map((e, i) => (
                      <tr key={e.userId}>
                        <td style={{ fontFamily: 'var(--font-m)', fontWeight: 700, color: 'var(--txt-3)', fontSize: 12 }}>
                          {i + 1}
                        </td>
                        <td style={{ fontWeight: 600 }}>{e.nom}</td>
                        <td style={{ fontFamily: 'var(--font-m)', fontSize: 12 }}>{fmtN(e.nbCommandes)}</td>
                        <td style={{ fontFamily: 'var(--font-m)', color: 'var(--acid)', fontWeight: 700 }}>
                          {fmt(e.montant)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Top livreurs */}
          {data.topLivreurs.length > 0 && (
            <div className="card">
              <div className="card-head">
                <div className="card-title">Top livreurs — commissions</div>
                <span className="badge b-sky">30 derniers jours</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Livreur</th>
                      <th>Livraisons</th>
                      <th>Commissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topLivreurs.map((l, i) => (
                      <tr key={l.userId}>
                        <td style={{ fontFamily: 'var(--font-m)', fontWeight: 700, color: 'var(--txt-3)', fontSize: 12 }}>
                          {i + 1}
                        </td>
                        <td style={{ fontWeight: 600 }}>{l.nom}</td>
                        <td style={{ fontFamily: 'var(--font-m)', fontSize: 12 }}>{fmtN(l.nbCommandes)}</td>
                        <td style={{ fontFamily: 'var(--font-m)', color: 'var(--sky)', fontWeight: 700 }}>
                          {fmt(l.montant)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
