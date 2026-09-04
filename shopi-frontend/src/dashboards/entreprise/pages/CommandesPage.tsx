/*
 * FICHIER: src/dashboards/entreprise/pages/CommandesPage.tsx
 * Page de gestion des commandes — filtre, tableau complet, export
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../shared/context/ToastContext';
import { fetchEntrepriseCommandes, assignerLivreurCommande, fetchAssignableLivreurs } from '../services/commandesApi';
import { useTeamPermissions } from '../hooks/useTeamPermissions';
import type { Order, OrderItem, OrderStatus } from '../types';
import ChoisirLivreurModal from '../../../shared/components/ChoisirLivreurModal';
import type { LivreurPickerItem } from '../../../shared/components/ChoisirLivreurModal';

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
          border:         '2px solid var(--white)',
          background:     'var(--btn, #111113)',
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
      background:     showPlaceholder ? 'var(--g100, var(--g100))' : undefined,
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
  const { t } = useTranslation();

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
        background: 'var(--sky)',
        borderRadius: 999,
        fontSize:   11,
        fontWeight: 600,
        color:      'var(--navy)',
        marginTop:  2,
      }}>
        {t('commandes.autresArticles', { count: items.length - 1 })}
      </div>
    </div>
  );
}

/* ── Page principale ─────────────────────────────────────────────────────── */
export default function CommandesPage() {
  const { t }      = useTranslation();
  const { pop }    = useToast();
  const navigate   = useNavigate();
  const { can }    = useTeamPermissions();
  const [activeFilter, setActiveFilter] = useState('all');
  const [orders,       setOrders]       = useState<Order[]>([]);
  const [loading,      setLoading]      = useState(true);

  /* Assigner / changer le livreur */
  const [assigningOrder,  setAssigningOrder]  = useState<Order | null>(null);
  const [livreurOptions,  setLivreurOptions]  = useState<LivreurPickerItem[]>([]);
  const [loadingLivreurs, setLoadingLivreurs] = useState(false);
  const [savingLivreur,   setSavingLivreur]   = useState(false);

  const FILTERS: { label: string; value: string }[] = [
    { label: `🔴 ${t('commandes.filters.attente')}`,     value: 'new'  },
    { label: `⚙️ ${t('commandes.filters.preparation')}`, value: 'prep' },
    { label: `🚚 ${t('commandes.filters.livraison')}`,   value: 'ship' },
    { label: `✅ ${t('commandes.filters.livre')}`,        value: 'del'  },
    { label: `✕ ${t('commandes.filters.annule')}`,        value: 'can'  },
    { label: t('commandes.filters.tous'),                 value: 'all'  },
  ];

  const STATUS_LABELS: Record<OrderStatus, React.JSX.Element> = {
    new:  <span className="s-pill s-new">● {t('overview.orders.status.new')}</span>,
    prep: <span className="s-pill s-prep">⚙ {t('overview.orders.status.prep')}</span>,
    ship: <span className="s-pill s-ship">🚚 {t('overview.orders.status.ship')}</span>,
    del:  <span className="s-pill s-del">✓ {t('overview.orders.status.del')}</span>,
    can:  <span className="s-pill s-can">✕ {t('overview.orders.status.can')}</span>,
  };

  useEffect(() => {
    fetchEntrepriseCommandes()
      .then(setOrders)
      .catch((err: any) => {
        setOrders([]);
        /* err.message porte le vrai motif backend (ex: 403 "Votre accès ne
         * couvre pas cette action" pour un collaborateur sans la permission
         * orders.view) — sans ce toast, l'écran affichait juste "aucune
         * commande" en silence, impossible à distinguer d'une boutique
         * sans commande. */
        pop(err?.message ?? "Impossible de charger les commandes.", 'e');
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeFilter === 'all'
    ? orders
    : orders.filter(o => o.status === activeFilter);

  function voirCommande(o: Order) {
    if (o.uuid) navigate(`/commande/${o.uuid}/suivi`);
    else pop(t('commandes.toasts.orderRef', { id: o.id }), 'i');
  }

  function openAssignerLivreur(o: Order) {
    setAssigningOrder(o);
    setLoadingLivreurs(true);
    fetchAssignableLivreurs()
      .then(setLivreurOptions)
      .catch(() => setLivreurOptions([]))
      .finally(() => setLoadingLivreurs(false));
  }

  async function handleAssignerLivreur(livreurId: string) {
    if (!assigningOrder?.uuid) return;
    setSavingLivreur(true);
    try {
      await assignerLivreurCommande(assigningOrder.uuid, livreurId);
      const chosen = livreurOptions.find(l => l.id === livreurId);
      setOrders(prev => prev.map(o => o.uuid === assigningOrder.uuid
        ? { ...o, livreur: chosen?.nom ?? o.livreur, livreurId, livreurAssignmentStatus: 'pending', livreurRefusalReason: null }
        : o,
      ));
      pop('🛵 Livreur assigné — en attente de sa confirmation', 's');
      setAssigningOrder(null);
    } catch (err: any) {
      pop(err?.message ?? "Impossible d'assigner ce livreur.", 'e');
    } finally {
      setSavingLivreur(false);
    }
  }

  return (
    <div className="page on" id="p-commandes">

      {/* ── Filtres + Export ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div
          style={{
            display: 'flex', gap: 7, flexWrap: 'nowrap',
            overflowX: 'auto', minWidth: 0, paddingBottom: 2,
            scrollbarWidth: 'thin',
          }}
        >
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              style={{
                background:  activeFilter === f.value ? 'var(--btn)' : 'var(--white)',
                color:       activeFilter === f.value ? '#fff'       : 'var(--t2)',
                borderColor: activeFilter === f.value ? 'var(--btn)' : 'var(--bdr2)',
                border: '1.5px solid', borderRadius: 'var(--pill)',
                padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'all .2s',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button
            onClick={() => pop(t('commandes.toasts.exportCsv'), 's')}
            style={{ background:'var(--white)', border:'1.5px solid var(--bdr2)', borderRadius:'var(--pill)', padding:'8px 15px', fontSize:12, fontWeight:600, color:'var(--t2)', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
          >
            <i className="fas fa-download" /> {t('commandes.exportCsv')}
          </button>
          <button
            onClick={() => pop(t('commandes.toasts.exportExcel'), 's')}
            style={{ background:'var(--white)', border:'1.5px solid var(--bdr2)', borderRadius:'var(--pill)', padding:'8px 15px', fontSize:12, fontWeight:600, color:'var(--t2)', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
          >
            <i className="fas fa-file-excel" /> {t('commandes.exportExcel')}
          </button>
        </div>
      </div>

      {/* ── Tableau ── */}
      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('commandes.table.commande')}</th>
                <th>{t('commandes.table.produits')}</th>
                <th>{t('commandes.table.client')}</th>
                <th>{t('commandes.table.montant')}</th>
                <th>{t('commandes.table.statut')}</th>
                <th>{t('commandes.table.date')}</th>
                <th>{t('commandes.table.livreur')}</th>
                <th>{t('commandes.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} style={{ textAlign:'center', padding:32, color:'var(--t3)' }}>
                    <i className="fas fa-circle-notch" style={{ animation:'spin .8s linear infinite', marginRight:8 }} />
                    {t('commandes.loading')}
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign:'center', padding:32, color:'var(--t3)' }}>
                    {t('commandes.empty')}
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
                  <td>
                    {can('deliveries', 'assign') ? (
                      <button
                        onClick={e => { e.stopPropagation(); openAssignerLivreur(o); }}
                        style={{
                          background:'none', border:'none', cursor:'pointer', padding:0,
                          textAlign:'left', display:'flex', flexDirection:'column', gap:2,
                        }}
                      >
                        <span style={{ fontSize:12, color:'var(--t2)', textDecoration:'underline', textDecorationStyle:'dotted' }}>
                          {o.livreur !== '—' ? o.livreur : 'Assigner'}
                        </span>
                        {o.livreurAssignmentStatus === 'pending' && (
                          <span style={{ fontSize:10, fontWeight:700, color:'#D97706' }}>⏳ En attente</span>
                        )}
                        {o.livreurAssignmentStatus === 'refused' && (
                          <span style={{ fontSize:10, fontWeight:700, color:'#DC2626' }}>✕ Refusé — à réassigner</span>
                        )}
                      </button>
                    ) : (
                      <span style={{ fontSize:12, color:'var(--t2)' }}>{o.livreur}</span>
                    )}
                  </td>

                  <td>
                    <div className="td-action">
                      <button
                        className="ta-btn primary"
                        onClick={e => { e.stopPropagation(); voirCommande(o); }}
                      >
                        {t('commandes.voir')}
                      </button>
                      {o.status === 'new' && (
                        <button
                          className="ta-btn"
                          onClick={e => { e.stopPropagation(); pop(t('commandes.toasts.accepted'), 's'); }}
                        >
                          {t('commandes.preparer')}
                        </button>
                      )}
                      {o.status === 'prep' && (
                        <button
                          className="ta-btn"
                          onClick={e => { e.stopPropagation(); pop(t('commandes.toasts.shipping'), 's'); }}
                        >
                          {t('commandes.envoyer')}
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

      {assigningOrder && (
        <ChoisirLivreurModal
          title={`Assigner un livreur — ${assigningOrder.id}`}
          items={livreurOptions}
          loading={loadingLivreurs}
          saving={savingLivreur}
          emptyMessage="Aucun livreur disponible dans votre entreprise pour le moment."
          onClose={() => setAssigningOrder(null)}
          onSelect={handleAssignerLivreur}
        />
      )}
    </div>
  );
}
