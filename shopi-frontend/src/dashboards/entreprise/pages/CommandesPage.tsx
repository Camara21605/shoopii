/*
 * FICHIER: src/dashboards/entreprise/pages/CommandesPage.tsx
 * Page de gestion des commandes — filtre, tableau complet, export
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../shared/context/ToastContext';
import { fetchEntrepriseCommandes } from '../services/commandesApi';
import type { Order, OrderStatus } from '../types';

const FILTERS: { label: string; value: string }[] = [
  { label: '🔴 En attente (14)', value: 'new'  },
  { label: '⚙️ En préparation', value: 'prep' },
  { label: '🚚 En livraison',    value: 'ship' },
  { label: '✅ Livré',          value: 'del'  },
  { label: '✕ Annulé',          value: 'can'  },
  { label: 'Tous',               value: 'all'  },
];

const STATUS_LABELS: Record<OrderStatus, JSX.Element> = {
  new:  <span className="s-pill s-new">● Nouveau</span>,
  prep: <span className="s-pill s-prep">⚙ En prépa</span>,
  ship: <span className="s-pill s-ship">🚚 Livraison</span>,
  del:  <span className="s-pill s-del">✓ Livré</span>,
  can:  <span className="s-pill s-can">✕ Annulé</span>,
};

function fmt(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F');
}

export default function CommandesPage() {
  const { pop } = useToast();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEntrepriseCommandes()
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeFilter === 'all'
    ? orders
    : orders.filter(o => o.status === activeFilter);

  function voirCommande(o: Order) {
    if (o.uuid) navigate(`/commande/${o.uuid}/suivi`);
    else pop(`📋 Commande ${o.id}`, 'i');
  }

  return (
    <div className="page on" id="p-commandes">
      {/* ── Filtres + Export ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => { setActiveFilter(f.value); pop('📦 Filtre appliqué', 'i'); }}
              style={{
                background:   activeFilter === f.value ? 'var(--navy)' : 'var(--white)',
                color:        activeFilter === f.value ? '#fff'        : 'var(--t2)',
                borderColor:  activeFilter === f.value ? 'var(--navy)' : 'var(--bdr2)',
                border: '1.5px solid', borderRadius: 'var(--pill)',
                padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'all .2s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button
            onClick={() => pop('📥 Export CSV généré', 's')}
            style={{ background:'var(--white)', border:'1.5px solid var(--bdr2)', borderRadius:'var(--pill)', padding:'8px 15px', fontSize:12, fontWeight:600, color:'var(--t2)', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
          >
            <i className="fas fa-download"></i> Exporter CSV
          </button>
          <button
            onClick={() => pop('📊 Export Excel généré', 's')}
            style={{ background:'var(--white)', border:'1.5px solid var(--bdr2)', borderRadius:'var(--pill)', padding:'8px 15px', fontSize:12, fontWeight:600, color:'var(--t2)', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
          >
            <i className="fas fa-file-excel"></i> Excel
          </button>
        </div>
      </div>

      {/* ── Tableau des commandes ── */}
      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Commande</th>
                <th>Produit</th>
                <th>Client</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Date</th>
                <th>Livreur</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} style={{ textAlign:'center', padding:24, color:'var(--t3)' }}>Chargement…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign:'center', padding:24, color:'var(--t3)' }}>Aucune commande</td></tr>
              )}
              {filtered.map(o => (
                <tr key={o.uuid ?? o.id} onClick={() => voirCommande(o)}>
                  <td><div className="td-id">{o.id}</div></td>
                  <td>
                    <div className="td-prod">
                      <div className="td-em">{o.em}</div>
                      <div>
                        <div className="td-nm">{o.nm}</div>
                        <div className="td-var">{o.vt}</div>
                      </div>
                    </div>
                  </td>
                  <td><div className="td-client">{o.client}</div></td>
                  <td><div className="td-price">{fmt(o.price)} GNF</div></td>
                  <td>{STATUS_LABELS[o.status]}</td>
                  <td style={{ fontSize:12, color:'var(--t2)' }}>{o.date}</td>
                  <td style={{ fontSize:12, color:'var(--t2)' }}>{o.livreur}</td>
                  <td>
                    <div className="td-action">
                      <button className="ta-btn primary" onClick={e => { e.stopPropagation(); voirCommande(o); }}>Voir</button>
                      {o.status === 'new' && (
                        <button className="ta-btn" onClick={e => { e.stopPropagation(); pop('✅ Commande acceptée', 's'); }}>Préparer</button>
                      )}
                      {o.status === 'prep' && (
                        <button className="ta-btn" onClick={e => { e.stopPropagation(); pop('🚚 Envoi en livraison', 's'); }}>Envoyer</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}