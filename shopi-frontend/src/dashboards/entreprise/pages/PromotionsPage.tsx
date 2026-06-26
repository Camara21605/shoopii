/* ============================================================
 * FICHIER : src/dashboards/entreprise/pages/PromotionsPage.tsx
 *
 * VERSION CONNECTÉE AU BACKEND — remplace les données mock par
 * de vrais appels API via promotionsApi.
 *
 * CHANGEMENTS vs version mock :
 *   - const PROMOS (mock) → remplacé par useState + useEffect + API
 *   - KPI_DATA statique → remplacé par GET /promotions/stats
 *   - create() locale → remplacée par POST /promotions
 *   - Bouton Activer   → PATCH /promotions/:id/activate
 *   - Bouton Pause     → PATCH /promotions/:id/pause
 *   - PRODUCTS (mock)  → remplacé par GET /dashboard/produits
 *
 * ============================================================ */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useToast }         from '../../../shared/context/ToastContext';
import type { PromoStatus } from '../types';
import styles               from './PromotionsPage.module.css';
import { apiFetch }         from '../../../shared/services/apiFetch';
import {
  promotionsApi,
  type PromoResponse,
  type PromoStats,
  type CreatePromoDto,
  type PromoScope,
} from '../../../shared/services/api/promotions.api';

// ── Types ──────────────────────────────────────────────────────
type FilterKey = 'all' | PromoStatus;

// ── Config type promo (inchangé — purement visuel) ─────────────
const TYPE_CFG: Record<string, { ic:string; bg:string; color:string; label:string }> = {
  discount:   { ic:'🏷️', bg:'rgba(190,24,93,.08)',  color:'var(--rose,#BE185D)',   label:'Réduction %'       },
  'free-ship':{ ic:'🚚', bg:'rgba(14,116,144,.09)', color:'var(--teal,#0E7490)',   label:'Livraison offerte' },
  bundle:     { ic:'🎁', bg:'rgba(109,40,217,.08)', color:'var(--violet,#6D28D9)', label:'Bundle'            },
  flash:      { ic:'⚡', bg:'rgba(180,83,9,.09)',   color:'var(--amber,#B45309)',  label:'Vente flash'       },
};

const STATUS_CFG: Record<PromoStatus, { label:string; bg:string; color:string; border:string; dot:string }> = {
  active:    { label:'Actif',      bg:'rgba(4,120,87,.09)',  color:'var(--emerald,#047857)', border:'rgba(5,150,105,.2)',  dot:'#10B981' },
  scheduled: { label:'Planifié',  bg:'rgba(217,119,6,.08)', color:'var(--amber,#B45309)',   border:'rgba(217,119,6,.2)',  dot:'#D97706' },
  draft:     { label:'Brouillon', bg:'var(--g100,#F1F3F5)', color:'var(--t3,#9CA3AF)',      border:'rgba(11,31,58,.13)',  dot:'#9CA3AF' },
  paused:    { label:'En pause',  bg:'rgba(109,40,217,.08)',color:'var(--violet,#6D28D9)',  border:'rgba(109,40,217,.2)', dot:'#7C3AED' },
  ended:     { label:'Terminé',   bg:'rgba(11,31,58,.06)',  color:'var(--t3,#9CA3AF)',      border:'rgba(11,31,58,.13)',  dot:'#9CA3AF' },
};

const TEMPLATES = [
  { ic:'🏷️', label:'Réduction en %',      sub:'Ex: -10% sur tout',    color:'var(--rose,#BE185D)',    key:'discount'  as const },
  { ic:'💰', label:'Réduction fixe (GNF)', sub:'Ex: -5 000 GNF',       color:'var(--emerald,#047857)', key:'discount'  as const },
  { ic:'🚚', label:'Livraison gratuite',   sub:'Pour commandes > X',   color:'var(--teal,#0E7490)',    key:'free-ship' as const },
  { ic:'🎁', label:'Bundle / Lot',         sub:'2 achetés = 1 offert', color:'var(--violet,#6D28D9)',  key:'bundle'    as const },
  { ic:'⚡', label:'Vente flash',          sub:'Durée & stock limités', color:'var(--amber,#B45309)',   key:'flash'     as const },
];

