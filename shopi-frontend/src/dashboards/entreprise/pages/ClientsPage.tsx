/*
 * FICHIER : src/dashboards/entreprise/pages/ClientsPage.tsx
 *
 * Page Clients — tableau de bord CRM de l'entreprise.
 *
 * DEUX SOURCES DE CLIENTS (fusionnées côté backend) :
 *   1. Acheteurs  → ont passé ≥ 1 commande dans cette boutique
 *   2. Abonnés    → suivent la boutique sans forcément avoir acheté
 *
 * SEGMENTS AUTOMATIQUES (calculés par le backend) :
 *   👑 VIP       → ≥ 10M GNF dépensés OU ≥ 10 commandes
 *   ⭐ Fidèle    → ≥ 5 commandes
 *   🔄 Régulier  → ≥ 2 commandes
 *   🆕 Nouveau   → 1 commande
 *   👁️ Abonné    → suit la boutique, jamais acheté
 *
 * DONNÉES : 100% dynamiques — GET /dashboard/entreprise/clients
 */

import { useState } from 'react';
import { useToast }        from '../../../shared/context/ToastContext';
import { useClients, type ClientSegment, type ClientRow } from '../hooks/useClients';
import ClientProfilModal   from './ClientProfilModal';

/* ════════════════════════════════════════════════════════════
 * CONSTANTES DE STYLE
 * ════════════════════════════════════════════════════════════ */

/** Couleur et libellé par segment */
const SEGMENT_META: Record<ClientSegment, {
  label: string; emoji: string;
  bg: string; color: string; border: string;
}> = {
  VIP:      { label: 'VIP',       emoji: '👑', bg: 'var(--am-bg)',  color: 'var(--amber)',   border: 'rgba(217,119,6,.22)'  },
  Fidèle:   { label: 'Fidèle',    emoji: '⭐', bg: 'var(--em-bg)', color: 'var(--emerald)', border: 'rgba(5,150,105,.22)'  },
  Régulier: { label: 'Régulier',  emoji: '🔄', bg: 'var(--sky-2)', color: 'var(--blue)',    border: 'var(--sky-3)'         },
  Nouveau:  { label: 'Nouveau',   emoji: '🆕', bg: 'var(--vl-bg)', color: 'var(--violet)',  border: 'rgba(124,58,237,.22)' },
  Abonné:   { label: 'Abonné',   emoji: '👁️', bg: 'var(--g100)',   color: 'var(--t2)',      border: 'var(--bdr2)'          },
};

/** Couleurs d'avatar cycliques */
const AVATAR_COLORS = ['#1652F0','#059669','#7C3AED','#E11D48','#D97706','#0891B2','#BE185D','#0F766E'];

/* ════════════════════════════════════════════════════════════
 * SOUS-COMPOSANTS
 * ════════════════════════════════════════════════════════════ */

/** Badge de segment */
function SegBadge({ seg }: { seg: ClientSegment }) {
  const m = SEGMENT_META[seg];
  return (
    <span style={{
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
      fontSize: 10, fontWeight: 800, padding: '3px 9px',
      borderRadius: 'var(--pill)', letterSpacing: '.4px',
      display: 'inline-flex', alignItems: 'center', gap: 3,
    }}>
      {m.emoji} {m.label}
    </span>
  );
}

/** Badge source */
function SourceBadge({ isSuivi, totalOrders }: { isSuivi: boolean; totalOrders: number }) {
  if (totalOrders > 0 && isSuivi) return (
    <span style={{ fontSize: 9.5, color: 'var(--t3)', background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 999, padding: '2px 8px', fontWeight: 600 }}>
      🛒 + 👁️
    </span>
  );
  if (totalOrders > 0) return (
    <span style={{ fontSize: 9.5, color: 'var(--blue)', background: 'var(--sky)', border: '1px solid var(--sky-3)', borderRadius: 999, padding: '2px 8px', fontWeight: 600 }}>
      🛒 Acheteur
    </span>
  );
  return (
    <span style={{ fontSize: 9.5, color: 'var(--t2)', background: 'var(--g100)', border: '1px solid var(--bdr2)', borderRadius: 999, padding: '2px 8px', fontWeight: 600 }}>
      👁️ Abonné
    </span>
  );
}

