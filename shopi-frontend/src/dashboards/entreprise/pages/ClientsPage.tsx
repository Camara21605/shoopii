/*
 * FICHIER: src/dashboards/entreprise/pages/ClientsPage.tsx
 * Page Clients — liste segmentée, historique d'achats, profils clients,
 * statistiques par segment (VIP, Fidèle, Régulier, Nouveau).
 *
 * Données: CLIENTS depuis mockData.ts
 * Types: Client, ClientSegment depuis types/index.ts
 */

import React, { useState } from 'react';
import { useToast } from '../../../shared/context/ToastContext';
import { CLIENTS } from '../data/mockData';
import type { ClientSegment } from '../types';

/** Couleur et style par segment client */
const SEGMENT_STYLES: Record<ClientSegment, { bg: string; color: string; border: string }> = {
  VIP:      { bg: 'var(--am-bg)',  color: 'var(--amber)',   border: 'rgba(217,119,6,.2)' },
  Fidèle:   { bg: 'var(--em-bg)', color: 'var(--emerald)', border: 'rgba(5,150,105,.2)' },
  Régulier: { bg: 'var(--sky-2)', color: 'var(--blue)',    border: 'var(--sky-3)' },
  Nouveau:  { bg: 'var(--vl-bg)', color: 'var(--violet)',  border: 'rgba(124,58,237,.2)' },
};

/** Badge de segment */
function SegBadge({ seg }: { seg: ClientSegment }) {
  const s = SEGMENT_STYLES[seg];
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      fontSize: 9, fontWeight: 800, padding: '3px 9px',
      borderRadius: 'var(--pill)', textTransform: 'uppercase', letterSpacing: '.5px',
    }}>
      {seg === 'VIP' ? '👑 VIP' : seg === 'Fidèle' ? '⭐ ' + seg : seg === 'Nouveau' ? '🆕 ' + seg : seg}
    </span>
  );
}

