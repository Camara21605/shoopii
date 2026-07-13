// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/sections/OverviewSection.tsx
//
// Section "Vue d'ensemble" — données 100% réelles depuis l'API.
// Endpoints consommés :
//   GET /dashboard/super-admin/overview       → stats utilisateurs
//   GET /dashboard/super-admin/platform-stats → commandes/produits/inscriptions 14j
//   GET /support/agent/stats                  → tickets support
//   GET /admin/notifications/stats?days=30    → stats notifications
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';
import type { SuperAdminStore } from '../hooks/useSuperAdminState';

interface Props {
  store:    SuperAdminStore;
  toast:    (type: string, msg: string) => void;
  isActive: boolean;
}

/* ── Shapes des réponses API ────────────────────────────────── */
interface OverviewData {
  total:      number;
  parRole:    Record<string, number>;
  parStatut:  Record<string, number>;
  parPays:    Record<string, number>;
  nouveaux30j: number;
}

interface PlatformStats {
  totalProduits:    number;
  totalCommandes:   number;
  commandesCeMois:  number;
  commandesEnCours: number;
  commission:       number;
  maintenanceMode:  boolean;
  inscriptions14j:  { date: string; count: number }[];
}

interface SupportStats {
  total:           number;
  openCount:       number;
  inProgressCount: number;
  resolvedCount:   number;
  avgCsat:         number;
  slaBreachedCount: number;
  last7Days:       { date: string; created: number; resolved: number }[];
}

interface NotifStats {
  totalCreated: number;
  totalUnread:  number;
  unreadRate:   number;
}

/* ── Constantes UI ──────────────────────────────────────────── */
const ROLE_LBL: Record<string, string> = {
  company:       '🏪 Entreprises',
  delivery:      '🛵 Livreurs',
  client:        '🛒 Clients',
  partner:       '🤝 Partenaires',
  correspondent: '📦 Correspondants',
  admin:         '🛡 Admins',
};

const ROLE_COLOR: Record<string, string> = {
  company:       '#38BFFF',
  delivery:      '#F5A623',
  client:        '#00C88A',
  partner:       '#BF7FFF',
  correspondent: '#FF7043',
  admin:         '#FF4464',
};

const ROLE_VAR: Record<string, string> = {
  company:       'var(--sky)',
  delivery:      'var(--gold)',
  client:        'var(--acid)',
  partner:       'var(--violet)',
  correspondent: 'var(--coral)',
  admin:         'var(--rose)',
};

const FLAGS: Record<string, string> = { GN: '🇬🇳', SN: '🇸🇳', ML: '🇲🇱', CI: '🇨🇮' };
const COUNTRY_NAMES: Record<string, string> = {
  GN: 'Guinée', SN: 'Sénégal', ML: 'Mali', CI: "Côte d'Ivoire",
};

const ROLE_ORDER = ['client','company','delivery','partner','correspondent','admin'];

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace('.0','') + 'k';
  return String(n);
}

/* ── Composant KPI ──────────────────────────────────────────── */
function KpiCard({
  label, value, icon, color, trend, trendUp, sub,
}: {
  label: string; value: string | number; icon: string;
  color: string; trend?: string; trendUp?: boolean; sub?: string;
}) {
  return (
    <div className={`kpi ${color}`}>
      <div className="kpi-top">
        <div className="kpi-label">{label}</div>
        <div className="kpi-ico">{icon}</div>
      </div>
      <div className="kpi-val">{typeof value === 'number' ? value.toLocaleString('fr') : value}</div>
      <div className="kpi-foot">
        {trend && <span className={`kpi-trend ${trendUp === false ? 'down' : trendUp ? 'up' : 'flat'}`}>{trend}</span>}
        {sub && <span style={{ fontSize: 10, color: 'var(--txt-3)' }}>{sub}</span>}
      </div>
    </div>
  );
}

