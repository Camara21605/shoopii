/*
 * FICHIER: src/dashboards/entreprise/pages/CommandesPage.tsx
 * Page de gestion des commandes — filtre, tableau complet, export
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../shared/context/ToastContext';
import { fetchEntrepriseCommandes } from '../services/commandesApi';
import type { Order, OrderItem, OrderStatus } from '../types';

/* ── Filtres ─────────────────────────────────────────────────────────────── */
const FILTERS: { label: string; value: string }[] = [
  { label: '🔴 En attente',  value: 'new'  },
  { label: '⚙️ En préparation', value: 'prep' },
  { label: '🚚 En livraison',   value: 'ship' },
  { label: '✅ Livré',         value: 'del'  },
  { label: '✕ Annulé',         value: 'can'  },
  { label: 'Tous',              value: 'all'  },
];

const STATUS_LABELS: Record<OrderStatus, JSX.Element> = {
  new:  <span className="s-pill s-new">● Nouveau</span>,
  prep: <span className="s-pill s-prep">⚙ En prépa</span>,
  ship: <span className="s-pill s-ship">🚚 Livraison</span>,
  del:  <span className="s-pill s-del">✓ Livré</span>,
  can:  <span className="s-pill s-can">✕ Annulé</span>,
};

function fmt(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/* ── Composant image produit ─────────────────────────────────────────────── */
/**
 * Affiche l'image(s) du/des produit(s) d'une commande.
 *
 * • 1 article  → image pleine taille (ou placeholder)
 * • 2-3 articles → 2 vignettes empilées avec léger décalage
 * • 4+ articles → 3 vignettes + badge "+N"
 */
function ProductThumb({ items, mainImage }: { items?: OrderItem[]; mainImage?: string | null }) {
  const SIZE = 44;

  /* Fallback si pas d'items (commandes mockées / anciennes) */
  if (!items || items.length === 0) {
    return <ImgBox src={mainImage} size={SIZE} />;
  }

  if (items.length === 1) {
    return <ImgBox src={items[0].imageUrl ?? mainImage} size={SIZE} />;
  }

  /* Multi-produits : max 3 vignettes visibles */
  const visible = items.slice(0, 3);
  const extra   = items.length - 3;

  return (
    <div style={{ position: 'relative', width: SIZE + 20, height: SIZE, flexShrink: 0 }}>
      {visible.map((it, i) => (
        <div
          key={i}
          title={it.nm}
          style={{
            position:     'absolute',
            left:         i * 10,
            top:          0,
            zIndex:       visible.length - i,
            borderRadius: 8,
            border:       '2px solid #fff',
            boxShadow:    '0 1px 4px rgba(0,0,0,.12)',
            overflow:     'hidden',
            width:        SIZE,
            height:       SIZE,
          }}
        >
          <ImgBox src={it.imageUrl} size={SIZE} noBorder />
        </div>
      ))}
      {extra > 0 && (
        <div style={{
          position:       'absolute',
          left:           3 * 10,
          top:            0,
          zIndex:         visible.length + 1,
          width:          SIZE,
          height:         SIZE,
          borderRadius:   8,
          border:         '2px solid #fff',
          background:     'var(--navy, #0B1F3A)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontSize:       11,
          fontWeight:     700,
          color:          '#fff',
          boxShadow:      '0 1px 4px rgba(0,0,0,.2)',
        }}>
          +{extra}
        </div>
      )}
    </div>
  );
}

function ImgBox({
  src,
  size,
  noBorder = false,
}: {
  src?: string | null;
  size: number;
  noBorder?: boolean;
}) {
  const [errored, setErrored] = useState(false);
  const showPlaceholder = !src || errored;

  return (
    <div style={{
      width:          size,
      height:         size,
      borderRadius:   noBorder ? 0 : 8,
      overflow:       'hidden',
      background:     showPlaceholder ? 'var(--g100, #F1F5F9)' : undefined,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      flexShrink:     0,
    }}>
      {showPlaceholder ? (
        <span style={{ fontSize: size * 0.45 }}>📦</span>
      ) : (
        <img
          src={src!}
          alt=""
          onError={() => setErrored(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
    </div>
  );
}

/* ── Tooltip noms produits (multi-commande) ──────────────────────────────── */
function ProductNames({ items, nm, vt }: { items?: OrderItem[]; nm: string; vt: string }) {
  if (!items || items.length <= 1) {
    return (
      <>
        <div className="td-nm">{nm}</div>
        {vt && <div className="td-var">{vt}</div>}
      </>
    );
  }

  return (
    <div>
      <div className="td-nm" style={{ marginBottom: 1 }}>
        {items[0].nm}
        {items[0].vt && (
          <span className="td-var" style={{ marginLeft: 4 }}>{items[0].vt}</span>
        )}
      </div>
      <div style={{
        display:    'inline-flex',
        alignItems: 'center',
        gap:        4,
        padding:    '1px 7px',
        background: 'var(--navy-dim, rgba(11,31,58,.08))',
        borderRadius: 999,
        fontSize:   11,
        fontWeight: 600,
        color:      'var(--navy)',
        marginTop:  2,
      }}>
        +{items.length - 1} autre{items.length > 2 ? 's' : ''} article{items.length > 2 ? 's' : ''}
      </div>
    </div>
  );
}

/* ── Page principale ─────────────────────────────────────────────────────── */
export default function CommandesPage() {
  const { pop }    = useToast();
  const navigate   = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');
  const [orders,       setOrders]       = useState<Order[]>([]);
  const [loading,      setLoading]      = useState(true);

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
              onClick={() => setActiveFilter(f.value)}
              style={{
                background:  activeFilter === f.value ? 'var(--navy)' : 'var(--white)',
                color:       activeFilter === f.value ? '#fff'        : 'var(--t2)',
                borderColor: activeFilter === f.value ? 'var(--navy)' : 'var(--bdr2)',
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
            <i className="fas fa-download" /> Exporter CSV
          </button>
          <button
            onClick={() => pop('📊 Export Excel généré', 's')}
            style={{ background:'var(--white)', border:'1.5px solid var(--bdr2)', borderRadius:'var(--pill)', padding:'8px 15px', fontSize:12, fontWeight:600, color:'var(--t2)', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
          >
            <i className="fas fa-file-excel" /> Excel
          </button>
        </div>
      </div>

      {/* ── Tableau ── */}
      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Commande</th>
                <th>Produit(s)</th>
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
                <tr>
                  <td colSpan={8} style={{ textAlign:'center', padding:32, color:'var(--t3)' }}>
                    <i className="fas fa-circle-notch" style={{ animation:'spin .8s linear infinite', marginRight:8 }} />
                    Chargement…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign:'center', padding:32, color:'var(--t3)' }}>
                    Aucune commande
                  </td>
                </tr>
              )}
              {filtered.map(o => (
                <tr key={o.uuid ?? o.id} onClick={() => voirCommande(o)} style={{ cursor:'pointer' }}>

                  {/* Numéro commande */}
                  <td><div className="td-id">{o.id}</div></td>

                  {/* Produit(s) — image réelle + noms */}
                  <td>
                    <div className="td-prod">
                      <ProductThumb items={o.items} mainImage={o.imageUrl} />
                      <ProductNames items={o.items} nm={o.nm} vt={o.vt} />
                    </div>
                  </td>

                  <td><div className="td-client">{o.client}</div></td>
                  <td><div className="td-price">{fmt(o.price)} GNF</div></td>
                  <td>{STATUS_LABELS[o.status]}</td>
                  <td style={{ fontSize:12, color:'var(--t2)' }}>{o.date}</td>
                  <td style={{ fontSize:12, color:'var(--t2)' }}>{o.livreur}</td>

                  <td>
                    <div className="td-action">
                      <button
                        className="ta-btn primary"
                        onClick={e => { e.stopPropagation(); voirCommande(o); }}
                      >
                        Voir
                      </button>
                      {o.status === 'new' && (
                        <button
                          className="ta-btn"
                          onClick={e => { e.stopPropagation(); pop('✅ Commande acceptée', 's'); }}
                        >
                          Préparer
                        </button>
                      )}
                      {o.status === 'prep' && (
                        <button
                          className="ta-btn"
                          onClick={e => { e.stopPropagation(); pop('🚚 Envoi en livraison', 's'); }}
                        >
                          Envoyer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