/** Génère les initiales pour l'avatar */
function initials(nm: string) {
  return nm.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

/** Couleurs d'avatar par ordre */
const AVATAR_COLORS = [
  '#1652F0', '#059669', '#7C3AED', '#E11D48', '#D97706', '#0891B2',
];

export default function ClientsPage() {
  const { pop } = useToast();
  const [filter, setFilter] = useState<'all' | ClientSegment>('all');
  const [search, setSearch] = useState('');

  /** Filtre par segment et recherche */
  const filtered = CLIENTS.filter(c => {
    const matchSeg = filter === 'all' || c.seg === filter;
    const matchSearch = search === '' ||
      c.nm.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    return matchSeg && matchSearch;
  });

  /** Comptages par segment */
  const counts = {
    VIP:      CLIENTS.filter(c => c.seg === 'VIP').length,
    Fidèle:   CLIENTS.filter(c => c.seg === 'Fidèle').length,
    Régulier: CLIENTS.filter(c => c.seg === 'Régulier').length,
    Nouveau:  CLIENTS.filter(c => c.seg === 'Nouveau').length,
  };

  /** CA total de tous les clients (somme des totaux) */
  const totalCA = CLIENTS.reduce((acc, c) => {
    const n = parseFloat(c.total.replace(/\s/g, '').replace(/\u202F/g, ''));
    return acc + (isNaN(n) ? 0 : n);
  }, 0);

  return (
    <div className="page on" id="p-clients">

      {/* ── KPIs segments ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 13, marginBottom: 20 }}>
        {[
          { ic: '👑', v: String(counts.VIP),      l: 'Clients VIP',       k: 'k3', sub: 'Panier > 50M GNF' },
          { ic: '⭐', v: String(counts.Fidèle),   l: 'Clients fidèles',   k: 'k2', sub: '5+ commandes' },
          { ic: '🔄', v: String(counts.Régulier), l: 'Clients réguliers', k: 'k1', sub: '2–4 commandes' },
          { ic: '🆕', v: String(counts.Nouveau),  l: 'Nouveaux clients',  k: 'k4', sub: 'Première commande' },
        ].map((s, i) => (
          <div key={i} className={`kpi ${s.k}`}>
            <div className="kpi-stripe"></div>
            <div className="kpi-top">
              <div className="kpi-icon">{s.ic}</div>
              <span className="kpi-badge neu">{s.sub}</span>
            </div>
            <div className="kpi-val">{s.v}</div>
            <div className="kpi-lbl">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="g3">
        {/* ── Colonne principale : tableau clients ── */}
        <div>
          {/* Barre filtres + recherche */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {([
                { label: 'Tous les clients', value: 'all' },
                { label: '👑 VIP',           value: 'VIP' },
                { label: '⭐ Fidèles',       value: 'Fidèle' },
                { label: '🔄 Réguliers',     value: 'Régulier' },
                { label: '🆕 Nouveaux',      value: 'Nouveau' },
              ] as { label: string; value: 'all' | ClientSegment }[]).map(f => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  style={{
                    background:  filter === f.value ? 'var(--navy)' : 'var(--white)',
                    color:       filter === f.value ? '#fff'        : 'var(--t2)',
                    borderColor: filter === f.value ? 'var(--navy)' : 'var(--bdr2)',
                    border: '1.5px solid', borderRadius: 'var(--pill)',
                    padding: '8px 14px', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', transition: 'all .2s',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Barre de recherche */}
            <div style={{ position: 'relative' }}>
              <i className="fas fa-search" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--t4)', fontSize: 12 }}></i>
              <input
                type="text"
                placeholder="Rechercher un client…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  border: '1.5px solid var(--bdr2)', borderRadius: 'var(--pill)',
                  padding: '8px 14px 8px 32px', fontSize: 12, color: 'var(--navy)',
                  background: 'var(--white)', outline: 'none', width: 210,
                  transition: 'border-color .2s',
                }}
              />
            </div>
          </div>

          {/* Tableau des clients */}
          <div className="card">
            <div className="ch">
              <div className="ch-t"><i className="fas fa-users"></i> Base clients ({filtered.length})</div>
              <button
                className="sh-action"
                onClick={() => pop('📥 Export CRM généré', 's')}
              >
                <i className="fas fa-download"></i> Exporter CRM
              </button>
            </div>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Email</th>
                    <th>Commandes</th>
                    <th>Total dépensé</th>
                    <th>Segment</th>
                    <th>Dernière cmd</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr key={i} onClick={() => pop(`👤 Profil de ${c.nm}`, 'i')}>
                      {/* Avatar + nom */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: '50%',
                            background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0,
                          }}>
                            {initials(c.nm)}
                          </div>
                          <div className="td-nm">{c.nm}</div>
                        </div>
                      </td>
                      <td style={{ fontSize: 11.5, color: 'var(--t3)' }}>{c.email}</td>
                      <td>
                        <span style={{
                          fontFamily: 'var(--fd)', fontWeight: 800,
                          fontSize: 14, color: 'var(--navy)',
                        }}>
                          {c.orders}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--t3)', marginLeft: 3 }}>cmds</span>
                      </td>
                      <td><div className="td-price">{c.total} GNF</div></td>
                      <td><SegBadge seg={c.seg} /></td>
                      <td style={{ fontSize: 11.5, color: 'var(--t3)' }}>{c.last}</td>
                      <td>
                        <div className="td-action">
                          <button
                            className="ta-btn primary"
                            onClick={e => { e.stopPropagation(); pop(`👤 Profil: ${c.nm}`, 'i'); }}
                          >
                            Profil
                          </button>
                          <button
                            className="ta-btn"
                            onClick={e => { e.stopPropagation(); pop(`📧 Message envoyé à ${c.nm}`, 's'); }}
                          >
                            Message
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Panneau latéral ── */}
        <div>
          {/* Répartition segments (donut) */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-chart-pie"></i> Répartition segments</div>
            </div>
            <div className="cb">
              {([
                ['VIP',      counts.VIP,      'var(--amber)',   33],
                ['Fidèle',   counts.Fidèle,   'var(--emerald)', 33],
                ['Régulier', counts.Régulier, 'var(--blue)',    17],
                ['Nouveau',  counts.Nouveau,  'var(--violet)',  17],
              ] as [string, number, string, number][]).map(([l, n, color, pct]) => (
                <div key={l} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--t2)', fontWeight: 600 }}>{l}</span>
                    <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, color, fontFamily: 'var(--fd)' }}>{n}</span>
                      <span style={{ color: 'var(--t3)', fontSize: 10 }}>{pct}%</span>
                    </div>
                  </div>
                  <div style={{ background: 'var(--g200)', borderRadius: 'var(--pill)', height: 7, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 'var(--pill)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Statistiques globales */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-chart-bar"></i> Stats globales</div>
            </div>
            <div className="cb">
              {[
                { ic: '👥', l: 'Total clients',        v: String(CLIENTS.length) },
                { ic: '🛒', l: 'Panier moyen',         v: '13 700 000 GNF' },
                { ic: '🔁', l: 'Taux de réachat',      v: '68%' },
                { ic: '📅', l: 'Fréquence moy.',       v: '2.3 cmds/mois' },
              ].map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  padding: '10px 12px', background: 'var(--g50)',
                  border: '1px solid var(--bdr)', borderRadius: 'var(--r-md)',
                  marginBottom: 8,
                }}>
                  <span style={{ fontSize: 18 }}>{s.ic}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10.5, color: 'var(--t3)' }}>{s.l}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)', fontFamily: 'var(--fd)' }}>{s.v}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions rapides CRM */}
          <div className="card">
            <div className="ch"><div className="ch-t"><i className="fas fa-bolt"></i> Actions CRM</div></div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { ic: '📧', l: 'Envoyer newsletter VIP' },
                { ic: '🎁', l: 'Offre fidélité automatique' },
                { ic: '📊', l: 'Rapport segments PDF' },
                { ic: '🔔', l: 'Relance clients inactifs' },
              ].map((a, i) => (
                <button
                  key={i}
                  onClick={() => pop(`⚙️ ${a.l}`, 'i')}
                  style={{
                    background: 'var(--g50)', border: '1px solid var(--bdr)',
                    borderRadius: 'var(--r-md)', padding: '10px 14px',
                    fontSize: 12.5, fontWeight: 600, color: 'var(--navy)',
                    display: 'flex', alignItems: 'center', gap: 9,
                    cursor: 'pointer', textAlign: 'left', transition: 'all .18s',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{a.ic}</span>
                  {a.l}
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