/** Avatar avec initiales ou photo */
function Avatar({ client, idx }: { client: ClientRow; idx: number }) {
  const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
  const initials = client.fullName.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '?';
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 800, color: '#fff',
    }}>
      {client.profilePicture
        ? <img src={client.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials
      }
    </div>
  );
}

/** Formate un montant en GNF */
function fmtGNF(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`;
  return n.toLocaleString('fr-FR');
}

/** Formate une date relative */
function fmtDate(d: string | null): string {
  if (!d) return '—';
  const date = new Date(d);
  const now  = Date.now();
  const diff = now - date.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Auj.";
  if (days === 1) return "Hier";
  if (days < 7)   return `Il y a ${days}j`;
  if (days < 31)  return `Il y a ${Math.floor(days / 7)}sem`;
  if (days < 365) return `Il y a ${Math.floor(days / 30)}mois`;
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

/* ════════════════════════════════════════════════════════════
 * COMPOSANT PRINCIPAL
 * ════════════════════════════════════════════════════════════ */

export default function ClientsPage() {
  const { pop } = useToast();
  const {
    clients, stats, total, pages,
    loading, error, filters,
    applyFilter, setPage, reload,
  } = useClients();

  /** Client sélectionné pour mini-profil (future modale) */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* ────────────────────────────────────────────────────────────
   * RENDER
   * ────────────────────────────────────────────────────────────
   */
  return (
    <>
    <div className="page on" id="p-clients">

      {/* ── En-tête ── */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="ph-title">Clients <mark>& Abonnés</mark></div>
          <div className="ph-sub">
            Acheteurs + abonnés de votre boutique — données temps réel
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost btn-sm" onClick={reload}>
            <i className="fas fa-rotate-right" /> Actualiser
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 13, marginBottom: 20 }}>
        {[
          {
            ico: '👥', k: 'k1',
            val:  loading ? '—' : String(stats?.total   ?? 0),
            lbl:  'Total clients',
            sub:  stats ? `${stats.buyers} acheteurs · ${stats.abonnes} abonnés` : '…',
          },
          {
            ico: '👑', k: 'k3',
            val:  loading ? '—' : String(stats?.vip      ?? 0),
            lbl:  'Clients VIP',
            sub:  '≥ 10M GNF ou 10+ cmds',
          },
          {
            ico: '💰', k: 'k2',
            val:  loading ? '—' : `${fmtGNF(stats?.caTotal ?? 0)} GNF`,
            lbl:  'CA total clients',
            sub:  stats ? `Panier moy. : ${fmtGNF(stats.panierMoyen)} GNF` : '…',
          },
          {
            ico: '🆕', k: 'k4',
            val:  loading ? '—' : String(stats?.nouveaux ?? 0),
            lbl:  'Nouveaux acheteurs',
            sub:  'Première commande',
          },
        ].map((s, i) => (
          <div key={i} className={`kpi ${s.k}`}>
            <div className="kpi-stripe" />
            <div className="kpi-top">
              <div className="kpi-icon">{s.ico}</div>
              <span className="kpi-badge neu">{s.sub}</span>
            </div>
            <div className="kpi-val">{s.val}</div>
            <div className="kpi-lbl">{s.lbl}</div>
          </div>
        ))}
      </div>

      <div className="g3">

        {/* ════════════════════════════════════════════
            COLONNE PRINCIPALE — tableau clients
            ════════════════════════════════════════════ */}
        <div style={{ gridColumn: '1 / 3' }}>

          {/* ── Filtres ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>

            {/* Filtres source + segment */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>

              {/* Source */}
              {([
                { label: 'Tous',       value: 'all'     },
                { label: '🛒 Acheteurs', value: 'buyers'  },
                { label: '👁️ Abonnés',  value: 'abonnes' },
              ] as { label: string; value: 'all' | 'buyers' | 'abonnes' }[]).map(f => (
                <button
                  key={f.value}
                  onClick={() => applyFilter({ source: f.value })}
                  style={{ background: filters.source === f.value ? 'var(--navy)' : 'var(--white)', color: filters.source === f.value ? '#fff' : 'var(--t2)', border: `1.5px solid ${filters.source === f.value ? 'var(--navy)' : 'var(--bdr2)'}`, borderRadius: 'var(--pill)', padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s' }}
                >
                  {f.label}
                </button>
              ))}

              <div style={{ width: 1, height: 28, background: 'var(--bdr)', alignSelf: 'center' }} />

              {/* Segment */}
              {([
                { label: 'Tous segments', value: 'all'      },
                { label: '👑 VIP',        value: 'VIP'      },
                { label: '⭐ Fidèles',    value: 'Fidèle'   },
                { label: '🔄 Réguliers',  value: 'Régulier' },
                { label: '🆕 Nouveaux',   value: 'Nouveau'  },
                { label: '👁️ Abonnés',   value: 'Abonné'   },
              ] as { label: string; value: 'all' | 'VIP' | 'Fidèle' | 'Régulier' | 'Nouveau' | 'Abonné' }[]).map(f => (
                <button
                  key={f.value}
                  onClick={() => applyFilter({ segment: f.value })}
                  style={{ background: filters.segment === f.value ? 'var(--blue)' : 'var(--white)', color: filters.segment === f.value ? '#fff' : 'var(--t2)', border: `1.5px solid ${filters.segment === f.value ? 'var(--blue)' : 'var(--bdr2)'}`, borderRadius: 'var(--pill)', padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s' }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Recherche */}
            <div style={{ position: 'relative' }}>
              <i className="fas fa-magnifying-glass" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--t4)', fontSize: 12, pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Nom ou email…"
                value={filters.search ?? ''}
                onChange={e => applyFilter({ search: e.target.value })}
                style={{ border: '1.5px solid var(--bdr2)', borderRadius: 'var(--pill)', padding: '8px 14px 8px 32px', fontSize: 12.5, color: 'var(--navy)', background: 'var(--white)', outline: 'none', width: 200, transition: 'border-color .2s' }}
              />
            </div>
          </div>

          {/* ── Tableau ── */}
          <div className="card">
            <div className="ch">
              <div className="ch-t">
                <i className="fas fa-users" />
                Base clients
                {!loading && <span style={{ marginLeft: 6, fontSize: 11.5, fontWeight: 400, color: 'var(--t3)' }}>({total})</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {/* Tri */}
                <select
                  style={{ border: '1.5px solid var(--bdr2)', borderRadius: 8, padding: '5px 10px', fontSize: 11.5, color: 'var(--t2)', background: 'var(--white)', cursor: 'pointer', outline: 'none' }}
                  value={`${filters.sortBy ?? 'totalSpent'}_${filters.sortOrder ?? 'DESC'}`}
                  onChange={e => {
                    const [by, order] = e.target.value.split('_');
                    applyFilter({ sortBy: by as any, sortOrder: order as any });
                  }}
                >
                  <option value="totalSpent_DESC">Plus dépensé</option>
                  <option value="totalOrders_DESC">Plus de commandes</option>
                  <option value="lastOrderAt_DESC">Dernière commande</option>
                  <option value="createdAt_DESC">Plus récents</option>
                </select>
              </div>
            </div>

            {/* États ── */}
            {loading && (
              <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--t3)' }}>
                <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 24, display: 'block', marginBottom: 10 }} />
                Chargement des clients…
              </div>
            )}

            {!loading && error && (
              <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
                <div style={{ fontWeight: 700, color: 'var(--rose)', marginBottom: 6 }}>Erreur de chargement</div>
                <div style={{ fontSize: 12.5, color: 'var(--t3)', marginBottom: 14 }}>{error}</div>
                <button onClick={reload} style={{ background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  <i className="fas fa-rotate-right" /> Réessayer
                </button>
              </div>
            )}

            {!loading && !error && clients.length === 0 && (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--t3)' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>👥</div>
                <div style={{ fontFamily: 'var(--fd)', fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>
                  {filters.search ? 'Aucun résultat' : 'Aucun client pour le moment'}
                </div>
                <div style={{ fontSize: 12.5 }}>
                  {filters.search
                    ? 'Aucun client ne correspond à votre recherche.'
                    : 'Vos premiers clients apparaîtront ici dès leur première commande ou abonnement.'}
                </div>
              </div>
            )}

            {!loading && !error && clients.length > 0 && (
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Contact</th>
                      <th>Source</th>
                      <th>Commandes</th>
                      <th>Total dépensé</th>
                      <th>Segment</th>
                      <th>Dernière cmd</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c, i) => (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                        style={{ cursor: 'pointer', background: c.id === selectedId ? 'var(--sky)' : undefined }}
                      >
                        {/* Avatar + nom */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <Avatar client={c} idx={i} />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--navy)' }}>{c.fullName}</div>
                              {c.isSuivi && (
                                <div style={{ fontSize: 10, color: 'var(--emerald)', fontWeight: 600 }}>
                                  <i className="fas fa-check-circle" style={{ marginRight: 3 }} />Abonné
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td style={{ fontSize: 11.5, color: 'var(--t3)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.email}
                        </td>

                        {/* Source */}
                        <td>
                          <SourceBadge isSuivi={c.isSuivi} totalOrders={c.totalOrders} />
                        </td>

                        {/* Commandes */}
                        <td>
                          {c.totalOrders > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                              <span style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 15, color: 'var(--navy)' }}>
                                {c.totalOrders}
                              </span>
                              <span style={{ fontSize: 10, color: 'var(--t3)' }}>cmds</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--t4)' }}>—</span>
                          )}
                        </td>

                        {/* Total dépensé */}
                        <td>
                          {c.totalSpent > 0 ? (
                            <div style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 14, color: 'var(--navy)' }}>
                              {fmtGNF(c.totalSpent)} <span style={{ fontSize: 10, fontWeight: 400, fontFamily: 'inherit' }}>GNF</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--t4)' }}>—</span>
                          )}
                        </td>

                        {/* Segment */}
                        <td><SegBadge seg={c.segment} /></td>

                        {/* Dernière commande */}
                        <td style={{ fontSize: 12, color: 'var(--t3)', whiteSpace: 'nowrap' }}>
                          {fmtDate(c.lastOrderAt)}
                        </td>

                        {/* Actions */}
                        <td>
                          <div className="td-action" onClick={e => e.stopPropagation()}>
                            <button className="ta-btn primary"
                              onClick={() => setSelectedId(c.id)}>
                              <i className="fas fa-user" style={{ marginRight: 4 }} />Profil
                            </button>
                            <button className="ta-btn"
                              onClick={() => pop(`📧 Message envoyé à ${c.fullName}`, 's')}>
                              Message
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Pagination ── */}
            {!loading && !error && pages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderTop: '1px solid var(--bdr)', fontSize: 12.5, color: 'var(--t3)' }}>
                <span>{total} client{total > 1 ? 's' : ''} · Page {filters.page}/{pages}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    disabled={(filters.page ?? 1) <= 1}
                    onClick={() => setPage((filters.page ?? 1) - 1)}
                    style={{ padding: '5px 10px', border: '1.5px solid var(--bdr2)', borderRadius: 7, background: 'var(--white)', cursor: (filters.page ?? 1) <= 1 ? 'not-allowed' : 'pointer', opacity: (filters.page ?? 1) <= 1 ? .4 : 1, fontSize: 12 }}>
                    <i className="fas fa-chevron-left" />
                  </button>
                  {Array.from({ length: Math.min(pages, 7) }, (_, idx) => {
                    const pg = (filters.page ?? 1) <= 4 ? idx + 1 : (filters.page ?? 1) - 3 + idx;
                    if (pg < 1 || pg > pages) return null;
                    return (
                      <button key={pg} onClick={() => setPage(pg)}
                        style={{ padding: '5px 11px', border: `1.5px solid ${pg === (filters.page ?? 1) ? 'var(--blue)' : 'var(--bdr2)'}`, borderRadius: 7, background: pg === (filters.page ?? 1) ? 'var(--blue)' : 'var(--white)', color: pg === (filters.page ?? 1) ? '#fff' : 'var(--t2)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        {pg}
                      </button>
                    );
                  })}
                  <button
                    disabled={(filters.page ?? 1) >= pages}
                    onClick={() => setPage((filters.page ?? 1) + 1)}
                    style={{ padding: '5px 10px', border: '1.5px solid var(--bdr2)', borderRadius: 7, background: 'var(--white)', cursor: (filters.page ?? 1) >= pages ? 'not-allowed' : 'pointer', opacity: (filters.page ?? 1) >= pages ? .4 : 1, fontSize: 12 }}>
                    <i className="fas fa-chevron-right" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════
            PANNEAU LATÉRAL — statistiques + répartition
            ════════════════════════════════════════════ */}
        <div>

          {/* Répartition segments */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-chart-pie" /> Répartition</div>
            </div>
            <div className="cb">
              {stats ? (
                [
                  { label: '👑 VIP',       count: stats.vip,       color: 'var(--amber)' },
                  { label: '⭐ Fidèles',   count: stats.fideles,   color: 'var(--emerald)' },
                  { label: '🔄 Réguliers', count: stats.reguliers, color: 'var(--blue)' },
                  { label: '🆕 Nouveaux',  count: stats.nouveaux,  color: 'var(--violet)' },
                  { label: '👁️ Abonnés',  count: stats.abonnes - (stats.vip + stats.fideles + stats.reguliers + stats.nouveaux > 0 ? 0 : 0), color: 'var(--t3)' },
                ].map(({ label, count, color }) => {
                  const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <div key={label} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: 'var(--t2)', fontWeight: 600 }}>{label}</span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, color, fontFamily: 'var(--fd)' }}>{count}</span>
                          <span style={{ color: 'var(--t3)', fontSize: 10 }}>{pct}%</span>
                        </div>
                      </div>
                      <div style={{ background: 'var(--g200)', borderRadius: 'var(--pill)', height: 7, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 'var(--pill)', transition: 'width .5s ease' }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
                  <i className="fas fa-circle-notch fa-spin" style={{ marginRight: 6 }} />
                  Chargement…
                </div>
              )}
            </div>
          </div>

          {/* Stats globales */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-chart-bar" /> Métriques clés</div>
            </div>
            <div className="cb">
              {[
                { ico: '👥', l: 'Total clients',    v: loading ? '…' : String(stats?.total ?? 0)                     },
                { ico: '🛒', l: 'Acheteurs',        v: loading ? '…' : String(stats?.buyers ?? 0)                    },
                { ico: '👁️',  l: 'Abonnés boutique', v: loading ? '…' : String(stats?.abonnes ?? 0)                   },
                { ico: '💰', l: 'CA total',         v: loading ? '…' : `${fmtGNF(stats?.caTotal ?? 0)} GNF`          },
                { ico: '🛍️', l: 'Panier moyen',     v: loading ? '…' : `${fmtGNF(stats?.panierMoyen ?? 0)} GNF`      },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 'var(--r-md)', marginBottom: 8 }}>
                  <span style={{ fontSize: 17 }}>{s.ico}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10.5, color: 'var(--t3)' }}>{s.l}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)', fontFamily: 'var(--fd)' }}>{s.v}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions CRM */}
          <div className="card">
            <div className="ch"><div className="ch-t"><i className="fas fa-bolt" /> Actions CRM</div></div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[
                { ico: '📧', l: 'Envoyer newsletter VIP',     action: 'newsletter' },
                { ico: '🎁', l: 'Offre fidélité automatique', action: 'fidelite'   },
                { ico: '📊', l: 'Rapport segments PDF',        action: 'rapport'    },
                { ico: '🔔', l: 'Relance clients inactifs',    action: 'relance'    },
              ].map((a, i) => (
                <button key={i}
                  onClick={() => pop(`⚙️ ${a.l}`, 'i')}
                  style={{ background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 12.5, fontWeight: 600, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', textAlign: 'left', transition: 'all .15s' }}>
                  <span style={{ fontSize: 15 }}>{a.ico}</span>
                  {a.l}
                  <i className="fas fa-arrow-right" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--t4)' }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* ── Modale profil client ── */}
    {selectedId !== null && (
      <ClientProfilModal
        clientId={selectedId}
        onClose={() => setSelectedId(null)}
        onPop={(msg, type) => pop(msg, type as any)}
      />
    )}
    </>
  );
}
