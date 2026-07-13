import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/ProfilClient.module.css';
const fmtGnf = (n: number | undefined | null) =>
  n != null ? n.toLocaleString('fr-FR') + ' GNF' : '—';
import type { Commande } from '../data/profilClientData';

const STATUT_CFG: Record<Commande['statut'], { label: string; icon: string; color: string }> = {
  livre:       { label: 'Livré',       icon: 'fa-circle-check', color: '#059669' },
  transit:     { label: 'En transit',  icon: 'fa-motorcycle',   color: '#2563EB' },
  preparation: { label: 'Préparation', icon: 'fa-box-open',     color: '#D97706' },
  annule:      { label: 'Annulé',      icon: 'fa-circle-xmark', color: '#DC2626' },
};

type Filtre = 'all' | 'livre' | 'encours' | 'annule';

const FILTRES: { id: Filtre; label: string }[] = [
  { id: 'all',     label: 'Toutes'   },
  { id: 'livre',   label: 'Livrées'  },
  { id: 'encours', label: 'En cours' },
  { id: 'annule',  label: 'Annulées' },
];

interface Props {
  commandes: Commande[];
  loading?:  boolean;
}

export default function SectionOrders({ commandes, loading }: Props) {
  const navigate = useNavigate();
  const [filtre, setFiltre] = useState<Filtre>('all');

  const filtered = commandes.filter(c => {
    if (filtre === 'all')     return true;
    if (filtre === 'livre')   return c.statut === 'livre';
    if (filtre === 'encours') return c.statut === 'transit' || c.statut === 'preparation';
    if (filtre === 'annule')  return c.statut === 'annule';
    return true;
  });

  const count = (f: Filtre) => {
    if (f === 'all')     return commandes.length;
    if (f === 'livre')   return commandes.filter(c => c.statut === 'livre').length;
    if (f === 'encours') return commandes.filter(c => c.statut === 'transit' || c.statut === 'preparation').length;
    return commandes.filter(c => c.statut === 'annule').length;
  };

  /* Navigue vers la page de détail/suivi de la commande */
  function goToDetail(c: Commande) {
    const navId = c.uuid ?? c.id;
    navigate(`/commande/${navId}/suivi`);
  }

  return (
    <div className={styles.card}>
      <div className={styles.ch}>
        <div className={styles.ct}>
          <i className="fas fa-box" /> Mes commandes
          {!loading && (
            <span style={{ marginLeft:6, fontWeight:400, color:'var(--t3)', fontSize:12 }}>
              ({commandes.length})
            </span>
          )}
        </div>
      </div>

      <div className={styles.cb}>

        {/* ── Résumé des commandes ── */}
        {!loading && commandes.length > 0 && (
          <div style={{
            display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10,
            marginBottom:16, padding:'14px 0', borderBottom:'1px solid var(--bdr)',
          }}>
            {[
              { label:'Total',      val: commandes.length,                                                                       color:'var(--navy)',   bg:'var(--sky)'                },
              { label:'En cours',   val: commandes.filter(c => c.statut === 'transit' || c.statut === 'preparation').length,     color:'#2563EB',       bg:'rgba(37,99,235,.08)'       },
              { label:'Livrées',    val: commandes.filter(c => c.statut === 'livre').length,                                     color:'#059669',       bg:'rgba(5,150,105,.08)'       },
              { label:'Annulées',   val: commandes.filter(c => c.statut === 'annule').length,                                    color:'#DC2626',       bg:'rgba(220,38,38,.08)'       },
            ].map(s => (
              <div key={s.label} style={{
                textAlign:'center', padding:'10px 4px', borderRadius:12,
                background: s.bg,
              }}>
                <div style={{ fontSize:22, fontWeight:800, color: s.color, fontFamily:'var(--fd)' }}>
                  {s.val}
                </div>
                <div style={{ fontSize:10, fontWeight:600, color:'var(--t3)', marginTop:2 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filtres */}
        <div className={styles.filterRow}>
          {FILTRES.map(f => (
            <button key={f.id}
              className={`${styles.filterChip} ${filtre === f.id ? styles.filterChipOn : ''}`}
              onClick={() => setFiltre(f.id)}>
              {f.label} ({count(f.id)})
            </button>
          ))}
        </div>

        {/* Chargement */}
        {loading && (
          <div style={{ padding:'32px 0', textAlign:'center', color:'var(--t3)', fontSize:13 }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize:20, display:'block', marginBottom:8 }} />
            Chargement des commandes…
          </div>
        )}

        {/* Vide */}
        {!loading && filtered.length === 0 && (
          <div style={{ padding:'32px 0', textAlign:'center', color:'var(--t3)', fontSize:13 }}>
            <i className="fas fa-box-open" style={{ fontSize:28, display:'block', marginBottom:10, color:'var(--t4)' }} />
            {filtre === 'all'
              ? "Vous n'avez pas encore passé de commande."
              : 'Aucune commande dans cette catégorie.'}
          </div>
        )}

        {/* Liste */}
        {!loading && filtered.map(c => {
          const cfg      = STATUT_CFG[c.statut];
          const isUrl    = typeof c.imageUrl === 'string' && c.imageUrl.startsWith('http');
          const isEmoji  = typeof c.emoji === 'string' && !c.emoji.startsWith('http');

          return (
            <div
              key={c.id}
              className={styles.orderRow}
              onClick={() => goToDetail(c)}
              style={{ cursor:'pointer', transition:'background .15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--g100)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              {/* ── Vignette produit ── */}
              <div style={{
                width:52, height:52, borderRadius:12, flexShrink:0,
                overflow:'hidden', background:'var(--sky)',
                display:'flex', alignItems:'center', justifyContent:'center',
                border:'1px solid var(--bdr)',
              }}>
                {isUrl
                  ? <img src={c.imageUrl} alt={c.produit}
                      style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                  : <span style={{ fontSize:26 }}>{isEmoji ? c.emoji : '📦'}</span>
                }
              </div>

              {/* ── Infos ── */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{
                  fontWeight:700, fontSize:13.5, color:'var(--navy)',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                }}>
                  {c.produit}
                </div>
                <div style={{
                  fontSize:11, color:'var(--t3)', marginTop:3,
                  display:'flex', gap:8, flexWrap:'wrap', alignItems:'center',
                }}>
                  <span><i className="fas fa-store" style={{ marginRight:3 }} />{c.boutique}</span>
                  <span style={{ color:'var(--t4)' }}>#{c.id}</span>
                  <span><i className="fas fa-calendar" style={{ marginRight:3 }} />{c.date}</span>
                  {c.livreur && (
                    <span><i className="fas fa-motorcycle" style={{ marginRight:3 }} />{c.livreur}</span>
                  )}
                </div>
              </div>

              {/* ── Prix + statut + bouton ── */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5, flexShrink:0 }}>
                <div style={{ fontWeight:800, fontSize:13, color:'var(--navy)' }}>
                  {fmtGnf(c.montant)}
                </div>

                <span style={{
                  display:'inline-flex', alignItems:'center', gap:4,
                  fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:999,
                  color: cfg.color, background: cfg.color + '18',
                }}>
                  <i className={`fas ${cfg.icon}`} style={{ fontSize:9 }} /> {cfg.label}
                </span>

                {/* Bouton contextuel selon le statut */}
                {c.statut === 'transit' || c.statut === 'preparation' ? (
                  <button
                    onClick={e => { e.stopPropagation(); goToDetail(c); }}
                    style={{
                      fontSize:10, fontWeight:700, border:'none', borderRadius:6,
                      padding:'3px 10px', cursor:'pointer',
                      color:'var(--blue)', background:'var(--sky)',
                    }}>
                    <i className="fas fa-location-dot" style={{ marginRight:3 }} /> Suivre
                  </button>
                ) : c.statut === 'livre' ? (
                  <button
                    onClick={e => { e.stopPropagation(); goToDetail(c); }}
                    style={{
                      fontSize:10, fontWeight:700, border:'none', borderRadius:6,
                      padding:'3px 10px', cursor:'pointer',
                      color:'#059669', background:'rgba(5,150,105,.1)',
                    }}>
                    <i className="fas fa-receipt" style={{ marginRight:3 }} /> Détails
                  </button>
                ) : c.statut === 'annule' ? (
                  <button
                    onClick={e => { e.stopPropagation(); goToDetail(c); }}
                    style={{
                      fontSize:10, fontWeight:700, border:'none', borderRadius:6,
                      padding:'3px 10px', cursor:'pointer',
                      color:'var(--t3)', background:'var(--g100)',
                    }}>
                    <i className="fas fa-eye" style={{ marginRight:3 }} /> Voir
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}