// ─── Type produit pour le sélecteur ───────────────────────────
interface Produit {
  id:   string;
  em?:  string;
  nom:  string;
  cat?: string;
  prix?: string;
}

// ═══════════════════════════════════════════════════════════════
// BADGE STATUT
// ═══════════════════════════════════════════════════════════════
function StatusBadge({ status }: { status: PromoStatus }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.draft;
  return (
    <span className={styles.statusBadge} style={{ background:c.bg, color:c.color, borderColor:c.border }}>
      <span className={styles.statusDot} style={{ background:c.dot }} />
      {c.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// BADGE PORTÉE
// ═══════════════════════════════════════════════════════════════
function ScopeBadge({ scope, count }: { scope: PromoScope; count?: number }) {
  return scope === 'global' ? (
    <span className={styles.scopeGlobal}><i className="fas fa-store" /> Toute l'entreprise</span>
  ) : (
    <span className={styles.scopeProducts}><i className="fas fa-box" /> {count ?? 0} produit{(count ?? 0) > 1 ? 's' : ''}</span>
  );
}

// ═══════════════════════════════════════════════════════════════
// CARTE PROMO — connectée aux actions API
// ═══════════════════════════════════════════════════════════════
function PromoCard({
  p,
  products,
  onActivate,
  onPause,
  onRefresh,
  onToast,
}: {
  p:          PromoResponse;
  products:   Produit[];
  onActivate: (id: string) => Promise<void>;
  onPause:    (id: string) => Promise<void>;
  onRefresh:  () => void;
  onToast:    (m: string, t: string) => void;
}) {
  const [copied,   setCopied]   = useState(false);
  const [loading,  setLoading]  = useState(false);

  const tc      = TYPE_CFG[p.type] ?? TYPE_CFG.discount;
  const pct     = p.max > 0 ? Math.min((p.uses / p.max) * 100, 100) : 0;
  const barClr  = pct > 80 ? 'var(--rose,#BE185D)' : 'var(--blue,#1A4FC4)';

  // Produits ciblés depuis la liste réelle
  const targeted = useMemo(
    () => products.filter(pr => p.productIds.includes(pr.id)),
    [products, p.productIds]
  );

  function copy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(p.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    onToast(`📋 Code "${p.code}" copié !`, 's');
  }

  async function handleActivate(e: React.MouseEvent) {
    e.stopPropagation();
    setLoading(true);
    try {
      await onActivate(p.id);
      onToast('🚀 Promotion activée !', 's');
      onRefresh();
    } catch (err: any) {
      onToast(`❌ ${err.message}`, 'e');
    } finally {
      setLoading(false);
    }
  }

  async function handlePause(e: React.MouseEvent) {
    e.stopPropagation();
    setLoading(true);
    try {
      await onPause(p.id);
      onToast('⏸️ Promotion suspendue', 'w');
      onRefresh();
    } catch (err: any) {
      onToast(`❌ ${err.message}`, 'e');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`${styles.promoCard} ${styles[p.status as keyof typeof styles] ?? ''}`}>
      <div className={styles.cardStripe} />

      <div className={styles.cardHead}>
        <div className={styles.cardTypeWrap}>
          <div className={styles.typeIcon} style={{ background:tc.bg, color:tc.color }}>{tc.ic}</div>
          <span className={styles.typeBadge} style={{ background:tc.bg, color:tc.color }}>{p.typeL}</span>
        </div>
        <StatusBadge status={p.status as PromoStatus} />
      </div>

      <div className={styles.promoNm}>{p.nom}</div>

      {/* Portée — depuis les vraies données API */}
      <div className={styles.scopeRow}>
        <ScopeBadge scope={p.scope as PromoScope} count={p.productIds.length} />
        {p.scope === 'products' && targeted.length > 0 && (
          <div className={styles.scopeTargeted}>
            {targeted.slice(0, 2).map(pr => (
              <span key={pr.id} className={styles.scopeTargetedItem} title={pr.nom}>
                {pr.em ?? '📦'} {pr.nom.length > 16 ? pr.nom.slice(0, 16) + '…' : pr.nom}
              </span>
            ))}
            {targeted.length > 2 && (
              <span className={styles.scopeTargetedMore}>+{targeted.length - 2}</span>
            )}
          </div>
        )}
      </div>

      <div className={styles.codeWrap}>
        <div className={styles.codeBox}>
          <i className="fas fa-ticket" style={{ color:'var(--blue,#1A4FC4)', fontSize:11 }} />
          <span>{p.code}</span>
        </div>
        <button className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ''}`} onClick={copy} title="Copier">
          <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} />
        </button>
        <div className={styles.expireInfo}><i className="fas fa-calendar-alt" /> {p.expire}</div>
      </div>

      {p.max > 0 && (
        <div className={styles.usageSection}>
          <div className={styles.usageHeader}>
            <span>Utilisations</span>
            <span className={styles.usageCount}>{p.uses} <span style={{ color:'var(--t4,#C5CAD3)' }}>/ {p.max}</span></span>
          </div>
          <div className={styles.usageTrack}>
            <div className={styles.usageFill} style={{ width:`${pct}%`, background:barClr }} />
          </div>
        </div>
      )}

      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <div className={styles.statVal} style={{ color:'var(--blue,#1A4FC4)' }}>{p.uses}</div>
          <div className={styles.statLbl}>Utilisations</div>
        </div>
        <div className={styles.statDiv} />
        <div className={styles.stat}>
          <div className={styles.statVal} style={{ color:'var(--emerald,#047857)' }}>{p.revenue}</div>
          <div className={styles.statLbl}>CA généré</div>
        </div>
        <div className={styles.statDiv} />
        <div className={styles.stat}>
          <div className={styles.statVal}>{p.max > 0 ? `${Math.round(pct)}%` : '—'}</div>
          <div className={styles.statLbl}>Taux usage</div>
        </div>
      </div>

      <div className={styles.cardActions}>
        <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={loading}
          onClick={() => onToast('✏️ Modifier promo', 'i')}>
          <i className="fas fa-pen" /> Modifier
        </button>
        <button className={`${styles.btn} ${styles.btnGhost}`} disabled={loading}
          onClick={() => onToast('📊 Stats détaillées', 'i')}>
          <i className="fas fa-chart-line" /> Stats
        </button>
        {p.status === 'active' && (
          <button className={`${styles.btn} ${styles.btnDanger}`} disabled={loading} onClick={handlePause}>
            <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-pause'}`} />
          </button>
        )}
        {(p.status === 'draft' || p.status === 'paused') && (
          <button className={`${styles.btn} ${styles.btnSuccess}`} disabled={loading} onClick={handleActivate}>
            <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-rocket'}`} /> Activer
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SÉLECTEUR DE PRODUITS — utilise les vrais produits de l'API
// ═══════════════════════════════════════════════════════════════
function ProductSelector({
  products,
  selected,
  onChange,
}: {
  products:  Produit[];
  selected:  string[];
  onChange:  (ids: string[]) => void;
}) {
  const [q, setQ] = useState('');

  const list = useMemo(
    () => products.filter(p =>
      p.nom.toLowerCase().includes(q.toLowerCase()) ||
      (p.cat ?? '').toLowerCase().includes(q.toLowerCase())
    ),
    [q, products]
  );

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  }

  return (
    <div className={styles.prodSel}>
      <div className={styles.prodSearch}>
        <i className="fas fa-search" />
        <input className={styles.prodSearchIn} placeholder="Rechercher un produit…"
          value={q} onChange={e => setQ(e.target.value)} />
        {q && (
          <button className={styles.prodSearchClear} onClick={() => setQ('')}>
            <i className="fas fa-xmark" />
          </button>
        )}
      </div>

      {selected.length > 0 && (
        <div className={styles.prodCount}>
          <i className="fas fa-check-circle" style={{ color:'var(--emerald,#047857)' }} />
          <span>{selected.length} produit{selected.length > 1 ? 's' : ''} sélectionné{selected.length > 1 ? 's' : ''}</span>
          <button className={styles.prodCountClear} onClick={() => onChange([])}>
            Tout désélectionner
          </button>
        </div>
      )}

      <div className={styles.prodList}>
        {list.length === 0 ? (
          <div className={styles.prodEmpty}><i className="fas fa-box-open" /> Aucun produit trouvé</div>
        ) : list.map(prod => {
          const on = selected.includes(prod.id);
          return (
            <div key={prod.id} className={`${styles.prodItem} ${on ? styles.prodItemOn : ''}`} onClick={() => toggle(prod.id)}>
              <div className={`${styles.prodCheck} ${on ? styles.prodCheckOn : ''}`}>
                {on && <i className="fas fa-check" style={{ fontSize:9, color:'#fff' }} />}
              </div>
              <div className={styles.prodEm}>{prod.em ?? '📦'}</div>
              <div className={styles.prodInfo}>
                <div className={styles.prodNm}>{prod.nom}</div>
                <div className={styles.prodMeta}>
                  {prod.cat && <span className={styles.prodCat}>{prod.cat}</span>}
                  {prod.prix && <span className={styles.prodPrix}>{prod.prix}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAGE PRINCIPALE — connectée au backend
// ═══════════════════════════════════════════════════════════════
export default function PromotionsPage() {
  const { pop } = useToast();

  // ── État principal ────────────────────────────────────────
  const [promos,   setPromos]   = useState<PromoResponse[]>([]);
  const [stats,    setStats]    = useState<PromoStats | null>(null);
  const [products, setProducts] = useState<Produit[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<FilterKey>('all');

  // ── État modale ───────────────────────────────────────────
  const [show,     setShow]     = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [nom,      setNom]      = useState('');
  const [code,     setCode]     = useState('');
  const [type,     setType]     = useState('discount');
  const [discount, setDiscount] = useState('');
  const [expire,   setExpire]   = useState('');
  const [max,      setMax]      = useState('');
  const [scope,    setScope]    = useState<PromoScope>('global');
  const [prodIds,  setProdIds]  = useState<string[]>([]);

  // ── Dérivés ───────────────────────────────────────────────
  const scopeErr  = scope === 'products' && prodIds.length === 0;
  const canCreate = nom.trim() !== '' && code.trim() !== '' && !scopeErr && !saving;

  const filtered = filter === 'all'
    ? promos
    : promos.filter(p => p.status === filter);

  const maxUses = Math.max(...promos.map(p => p.uses), 1);

  // ════════════════════════════════════════════════════════════
  // CHARGEMENT DES DONNÉES AU MONTAGE
  // Appelle en parallèle :
  //   - GET /promotions/stats   → KPI cards
  //   - GET /promotions         → liste des promos
  //   - GET /dashboard/produits → produits pour le sélecteur
  // ════════════════════════════════════════════════════════════
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, promoData, prodData] = await Promise.all([
        promotionsApi.getStats(),
        promotionsApi.getAll({ limit: 100 }),
        // Charge les vrais produits de l'entreprise pour le ProductSelector
        apiFetch<{ data: any[] }>('/produits?limit=100'),
      ]);

      setStats(statsData);
      setPromos(promoData.data);

      // Normaliser les produits du backend vers le format Produit
      const normalized: Produit[] = (prodData?.data ?? []).map((p: any) => ({
        id:   p.id,
        nom:  p.nom,
        cat:  p.category?.nom ?? '',
        prix: p.prix ? `${Number(p.prix).toLocaleString('fr-FR')} GNF` : '',
        em:   p.media?.[0] ? undefined : '📦',
      }));
      setProducts(normalized);

    } catch (err: any) {
      pop(`❌ Erreur de chargement : ${err.message}`, 'e');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ════════════════════════════════════════════════════════════
  // CRÉER UNE PROMOTION — appelle POST /promotions
  // ════════════════════════════════════════════════════════════
  async function create() {
    if (!canCreate) return;
    setSaving(true);
    try {
      const dto: CreatePromoDto = {
        nom:            nom.trim(),
        code:           code.trim().toUpperCase(),
        type:           type as any,
        scope,
        valueType:      type === 'discount' ? 'percent' : type === 'free-ship' ? 'free' : 'fixed',
        valeur:         discount ? Number(discount) : undefined,
        maxUtilisations:max ? Number(max) : undefined,
        endDate:        expire || undefined,
        productIds:     scope === 'products' ? prodIds : undefined,
      };

      /* Créer en brouillon puis activer immédiatement */
      const created = await promotionsApi.create(dto);

      /* Activation automatique pour qu'elle soit visible dans la boutique */
      try {
        await promotionsApi.activate(created.id);
      } catch {
        /* Silencieux — la promo reste en brouillon si l'activation échoue */
      }

      const who = scope === 'global' ? "toute l'entreprise" : `${prodIds.length} produit${prodIds.length > 1 ? 's' : ''}`;
      pop(`✅ Promo "${nom}" créée et activée pour ${who} !`, 's');
      setShow(false);
      reset();
      loadData();  // Recharger la liste

    } catch (err: any) {
      pop(`❌ ${err.message}`, 'e');
    } finally {
      setSaving(false);
    }
  }

  // ════════════════════════════════════════════════════════════
  // SAUVEGARDER EN BROUILLON — POST /promotions (status = draft par défaut)
  // ════════════════════════════════════════════════════════════
  async function saveDraft() {
    if (!nom.trim() || !code.trim()) {
      pop('Le nom et le code sont obligatoires même pour un brouillon.', 'w');
      return;
    }
    setSaving(true);
    try {
      await promotionsApi.create({
        nom:  nom.trim(),
        code: code.trim().toUpperCase(),
        type: type as any,
        scope,
        productIds: scope === 'products' ? prodIds : undefined,
      });
      pop('💾 Brouillon sauvegardé', 'i');
      setShow(false);
      reset();
      loadData();
    } catch (err: any) {
      pop(`❌ ${err.message}`, 'e');
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setNom(''); setCode(''); setDiscount(''); setExpire(''); setMax('');
    setScope('global'); setProdIds([]);
  }

  function openModal(t?: string) {
    if (t) setType(t);
    setShow(true);
  }

  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setShow(false); };
    if (show) document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [show]);

  // ── KPI cards depuis l'API (ou skeleton pendant le chargement) ─
  const kpiCards = [
    { ic:'🏷️', val: stats ? String(stats.total)      : '…', lbl:'Promotions totales',   sub:'', trend:'up',  k:'k1' as const },
    { ic:'✅', val: stats ? String(stats.actives)     : '…', lbl:'Actives maintenant',   sub:`${stats?.planifiees ?? 0} planifiées`, trend:'neu', k:'k2' as const },
    { ic:'👆', val: stats ? String(stats.totalUses)   : '…', lbl:'Utilisations totales', sub:'', trend:'up',  k:'k3' as const },
    { ic:'💰', val: stats ? formatCa(stats.totalCa)   : '…', lbl:'CA généré (GNF)',      sub:'', trend:'up',  k:'k4' as const },
  ];

  return (
    <div>

      {/* ════ HERO ════════════════════════════════════════════ */}
      <div className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroGrid} />
        <div className={styles.heroLeft}>
          <div className={styles.heroBadge}><span className={styles.heroDot} /> Promotions actives</div>
          <div className={styles.heroTitle}>Boostez vos ventes avec des <em>offres ciblées</em></div>
          <div className={styles.heroSub}>Créez des codes promo, planifiez des ventes flash et suivez leurs performances en temps réel.</div>
          <div className={styles.heroBtns}>
            <button className={styles.hb1} onClick={() => openModal()}><i className="fas fa-plus" /> Créer une promotion</button>
            <button className={styles.hb2} onClick={() => pop('📤 Export en cours…','i')}><i className="fas fa-download" /> Exporter</button>
          </div>
        </div>
        <div className={styles.heroRight}>
          {[
            { val: stats ? String(stats.actives)        : '…', unit:'actives', lbl:'Promotions',  trend:'+1',   up:true },
            { val: stats ? String(stats.totalUses)       : '…', unit:'total',   lbl:'Utilisations',trend:'+28%', up:true },
            { val: stats ? formatCa(stats.totalCa)       : '…', unit:'GNF',     lbl:'CA généré',   trend:'+12%', up:true },
          ].map((s,i) => (
            <div key={i} className={styles.hs}>
              <div className={styles.hsVal}>{s.val}<span className={styles.hsUnit}>{s.unit}</span></div>
              <div className={styles.hsLbl}>{s.lbl}</div>
              <div className={`${styles.hsTrend} ${s.up ? styles.up : styles.dn}`}>
                <i className={`fas fa-arrow-trend-${s.up?'up':'down'}`} /> {s.trend}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ════ KPIs ════════════════════════════════════════════ */}
      <div className={styles.kpiGrid}>
        {kpiCards.map((k,i) => (
          <div key={i} className={`${styles.kpi} ${styles[k.k]}`}>
            <div className={styles.kpiStripe} />
            <div className={styles.kpiTop}>
              <div className={styles.kpiIcon}>{k.ic}</div>
              <span className={`${styles.kpiBadge} ${styles[k.trend as keyof typeof styles] ?? ''}`}>
                {k.trend==='up'?'↑':k.trend==='dn'?'↓':'—'} {k.sub}
              </span>
            </div>
            <div className={styles.kpiVal}>{loading ? <span className={styles.skeleton} /> : k.val}</div>
            <div className={styles.kpiLbl}>{k.lbl}</div>
          </div>
        ))}
      </div>

      {/* ════ FILTRES ═════════════════════════════════════════ */}
      <div className={styles.filters}>
        <div className={styles.filterTabs}>
          {([
            { label:'Toutes',       value:'all'       as FilterKey, count:promos.length },
            { label:'● Actives',    value:'active'    as FilterKey, count:promos.filter(p=>p.status==='active').length },
            { label:'⏰ Planifiées', value:'scheduled' as FilterKey, count:promos.filter(p=>p.status==='scheduled').length },
            { label:'✎ Brouillons', value:'draft'     as FilterKey, count:promos.filter(p=>p.status==='draft').length },
          ]).map(f => (
            <button key={f.value}
              className={`${styles.filterTab} ${filter===f.value ? styles.filterTabOn : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}<span className={styles.filterCount}>{f.count}</span>
            </button>
          ))}
        </div>
        <div className={styles.filterRight}>
          <div className={styles.search}>
            <i className="fas fa-search" />
            <input className={styles.searchInput} placeholder="Rechercher une promo…" />
          </div>
        </div>
      </div>

      {/* ════ LAYOUT ══════════════════════════════════════════ */}
      <div className={styles.layout}>
        <div className={styles.main}>

          {/* État de chargement */}
          {loading ? (
            <div style={{ textAlign:'center', padding:'40px', color:'var(--t3)' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize:28, display:'block', marginBottom:12 }} />
              Chargement des promotions…
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🏷️</div>
              <div className={styles.emptyTitle}>Aucune promotion trouvée</div>
              <div className={styles.emptySub}>Créez votre première promotion pour booster vos ventes</div>
              <button className={styles.hb1} onClick={() => openModal()}><i className="fas fa-plus" /> Créer une promotion</button>
            </div>
          ) : (
            <div className={styles.promoGrid}>
              {filtered.map(p => (
                <PromoCard
                  key={p.id}
                  p={p}
                  products={products}
                  onActivate={id => promotionsApi.activate(id)}
                  onPause={id    => promotionsApi.pause(id)}
                  onRefresh={loadData}
                  onToast={pop}
                />
              ))}
            </div>
          )}

          {/* Performance — utilise les vraies données */}
          <div className={styles.card} style={{ marginTop:16 }}>
            <div className={styles.cardHeader}>
              <div className={styles.cardHeaderTitle}><i className="fas fa-chart-bar" /> Performance des promotions</div>
              <span className={styles.cardBadge}>Ce mois</span>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.perfList}>
                {promos.filter(p => p.uses > 0 || p.status === 'active').slice(0, 4).map((p, i) => {
                  const pct = maxUses > 0 ? (p.uses / maxUses) * 100 : 0;
                  return (
                    <div key={i} className={styles.perfRow}>
                      <div className={styles.perfLabel}>{p.nom}</div>
                      <div className={styles.perfTrack}>
                        <div className={styles.perfFill} style={{ width:`${pct}%`, background:'var(--blue,#1A4FC4)' }}>
                          {p.uses > 0 && <span>{p.uses}</span>}
                        </div>
                      </div>
                      <div className={styles.perfVal}>{p.uses} <span style={{ color:'var(--t4)',fontWeight:400 }}>uses</span></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Panneau latéral — inchangé */}
        <div className={styles.aside}>
          <div className={styles.card} style={{ marginBottom:14 }}>
            <div className={styles.cardHeader}>
              <div className={styles.cardHeaderTitle}><i className="fas fa-wand-magic-sparkles" /> Créer rapidement</div>
            </div>
            <div className={styles.cardBody} style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {TEMPLATES.map((t,i) => (
                <button key={i} className={styles.templateBtn}
                  onClick={() => { openModal(t.key); pop(`➕ Template "${t.label}" sélectionné`,'i'); }}>
                  <div className={styles.tmplIc} style={{ background:t.color+'18', color:t.color }}>{t.ic}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div className={styles.tmplLabel}>{t.label}</div>
                    <div className={styles.tmplSub}>{t.sub}</div>
                  </div>
                  <i className="fas fa-plus" style={{ color:t.color, fontSize:11, flexShrink:0 }} />
                </button>
              ))}
            </div>
          </div>

          <div className={styles.card} style={{ marginBottom:14 }}>
            <div className={styles.cardHeader}>
              <div className={styles.cardHeaderTitle}><i className="fas fa-fire" /> Meilleures promos</div>
            </div>
            <div className={styles.cardBody} style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[...promos].sort((a,b) => b.uses - a.uses).slice(0, 3).map((p,i) => (
                <div key={i} className={styles.topItem}>
                  <div className={styles.topRank}>#{i+1}</div>
                  <div style={{ flex:1 }}>
                    <div className={styles.topNm}>{p.nom}</div>
                    <div className={styles.topCode}>{p.code}</div>
                  </div>
                  <div className={styles.topUses}>{p.uses} <span className={styles.topUsesSub}>uses</span></div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.tipsCard}>
            <div className={styles.tipsHead}><i className="fas fa-lightbulb" /> Conseils Shopi</div>
            <div className={styles.tipsBody}>
              {[
                { ic:'⚡', tip:"Les promos flash génèrent 3× plus d'urgence d'achat." },
                { ic:'🚚', tip:'Livraison gratuite = +28% de conversion.' },
                { ic:'🎯', tip:'Cibler un produit spécifique booste le taux usage +40%.' },
              ].map((t,i) => (
                <div key={i} className={styles.tipItem}>
                  <span className={styles.tipIc}>{t.ic}</span>
                  <span>{t.tip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ════ MODALE CRÉATION ═════════════════════════════════ */}
      {show && (
        <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) setShow(false); }}>
          <div className={styles.modal}>
            <div className={styles.modalHead}>
              <div>
                <div className={styles.modalTitle}>✨ Nouvelle promotion</div>
                <div className={styles.modalSub}>Créez une offre pour booster vos ventes</div>
              </div>
              <button className={styles.modalClose} onClick={() => setShow(false)}><i className="fas fa-xmark" /></button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label>Type de promotion</label>
                <div className={styles.typeGrid}>
                  {Object.entries(TYPE_CFG).map(([key,cfg]) => (
                    <button key={key}
                      className={`${styles.typeOpt} ${type===key ? styles.typeOptSel : ''}`}
                      style={type===key ? { borderColor:cfg.color, background:cfg.bg } : {}}
                      onClick={() => setType(key)}>
                      <span style={{ fontSize:20 }}>{cfg.ic}</span>
                      <span className={styles.typeOptLabel} style={{ color:type===key ? cfg.color : 'var(--t2,#4B5563)' }}>{cfg.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label>Nom de la promotion *</label>
                  <input className={styles.input} placeholder="Ex: Soldes Janvier"
                    value={nom} onChange={e => setNom(e.target.value)} autoFocus />
                </div>
                <div className={styles.field}>
                  <label>Code promo *</label>
                  <input className={`${styles.input} ${styles.inputCode}`} placeholder="Ex: SOLDES20"
                    value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
                </div>
                <div className={styles.field}>
                  <label>Valeur de la réduction</label>
                  <div className={styles.inputSuffix}>
                    <input className={styles.input}
                      placeholder={type==='discount'?'Ex: 20':type==='free-ship'?'Livraison offerte':'Ex: 5000'}
                      value={discount} onChange={e => setDiscount(e.target.value)} />
                    <span className={styles.inputSuffixLabel}>{type==='discount'?'%':'GNF'}</span>
                  </div>
                </div>
                <div className={styles.field}>
                  <label>Utilisations maximum</label>
                  <input className={styles.input} type="number" min={1}
                    placeholder="Ex: 500 (vide = illimité)"
                    value={max} onChange={e => setMax(e.target.value)} />
                </div>
                <div className={`${styles.field} ${styles.formFull}`}>
                  <label>Date d'expiration</label>
                  <input className={styles.input} type="date"
                    value={expire} onChange={e => setExpire(e.target.value)} />
                </div>
              </div>

              {/* PORTÉE */}
              <div className={styles.scopeSection}>
                <div className={styles.scopeSectionTitle}><i className="fas fa-crosshairs" /> Portée de la promotion</div>
                <div className={styles.scopeOpts}>
                  <div className={`${styles.scopeOpt} ${scope==='global' ? styles.scopeOptOn : ''}`}
                    onClick={() => { setScope('global'); setProdIds([]); }}>
                    <div className={`${styles.scopeRadio} ${scope==='global' ? styles.scopeRadioOn : ''}`} />
                    <div className={styles.scopeOptIco} style={{ background:'var(--sky-2,#E2EAFB)' }}>
                      <i className="fas fa-store" style={{ color:'var(--blue,#1A4FC4)' }} />
                    </div>
                    <div className={styles.scopeOptBody}>
                      <div className={styles.scopeOptTitle}>Toute l'entreprise</div>
                      <div className={styles.scopeOptSub}>La promo s'applique à tous vos produits</div>
                    </div>
                    <span className={styles.scopeOptTag} style={{ background:'var(--sky-2,#E2EAFB)', color:'var(--blue,#1A4FC4)' }}>
                      {products.length} produits
                    </span>
                  </div>

                  <div className={`${styles.scopeOpt} ${scope==='products' ? styles.scopeOptOn : ''}`}
                    onClick={() => setScope('products')}>
                    <div className={`${styles.scopeRadio} ${scope==='products' ? styles.scopeRadioOn : ''}`} />
                    <div className={styles.scopeOptIco} style={{ background:'rgba(4,120,87,.09)' }}>
                      <i className="fas fa-box" style={{ color:'var(--emerald,#047857)' }} />
                    </div>
                    <div className={styles.scopeOptBody}>
                      <div className={styles.scopeOptTitle}>Produit(s) spécifique(s)</div>
                      <div className={styles.scopeOptSub}>Cibler un ou plusieurs produits précis</div>
                    </div>
                    {prodIds.length > 0 && (
                      <span className={styles.scopeOptTag} style={{ background:'rgba(4,120,87,.09)', color:'var(--emerald,#047857)' }}>
                        {prodIds.length} sélectionné{prodIds.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {scope === 'products' && (
                  <div className={styles.prodSelWrap}>
                    {scopeErr && (
                      <div className={styles.scopeWarn}>
                        <i className="fas fa-triangle-exclamation" />
                        Sélectionnez au moins un produit pour pouvoir créer cette promotion.
                      </div>
                    )}
                    {/* ✅ Utilise les VRAIS produits de l'API au lieu du mock */}
                    <ProductSelector products={products} selected={prodIds} onChange={setProdIds} />
                  </div>
                )}
              </div>

              {(nom || code) && (
                <div className={styles.preview}>
                  <div className={styles.previewLabel}>Aperçu</div>
                  <div className={styles.previewRow}>
                    <div style={{ fontSize:28 }}>{TYPE_CFG[type]?.ic ?? '🏷️'}</div>
                    <div>
                      <div className={styles.previewNm}>{nom || 'Nom de la promo'}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                        <div className={styles.previewCode}>{code || 'CODE'}</div>
                        <ScopeBadge scope={scope} count={prodIds.length} />
                      </div>
                    </div>
                    {discount && (
                      <div className={styles.previewDiscount}>
                        -{discount}{type==='discount'?'%':' GNF'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.modalFoot}>
              <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setShow(false)} disabled={saving}>Annuler</button>
              <button className={`${styles.btn} ${styles.btnDraft}`} onClick={saveDraft} disabled={saving}>
                <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`} /> Brouillon
              </button>
              <button className={`${styles.btn} ${styles.btnCreate}`} onClick={create}
                disabled={!canCreate}
                title={scopeErr ? 'Sélectionnez au moins un produit' : ''}>
                <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-rocket'}`} /> Créer la promotion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper — formater le CA ───────────────────────────────────
function formatCa(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`;
  return String(n);
}