/* ── Squelette chargement ───────────────────────────────────── */
function Skeleton({ h = 18, w = '100%' }: { h?: number; w?: number | string }) {
  return (
    <div style={{
      height: h, width: w, background: 'var(--border)', borderRadius: 6, opacity: 0.5,
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  );
}

/* ── Graphique inscriptions SVG ─────────────────────────────── */
function InscriptionsChart({ data }: { data: { date: string; count: number }[] }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !data.length) return;
    const W = 760, H = 180, pL = 10, pR = 10, pT = 24, pB = 10;
    const gW = W - pL - pR, gH = H - pT - pB;
    const counts = data.map(d => d.count);
    const mx = Math.max(...counts, 1);
    const toX = (i: number) => pL + (i / (data.length - 1)) * gW;
    const toY = (v: number) => pT + gH - (v / mx) * gH;
    const path = 'M' + data.map((d, i) => `${toX(i)},${toY(d.count)}`).join('L');
    const area = path + `L${toX(data.length - 1)},${pT + gH}L${toX(0)},${pT + gH}Z`;

    const maxIdx = counts.indexOf(Math.max(...counts));

    ref.current.innerHTML = `
      <defs>
        <linearGradient id="ga1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#00C88A" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#00C88A" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="gl1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#38BFFF"/>
          <stop offset="100%" stop-color="#00C88A"/>
        </linearGradient>
      </defs>
      ${[0, .25, .5, .75, 1].map(p =>
        `<line x1="${pL}" y1="${pT + gH * p}" x2="${W - pR}" y2="${pT + gH * p}"
          stroke="rgba(128,128,128,0.06)" stroke-width="1"/>`
      ).join('')}
      <path d="${area}" fill="url(#ga1)"/>
      <path d="${path}" fill="none" stroke="url(#gl1)" stroke-width="2.5"
        stroke-linejoin="round" stroke-linecap="round"/>
      ${data.map((d, i) => {
        const x = toX(i), y = toY(d.count);
        const isMax  = i === maxIdx && d.count > 0;
        const isLast = i === data.length - 1;
        if (!isMax && !isLast) {
          return `<circle cx="${x}" cy="${y}" r="2.5" fill="var(--surface)" stroke="#38BFFF" stroke-width="1.5"/>`;
        }
        const col = isLast ? '#00C88A' : '#F5A623';
        return `
          <circle cx="${x}" cy="${y}" r="14" fill="${col}" fill-opacity="0.1"/>
          <circle cx="${x}" cy="${y}" r="5"  fill="${col}"/>
          <text x="${x}" y="${y - 14}" text-anchor="middle" fill="${col}"
            font-size="10" font-family="Space Mono" font-weight="700">${d.count}</text>
        `;
      }).join('')}
    `;
  }, [data]);

  return <svg ref={ref} className="svg-chart" viewBox="0 0 760 180" height={180} preserveAspectRatio="none" />;
}

/* ── Donut SVG ──────────────────────────────────────────────── */
function DonutChart({ parRole, total }: { parRole: Record<string, number>; total: number }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const R = 50, cx = 60, cy = 60, stroke = 14, circ = 2 * Math.PI * R;
    let offset = 0;
    let segs = '';
    for (const role of ROLE_ORDER) {
      const cnt = parRole[role] ?? 0;
      const pct = total ? cnt / total : 0;
      const dash = pct * circ;
      const gap  = circ - dash;
      segs += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none"
        stroke="${ROLE_COLOR[role]}" stroke-width="${stroke}"
        stroke-dasharray="${dash} ${gap}"
        stroke-dashoffset="${-offset * circ}"
        transform="rotate(-90 ${cx} ${cy})" opacity="0.85"/>`;
      offset += pct;
    }
    ref.current.innerHTML = segs + `
      <text x="${cx}" y="${cy - 5}" text-anchor="middle" fill="var(--txt-1)"
        font-family="Cabinet Grotesk" font-weight="900" font-size="16">${fmt(total)}</text>
      <text x="${cx}" y="${cy + 10}" text-anchor="middle" fill="var(--txt-3)"
        font-family="var(--font-s)" font-size="8">comptes</text>
    `;
  }, [parRole, total]);

  return <svg ref={ref} viewBox="0 0 120 120" width={120} height={120} />;
}

/* ══════════════════════════════════════════════════════════════
 * Composant principal
 * ══════════════════════════════════════════════════════════════ */
export default function OverviewSection({ store, isActive }: Props) {
  const [ovData,    setOvData]    = useState<OverviewData | null>(null);
  const [platData,  setPlatData]  = useState<PlatformStats | null>(null);
  const [supData,   setSupData]   = useState<SupportStats | null>(null);
  const [notifData, setNotifData] = useState<NotifStats | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!isActive) return;
    setLoading(true);
    setError(null);

    Promise.all([
      apiFetch<OverviewData>('/dashboard/super-admin/overview'),
      apiFetch<PlatformStats>('/dashboard/super-admin/platform-stats'),
      apiFetch<SupportStats>('/support/agent/stats'),
      apiFetch<NotifStats>('/admin/notifications/stats?days=30'),
    ])
      .then(([ov, plat, sup, notif]) => {
        setOvData(ov);
        setPlatData(plat);
        setSupData(sup);
        setNotifData(notif);
      })
      .catch(() => setError('Impossible de charger les statistiques.'))
      .finally(() => setLoading(false));
  }, [isActive]);

  if (!isActive) return null;

  /* Données calculées */
  const total       = ovData?.total       ?? 0;
  const nouveaux30j = ovData?.nouveaux30j ?? 0;
  const parRole     = ovData?.parRole     ?? {};
  const parStatut   = ovData?.parStatut   ?? {};
  const parPays     = ovData?.parPays     ?? {};
  const actifs      = parStatut['active'] ?? 0;
  const bloques     = (parStatut['blocked'] ?? 0) + (parStatut['suspended'] ?? 0);

  const chartData = platData?.inscriptions14j ?? Array.from({ length: 14 }, (_, i) => ({
    date:  new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10),
    count: 0,
  }));

  const chartLabels = chartData.map(d => {
    const [,m,j] = d.date.split('-');
    return `${j}/${m}`;
  });

  const pendingAlerts = store.alerts.filter(a => !a.resolved).slice(0, 4);
  const auditRecent   = store.auditLog.slice(0, 5);
  const validCodes    = store.codes.filter(c => c.status === 'valid').length;

  return (
    <div className="section active">

      {/* ── En-tête ── */}
      <div className="page-header">
        <div>
          <div className="ph-title">Vue <mark>d'Ensemble</mark></div>
          <div className="ph-sub">
            {loading ? 'Chargement des données…' : `Tableau de bord Shopi Africa — ${new Date().toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })}`}
          </div>
        </div>
        <div className="ph-actions">
          {platData?.maintenanceMode && (
            <span style={{ background:'rgba(220,38,38,.12)', color:'#dc2626', border:'1px solid rgba(220,38,38,.3)', borderRadius:8, padding:'4px 12px', fontSize:11, fontWeight:700 }}>
              ⚠️ MAINTENANCE ACTIVE
            </span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => store.navigate('invitations')}>
            + Code invitation
          </button>
        </div>
      </div>

      {/* ── Erreur globale ── */}
      {error && !loading && (
        <div style={{ margin:'0 0 16px', padding:'12px 16px', background:'rgba(220,38,38,.08)', border:'1px solid rgba(220,38,38,.25)', borderRadius:10, fontSize:12, color:'#dc2626', display:'flex', gap:10, alignItems:'center' }}>
          ⚠️ {error}
          <button onClick={() => { setLoading(true); setError(null); }}
            style={{ marginLeft:'auto', background:'none', border:'1px solid currentColor', borderRadius:5, padding:'2px 8px', fontSize:11, cursor:'pointer', color:'inherit' }}>
            Réessayer
          </button>
        </div>
      )}

      {/* ── KPI Utilisateurs ── */}
      <div className="kpi-row">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="kpi acid" style={{ minHeight: 90, display:'flex', flexDirection:'column', gap:8, padding:16 }}>
              <Skeleton h={12} w="60%" /><Skeleton h={28} w="40%" /><Skeleton h={10} w="70%" />
            </div>
          ))
        ) : (
          <>
            <KpiCard label="Total Comptes"  icon="👥" value={total}       color="acid"   trend={`↑ +${nouveaux30j} ce mois`} trendUp />
            <KpiCard label="Actifs"         icon="✅" value={actifs}      color="acid"   trend={`${total ? Math.round(actifs/total*100) : 0}% du total`} trendUp />
            <KpiCard label="Nouveaux 30j"   icon="🆕" value={nouveaux30j} color="sky"    trend="inscrits ce mois" trendUp />
            <KpiCard label="Bloqués / Susp" icon="🚫" value={bloques}     color="rose"   trend={bloques ? `⚠️ à traiter` : '✅ Aucun'} trendUp={!bloques} />
            <KpiCard label="Entreprises"    icon="🏪" value={parRole['company'] ?? 0}   color="sky"    trend="boutiques" />
            <KpiCard label="Codes valides"  icon="🎫" value={validCodes}  color="violet" trend="invitation" />
          </>
        )}
      </div>

      {/* ── KPI Plateforme ── */}
      <div className="kpi-row" style={{ marginTop: -8 }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="kpi acid" style={{ minHeight: 90, display:'flex', flexDirection:'column', gap:8, padding:16 }}>
              <Skeleton h={12} w="60%" /><Skeleton h={28} w="40%" /><Skeleton h={10} w="70%" />
            </div>
          ))
        ) : (
          <>
            <KpiCard label="Total Commandes"  icon="🛍" value={platData?.totalCommandes ?? 0}   color="sky"    trend={`+${platData?.commandesCeMois ?? 0} ce mois`} trendUp />
            <KpiCard label="Commandes actives" icon="⚙️" value={platData?.commandesEnCours ?? 0} color="gold"   trend="en cours de livraison" />
            <KpiCard label="Produits publiés"  icon="📦" value={platData?.totalProduits ?? 0}    color="acid"   trend="sur la plateforme" trendUp />
            <KpiCard label="Commission"        icon="💰" value={`${platData?.commission ?? 0} %`} color="violet" trend="taux plateforme" />
          </>
        )}
      </div>

      {/* ── Grille principale ── */}
      <div className="overview-grid">

        {/* ─── Colonne gauche ─── */}
        <div className="overview-left">

          {/* Graphique inscriptions 14j */}
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Inscriptions — 14 derniers jours</div>
                <div className="card-sub">
                  {loading ? '…' : `Total ${total.toLocaleString('fr')} comptes · +${nouveaux30j} ce mois`}
                </div>
              </div>
              <span className="badge b-acid">{loading ? '…' : `${actifs} actifs`}</span>
            </div>
            <div className="chart-wrap">
              {loading
                ? <Skeleton h={180} />
                : <InscriptionsChart data={chartData} />
              }
            </div>
            <div className="chart-labels">
              {chartLabels.map((l, i) => <span key={i}>{l}</span>)}
            </div>
          </div>

          {/* Répartition par rôle (barres) */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">Répartition par rôle</div>
              <span className="badge b-sky">{total.toLocaleString('fr')} comptes</span>
            </div>
            <div className="role-breakdown">
              {ROLE_ORDER.map(role => {
                const cnt = parRole[role] ?? 0;
                const pct = total ? Math.round(cnt / total * 100) : 0;
                const [ico] = (ROLE_LBL[role] ?? '').split(' ');
                const name = (ROLE_LBL[role] ?? role).replace(/^\S+ /, '');
                return (
                  <div key={role} className="rb-item">
                    <span className="rb-ico">{ico}</span>
                    <span className="rb-name">{name}</span>
                    <div className="rb-bar">
                      <div className="rb-fill" style={{ background: ROLE_VAR[role], width: `${pct}%` }} />
                    </div>
                    <span className="rb-val">{loading ? '…' : cnt.toLocaleString('fr')}</span>
                    <span className="rb-pct">{loading ? '' : `${pct}%`}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Répartition par pays */}
          {!loading && Object.keys(parPays).length > 0 && (
            <div className="card">
              <div className="card-head">
                <div className="card-title">Répartition géographique</div>
                <span className="badge b-muted">{Object.keys(parPays).length} pays</span>
              </div>
              <div className="role-breakdown">
                {Object.entries(parPays)
                  .sort(([,a],[,b]) => b - a)
                  .slice(0, 6)
                  .map(([code, cnt]) => {
                    const pct = total ? Math.round(cnt / total * 100) : 0;
                    return (
                      <div key={code} className="rb-item">
                        <span className="rb-ico">{FLAGS[code] ?? '🌍'}</span>
                        <span className="rb-name">{COUNTRY_NAMES[code] ?? code}</span>
                        <div className="rb-bar">
                          <div className="rb-fill" style={{ background:'var(--sky)', width:`${pct}%` }} />
                        </div>
                        <span className="rb-val">{cnt.toLocaleString('fr')}</span>
                        <span className="rb-pct">{pct}%</span>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          )}
        </div>

        {/* ─── Colonne droite ─── */}
        <div className="overview-right">

          {/* Donut */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">Répartition rôles</div>
              <span className="badge b-muted">Donut</span>
            </div>
            <div className="donut-wrap">
              {loading
                ? <div style={{ width:120, height:120, borderRadius:'50%', background:'var(--border)', opacity:.5 }} />
                : <DonutChart parRole={parRole} total={total} />
              }
              <div className="donut-legend">
                {ROLE_ORDER.map(role => (
                  <div key={role} className="donut-leg-item">
                    <div className="donut-leg-left">
                      <div className="donut-leg-dot" style={{ background: ROLE_COLOR[role] }} />
                      <span>{ROLE_LBL[role]}</span>
                    </div>
                    <span className="donut-leg-val">
                      {loading ? '…' : (parRole[role] ?? 0).toLocaleString('fr')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Support client */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">Support client</div>
              {supData && supData.slaBreachedCount > 0
                ? <span className="badge b-rose">⚠️ {supData.slaBreachedCount} SLA</span>
                : <span className="badge b-acid">✅ OK</span>
              }
            </div>
            {loading
              ? <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:8 }}>
                  <Skeleton /><Skeleton w="70%" /><Skeleton w="50%" />
                </div>
              : supData && (
                <div style={{ padding:'4px 0' }}>
                  {[
                    { lbl:'Tickets ouverts',   val: supData.openCount,       ico:'🔴', hi: supData.openCount > 10 },
                    { lbl:'En cours',          val: supData.inProgressCount, ico:'🟡', hi: false },
                    { lbl:'Résolus',           val: supData.resolvedCount,   ico:'🟢', hi: false },
                    { lbl:'CSAT moyen',        val: supData.avgCsat > 0 ? supData.avgCsat.toFixed(1) + ' / 5' : 'N/A', ico:'⭐', hi: false },
                  ].map(row => (
                    <div key={row.lbl} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 16px', borderBottom:'1px solid var(--border)' }}>
                      <span style={{ fontSize:13 }}>{row.ico}</span>
                      <span style={{ flex:1, fontSize:12, color:'var(--txt-2)' }}>{row.lbl}</span>
                      <span style={{ fontFamily:'var(--font-m)', fontSize:13, fontWeight:700, color: row.hi ? 'var(--rose)' : 'var(--txt-1)' }}>
                        {typeof row.val === 'number' ? row.val.toLocaleString('fr') : row.val}
                      </span>
                    </div>
                  ))}
                  <div style={{ padding:'8px 16px', display:'flex', justifyContent:'flex-end' }}>
                    <button className="btn btn-ghost btn-xs" onClick={() => store.navigate('support')}>
                      Voir tous →
                    </button>
                  </div>
                </div>
              )
            }
          </div>

          {/* Notifications */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">Notifications (30j)</div>
              <span className="badge b-sky">Live</span>
            </div>
            {loading
              ? <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:8 }}>
                  <Skeleton /><Skeleton w="70%" />
                </div>
              : notifData && (
                <div style={{ padding:'4px 0' }}>
                  {[
                    { lbl:'Envoyées',        val: notifData.totalCreated,                   ico:'🔔' },
                    { lbl:'Non lues',        val: notifData.totalUnread,                    ico:'📭' },
                    { lbl:'Taux de lecture', val: `${(100 - notifData.unreadRate).toFixed(1)}%`, ico:'📊' },
                  ].map(row => (
                    <div key={row.lbl} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 16px', borderBottom:'1px solid var(--border)' }}>
                      <span style={{ fontSize:13 }}>{row.ico}</span>
                      <span style={{ flex:1, fontSize:12, color:'var(--txt-2)' }}>{row.lbl}</span>
                      <span style={{ fontFamily:'var(--font-m)', fontSize:13, fontWeight:700 }}>
                        {typeof row.val === 'number' ? row.val.toLocaleString('fr') : row.val}
                      </span>
                    </div>
                  ))}
                </div>
              )
            }
          </div>

          {/* Signalements récents */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">Signalements récents</div>
              <span className="badge b-rose">{pendingAlerts.length}</span>
            </div>
            {pendingAlerts.map(a => (
              <div key={a.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:14 }}>{a.icon}</span>
                <div style={{ flex:1, fontSize:11.5 }}>
                  <div style={{ fontWeight:700 }}>{a.title}</div>
                  <div style={{ color:'var(--txt-3)', fontSize:10, marginTop:2 }}>{a.time}</div>
                </div>
                <button className="btn btn-ghost btn-xs" onClick={() => store.resolveAlert(a.id)}>✓</button>
              </div>
            ))}
            {!pendingAlerts.length && (
              <div style={{ padding:'14px 20px', fontSize:12, color:'var(--txt-2)' }}>
                ✅ Aucun signalement en attente
              </div>
            )}
            <div style={{ padding:'8px 16px', display:'flex', justifyContent:'flex-end' }}>
              <button className="btn btn-ghost btn-xs" onClick={() => store.navigate('alerts')}>Tous →</button>
            </div>
          </div>

          {/* Activité récente (audit) */}
          {auditRecent.length > 0 && (
            <div className="card">
              <div className="card-head">
                <div className="card-title">Activité récente</div>
                <span className="badge b-muted">Journal</span>
              </div>
              {auditRecent.map((e, i) => (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'9px 16px', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ fontSize:13, marginTop:1 }}>{e.icon}</span>
                  <div style={{ flex:1, fontSize:11 }}>
                    <span style={{ fontWeight:600 }}>{e.user}</span>
                    <span style={{ color:'var(--txt-3)' }}> {e.action}</span>
                  </div>
                  <span style={{ fontSize:10, color:'var(--txt-3)', whiteSpace:'nowrap', fontFamily:'var(--font-m)' }}>{e.time}</span>
                </div>
              ))}
              <div style={{ padding:'8px 16px', display:'flex', justifyContent:'flex-end' }}>
                <button className="btn btn-ghost btn-xs" onClick={() => store.navigate('audit')}>Voir tout →</button>
              </div>
            </div>
          )}

          {/* Accès rapides */}
          <div className="card">
            <div className="card-head"><div className="card-title">Accès rapides</div></div>
            <div style={{ padding:14, display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { ico:'🎫', lbl:'Codes invitation',     fn: () => store.navigate('invitations') },
                { ico:'👥', lbl:'Gestion utilisateurs', fn: () => store.navUsers('all') },
                { ico:'🎫', lbl:'Support client',       fn: () => store.navigate('support') },
                { ico:'📜', lbl:'Journal d\'audit',     fn: () => store.navigate('audit') },
                { ico:'❤️', lbl:'Santé système',        fn: () => store.navigate('system') },
                { ico:'⚙️', lbl:'Paramètres',           fn: () => store.navigate('settings') },
              ].map(item => (
                <button key={item.lbl} className="btn btn-ghost"
                  style={{ width:'100%', justifyContent:'flex-start' }}
                  onClick={item.fn}>
                  {item.ico} {item.lbl}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
