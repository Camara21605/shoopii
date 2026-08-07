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
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
function getTypeCfg(t: TFunction): Record<string, { ic:string; bg:string; color:string; label:string }> {
  return {
    discount:   { ic:'🏷️', bg:'rgba(128,128,128,.08)',  color:'var(--t2)',   label:t('promotions.typeCfg.discount')       },
    'free-ship':{ ic:'🚚', bg:'rgba(128,128,128,.09)', color:'var(--t2)',   label:t('promotions.typeCfg.freeShip') },
    bundle:     { ic:'🎁', bg:'rgba(128,128,128,.08)', color:'var(--t2)', label:t('promotions.typeCfg.bundle')            },
    flash:      { ic:'⚡', bg:'rgba(128,128,128,.09)',   color:'var(--t2)',  label:t('promotions.typeCfg.flash')       },
  };
}

function getStatusCfg(t: TFunction): Record<PromoStatus, { label:string; bg:string; color:string; border:string; dot:string }> {
  return {
    active:    { label:t('promotions.statusCfg.active'),      bg:'var(--em-bg)',  color:'var(--emerald)', border:'rgba(5,150,105,.2)',  dot:'var(--emerald)' },
    scheduled: { label:t('promotions.statusCfg.scheduled'),  bg:'var(--sky-2)', color:'var(--blue)',   border:'var(--sky-3)',  dot:'var(--blue)' },
    draft:     { label:t('promotions.statusCfg.draft'), bg:'var(--g100,#F1F3F5)', color:'var(--t3,#9CA3AF)',      border:'rgba(11,31,58,.13)',  dot:'#9CA3AF' },
    paused:    { label:t('promotions.statusCfg.paused'),  bg:'var(--am-bg)',color:'var(--amber)',  border:'rgba(180,83,9,.2)', dot:'var(--amber)' },
    ended:     { label:t('promotions.statusCfg.ended'),   bg:'rgba(11,31,58,.06)',  color:'var(--t3,#9CA3AF)',      border:'rgba(11,31,58,.13)',  dot:'#9CA3AF' },
  };
}

function getTemplates(t: TFunction) {
  return [
    { ic:'🏷️', label:t('promotions.templates.pctDiscount.label'),      sub:t('promotions.templates.pctDiscount.sub'),    color:'var(--t2)',    key:'discount'  as const },
    { ic:'💰', label:t('promotions.templates.fixedDiscount.label'), sub:t('promotions.templates.fixedDiscount.sub'),       color:'var(--t2)', key:'discount'  as const },
    { ic:'🚚', label:t('promotions.templates.freeShip.label'),   sub:t('promotions.templates.freeShip.sub'),   color:'var(--t2)',    key:'free-ship' as const },
    { ic:'🎁', label:t('promotions.templates.bundle.label'),         sub:t('promotions.templates.bundle.sub'), color:'var(--t2)',  key:'bundle'    as const },
    { ic:'⚡', label:t('promotions.templates.flash.label'),          sub:t('promotions.templates.flash.sub'), color:'var(--t2)',   key:'flash'     as const },
  ];
}

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
  const { t } = useTranslation();
  const c = getStatusCfg(t)[status] ?? getStatusCfg(t).draft;
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
  const { t } = useTranslation();
  return scope === 'global' ? (
    <span className={styles.scopeGlobal}><i className="fas fa-store" /> {t('promotions.scope.global')}</span>
  ) : (
    <span className={styles.scopeProducts}><i className="fas fa-box" /> {t('promotions.scope.produits', { count: count ?? 0 })}</span>
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
  onEdit,
}: {
  p:          PromoResponse;
  products:   Produit[];
  onActivate: (id: string) => Promise<void>;
  onPause:    (id: string) => Promise<void>;
  onRefresh:  () => void;
  onToast:    (m: string, t: string) => void;
  onEdit:     (p: PromoResponse) => void;
}) {
  const { t } = useTranslation();
  const [copied,   setCopied]   = useState(false);
  const [loading,  setLoading]  = useState(false);

  const tc      = getTypeCfg(t)[p.type] ?? getTypeCfg(t).discount;
  const pct     = p.max > 0 ? Math.min((p.uses / p.max) * 100, 100) : 0;
  const barClr  = pct > 80 ? 'var(--t2)' : 'var(--t2)';

  // Produits ciblés depuis la liste réelle
  const targeted = useMemo(
    () => products.filter(pr => p.productIds.includes(pr.id)),
    [products, p.productIds]
  );

  function copy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(p.code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
        onToast(t('promotions.card.codeCopied', { code: p.code }), 's');
      })
      .catch(() => onToast(t('promotions.card.copyError'), 'e'));
  }

  async function handleActivate(e: React.MouseEvent) {
    e.stopPropagation();
    setLoading(true);
    try {
      await onActivate(p.id);
      onToast(t('promotions.card.activated'), 's');
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
      onToast(t('promotions.card.paused'), 'w');
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
          <i className="fas fa-ticket" style={{ color:'var(--t2)', fontSize:11 }} />
          <span>{p.code}</span>
        </div>
        <button className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ''}`} onClick={copy} title={t('promotions.card.copierTitle')}>
          <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} />
        </button>
        <div className={styles.expireInfo}><i className="fas fa-calendar-alt" /> {p.expire}</div>
      </div>

      {p.max > 0 && (
        <div className={styles.usageSection}>
          <div className={styles.usageHeader}>
            <span>{t('promotions.card.utilisations')}</span>
            <span className={styles.usageCount}>{p.uses} <span style={{ color:'var(--t4,#C5CAD3)' }}>/ {p.max}</span></span>
          </div>
          <div className={styles.usageTrack}>
            <div className={styles.usageFill} style={{ width:`${pct}%`, background:barClr }} />
          </div>
        </div>
      )}

      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <div className={styles.statVal} style={{ color:'var(--t2)' }}>{p.uses}</div>
          <div className={styles.statLbl}>{t('promotions.card.utilisations')}</div>
        </div>
        <div className={styles.statDiv} />
        <div className={styles.stat}>
          <div className={styles.statVal} style={{ color:'var(--t2)' }}>{p.revenue}</div>
          <div className={styles.statLbl}>{t('promotions.card.caGenere')}</div>
        </div>
        <div className={styles.statDiv} />
        <div className={styles.stat}>
          <div className={styles.statVal}>{p.max > 0 ? `${Math.round(pct)}%` : '—'}</div>
          <div className={styles.statLbl}>{t('promotions.card.tauxUsage')}</div>
        </div>
      </div>

      <div className={styles.cardActions}>
        <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={loading}
          onClick={() => onEdit(p)}>
          <i className="fas fa-pen" /> {t('promotions.card.modifier')}
        </button>
        <button className={`${styles.btn} ${styles.btnGhost}`} disabled={loading}
          onClick={() => onToast(t('promotions.card.statsToast'), 'i')}>
          <i className="fas fa-chart-line" /> {t('promotions.card.stats')}
        </button>
        {p.status === 'active' && (
          <button className={`${styles.btn} ${styles.btnDanger}`} disabled={loading} onClick={handlePause}>
            <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-pause'}`} />
          </button>
        )}
        {(p.status === 'draft' || p.status === 'paused') && (
          <button className={`${styles.btn} ${styles.btnSuccess}`} disabled={loading} onClick={handleActivate}>
            <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-rocket'}`} /> {t('promotions.card.activer')}
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
  const { t } = useTranslation();
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
        <input className={styles.prodSearchIn} placeholder={t('promotions.selector.search')}
          value={q} onChange={e => setQ(e.target.value)} />
        {q && (
          <button className={styles.prodSearchClear} onClick={() => setQ('')}>
            <i className="fas fa-xmark" />
          </button>
        )}
      </div>

      {selected.length > 0 && (
        <div className={styles.prodCount}>
          <i className="fas fa-check-circle" style={{ color:'var(--t2)' }} />
          <span>{t('promotions.selector.selected', { count: selected.length })}</span>
          <button className={styles.prodCountClear} onClick={() => onChange([])}>
            {t('promotions.selector.clearAll')}
          </button>
        </div>
      )}

      <div className={styles.prodList}>
        {list.length === 0 ? (
          <div className={styles.prodEmpty}><i className="fas fa-box-open" /> {t('promotions.selector.empty')}</div>
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
  const { t } = useTranslation();

  // ── État principal ────────────────────────────────────────
  const [promos,   setPromos]   = useState<PromoResponse[]>([]);
  const [stats,    setStats]    = useState<PromoStats | null>(null);
  const [products, setProducts] = useState<Produit[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<FilterKey>('all');

  // ── État modale ───────────────────────────────────────────
  const [show,      setShow]      = useState(false);
  const [saving,    setSaving]    = useState(false);
  /** null = mode création · sinon = id de la promo en cours d'édition */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nom,      setNom]      = useState('');
  const [code,     setCode]     = useState('');
  const [type,     setType]     = useState('discount');
  const [discount, setDiscount] = useState('');
  const [expire,   setExpire]   = useState('');
  const [max,      setMax]      = useState('');
  const [scope,    setScope]    = useState<PromoScope>('global');
  const [prodIds,  setProdIds]  = useState<string[]>([]);

  // ── Recherche (barre de la barre de filtres) ───────────────
  const [search,           setSearch]           = useState('');
  const [debouncedSearch,  setDebouncedSearch]  = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // ── Dérivés ───────────────────────────────────────────────
  const scopeErr = scope === 'products' && prodIds.length === 0;

  /**
   * Valide le formulaire AVANT envoi au serveur (le serveur valide aussi —
   * class-validator sur CreatePromotionDto — mais un message clair et
   * immédiat ici évite un aller-retour réseau pour une erreur de saisie
   * évidente, ex: réduction à 500% ou date d'expiration dans le passé).
   */
  const validationError = useMemo((): string | null => {
    if (!nom.trim())  return t('promotions.validation.nomRequired');
    if (!code.trim()) return t('promotions.validation.codeRequired');
    if (code.trim().length > 50) return t('promotions.validation.codeMaxLength');
    if (!/^[a-z0-9_-]+$/i.test(code.trim())) return t('promotions.validation.codeFormat');
    if (scopeErr) return t('promotions.validation.scopeRequired');

    if (type !== 'free-ship') {
      if (discount.trim() === '') return t('promotions.validation.discountRequired');
      const v = Number(discount);
      if (!Number.isFinite(v) || v <= 0) return t('promotions.validation.discountPositive');
      if (type === 'discount' && v > 100) return t('promotions.validation.discountMaxPct');
    }

    if (max.trim() !== '') {
      const m = Number(max);
      if (!Number.isInteger(m) || m <= 0) return t('promotions.validation.maxUsesInteger');
    }

    if (expire) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (new Date(expire) < today) return t('promotions.validation.expireInPast');
    }

    return null;
  }, [nom, code, scopeErr, type, discount, max, expire, t]);

  const canCreate = !validationError && !saving;

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
        promotionsApi.getAll({ limit: 100, search: debouncedSearch || undefined }),
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
      pop(t('promotions.toasts.loadError', { message: err.message ?? t('promotions.toasts.loadErrorDefault') }), 'e');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, pop, t]);

  useEffect(() => { loadData(); }, [loadData]);

  // ════════════════════════════════════════════════════════════
  // CRÉER OU METTRE À JOUR UNE PROMOTION
  // editingId === null → POST /promotions (+ activation immédiate)
  // editingId !== null → PATCH /promotions/:id (préserve le statut actuel)
  // ════════════════════════════════════════════════════════════
  async function save() {
    /* Re-vérifié explicitement (pas seulement via canCreate qui ne fait
       que désactiver le bouton) — au cas où l'appel viendrait d'ailleurs
       un jour, l'utilisateur doit toujours voir POURQUOI ça bloque. */
    if (validationError) {
      pop(`⚠️ ${validationError}`, 'w');
      return;
    }
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

      if (editingId) {
        await promotionsApi.update(editingId, dto);
        pop(t('promotions.toasts.updateSuccess', { nom }), 's');
        setShow(false);
        reset();
        loadData();
        return;
      }

      /* Créer en brouillon puis activer immédiatement */
      const created = await promotionsApi.create(dto);

      /* Activation automatique pour qu'elle soit visible dans la boutique.
         Si ça échoue, la promo existe bel et bien (en brouillon) — l'utilisateur
         doit le savoir plutôt que de croire qu'elle est déjà active. */
      try {
        await promotionsApi.activate(created.id);
      } catch (activateErr: any) {
        pop(t('promotions.toasts.activateFailedAfterCreate', { nom, err: activateErr?.message ?? 'erreur inconnue' }), 'w');
        setShow(false);
        reset();
        loadData();
        return;
      }

      const who = scope === 'global' ? t('promotions.toasts.whoGlobal') : t('promotions.toasts.whoProduits', { count: prodIds.length });
      pop(t('promotions.toasts.createSuccess', { nom, who }), 's');
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
      pop(t('promotions.toasts.draftMissingFields'), 'w');
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
      pop(t('promotions.toasts.draftSaved'), 'i');
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
    setEditingId(null);
    setNom(''); setCode(''); setDiscount(''); setExpire(''); setMax('');
    setType('discount'); setScope('global'); setProdIds([]);
  }

  /** Ouvre la modale en mode CRÉATION — repart toujours d'un formulaire vierge. */
  function openModal(t?: string) {
    reset();
    if (t) setType(t);
    setShow(true);
  }

  /** Ouvre la modale en mode ÉDITION, préremplie avec les données existantes. */
  function openEditModal(p: PromoResponse) {
    setEditingId(p.id);
    setNom(p.nom);
    setCode(p.code);
    setType(p.type);
    setDiscount(p.valeur != null ? String(p.valeur) : '');
    setMax(p.maxUtilisations != null ? String(p.maxUtilisations) : '');
    /* <input type="date"> attend YYYY-MM-DD — endDate est en ISO complet. */
    setExpire(p.endDate ? p.endDate.slice(0, 10) : '');
    setScope(p.scope);
    setProdIds(p.productIds ?? []);
    setShow(true);
  }

  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setShow(false); };
    if (show) document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [show]);

  // ── KPI cards depuis l'API (ou skeleton pendant le chargement) ─
  const kpiCards = [
    { ic:'🏷️', val: stats ? String(stats.total)      : '…', lbl:t('promotions.kpi.totales'),   sub:'', trend:'up',  k:'k1' as const },
    { ic:'✅', val: stats ? String(stats.actives)     : '…', lbl:t('promotions.kpi.actives'),   sub:t('promotions.kpi.activesSub', { count: stats?.planifiees ?? 0 }), trend:'neu', k:'k2' as const },
    { ic:'👆', val: stats ? String(stats.totalUses)   : '…', lbl:t('promotions.kpi.utilisationsTotales'), sub:'', trend:'up',  k:'k3' as const },
    { ic:'💰', val: stats ? formatCa(stats.totalCa)   : '…', lbl:t('promotions.kpi.caGenereGnf'),      sub:'', trend:'up',  k:'k4' as const },
  ];

  return (
    <div>

      {/* ════ HERO ════════════════════════════════════════════ */}
      <div className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroGrid} />
        <div className={styles.heroLeft}>
          <div className={styles.heroBadge}><span className={styles.heroDot} /> {t('promotions.hero.badge')}</div>
          <div className={styles.heroTitle}>{t('promotions.hero.titlePart1')} <em>{t('promotions.hero.titleEm')}</em></div>
          <div className={styles.heroSub}>{t('promotions.hero.sub')}</div>
          <div className={styles.heroBtns}>
            <button className={styles.hb1} onClick={() => openModal()}><i className="fas fa-plus" /> {t('promotions.hero.create')}</button>
            <button className={styles.hb2} onClick={() => pop(t('promotions.hero.exportToast'),'i')}><i className="fas fa-download" /> {t('promotions.hero.exportBtn')}</button>
          </div>
        </div>
        <div className={styles.heroRight}>
          {[
            { val: stats ? String(stats.actives)        : '…', unit:t('promotions.hero.statsActives'), lbl:t('promotions.hero.lblPromotions'),  trend:'+1',   up:true },
            { val: stats ? String(stats.totalUses)       : '…', unit:t('promotions.hero.statsTotal'),   lbl:t('promotions.hero.lblUtilisations'),trend:'+28%', up:true },
            { val: stats ? formatCa(stats.totalCa)       : '…', unit:t('promotions.hero.statsGnf'),     lbl:t('promotions.hero.lblCaGenere'),   trend:'+12%', up:true },
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
            { label:t('promotions.filters.toutes'),       value:'all'       as FilterKey, count:promos.length },
            { label:t('promotions.filters.actives'),    value:'active'    as FilterKey, count:promos.filter(p=>p.status==='active').length },
            { label:t('promotions.filters.planifiees'), value:'scheduled' as FilterKey, count:promos.filter(p=>p.status==='scheduled').length },
            { label:t('promotions.filters.brouillons'), value:'draft'     as FilterKey, count:promos.filter(p=>p.status==='draft').length },
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
            <input className={styles.searchInput} placeholder={t('promotions.filters.search')}
              value={search} onChange={e => setSearch(e.target.value)} />
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
              {t('promotions.loading')}
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🏷️</div>
              <div className={styles.emptyTitle}>{t('promotions.empty.title')}</div>
              <div className={styles.emptySub}>{t('promotions.empty.sub')}</div>
              <button className={styles.hb1} onClick={() => openModal()}><i className="fas fa-plus" /> {t('promotions.hero.create')}</button>
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
                  onEdit={openEditModal}
                />
              ))}
            </div>
          )}

          {/* Performance — utilise les vraies données */}
          <div className={styles.card} style={{ marginTop:16 }}>
            <div className={styles.cardHeader}>
              <div className={styles.cardHeaderTitle}><i className="fas fa-chart-bar" /> {t('promotions.performance.title')}</div>
              <span className={styles.cardBadge}>{t('promotions.performance.badge')}</span>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.perfList}>
                {promos.filter(p => p.uses > 0 || p.status === 'active').slice(0, 4).map((p, i) => {
                  const pct = maxUses > 0 ? (p.uses / maxUses) * 100 : 0;
                  return (
                    <div key={i} className={styles.perfRow}>
                      <div className={styles.perfLabel}>{p.nom}</div>
                      <div className={styles.perfTrack}>
                        <div className={styles.perfFill} style={{ width:`${pct}%`, background:'var(--t2)' }}>
                          {p.uses > 0 && <span>{p.uses}</span>}
                        </div>
                      </div>
                      <div className={styles.perfVal}>{p.uses} <span style={{ color:'var(--t4)',fontWeight:400 }}>{t('promotions.performance.uses')}</span></div>
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
              <div className={styles.cardHeaderTitle}><i className="fas fa-wand-magic-sparkles" /> {t('promotions.sidebar.creerRapide')}</div>
            </div>
            <div className={styles.cardBody} style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {getTemplates(t).map((tpl,i) => (
                <button key={i} className={styles.templateBtn}
                  onClick={() => { openModal(tpl.key); pop(t('promotions.sidebar.templateToast', { label: tpl.label }),'i'); }}>
                  <div className={styles.tmplIc} style={{ background:tpl.color+'18', color:tpl.color }}>{tpl.ic}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div className={styles.tmplLabel}>{tpl.label}</div>
                    <div className={styles.tmplSub}>{tpl.sub}</div>
                  </div>
                  <i className="fas fa-plus" style={{ color:tpl.color, fontSize:11, flexShrink:0 }} />
                </button>
              ))}
            </div>
          </div>

          <div className={styles.card} style={{ marginBottom:14 }}>
            <div className={styles.cardHeader}>
              <div className={styles.cardHeaderTitle}><i className="fas fa-fire" /> {t('promotions.sidebar.meilleuresPromos')}</div>
            </div>
            <div className={styles.cardBody} style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[...promos].sort((a,b) => b.uses - a.uses).slice(0, 3).map((p,i) => (
                <div key={i} className={styles.topItem}>
                  <div className={styles.topRank}>#{i+1}</div>
                  <div style={{ flex:1 }}>
                    <div className={styles.topNm}>{p.nom}</div>
                    <div className={styles.topCode}>{p.code}</div>
                  </div>
                  <div className={styles.topUses}>{p.uses} <span className={styles.topUsesSub}>{t('promotions.sidebar.uses')}</span></div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.tipsCard}>
            <div className={styles.tipsHead}><i className="fas fa-lightbulb" /> {t('promotions.sidebar.tipsTitle')}</div>
            <div className={styles.tipsBody}>
              {[
                { ic:'⚡', tip:t('promotions.sidebar.tip1') },
                { ic:'🚚', tip:t('promotions.sidebar.tip2') },
                { ic:'🎯', tip:t('promotions.sidebar.tip3') },
              ].map((tip,i) => (
                <div key={i} className={styles.tipItem}>
                  <span className={styles.tipIc}>{tip.ic}</span>
                  <span>{tip.tip}</span>
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
                <div className={styles.modalTitle}>{editingId ? t('promotions.modal.editTitle') : t('promotions.modal.createTitle')}</div>
                <div className={styles.modalSub}>{editingId ? t('promotions.modal.editSub') : t('promotions.modal.createSub')}</div>
              </div>
              <button className={styles.modalClose} onClick={() => setShow(false)}><i className="fas fa-xmark" /></button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label>{t('promotions.modal.typeLabel')}</label>
                <div className={styles.typeGrid}>
                  {Object.entries(getTypeCfg(t)).map(([key,cfg]) => (
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
                  <label>{t('promotions.modal.nomLabel')}</label>
                  <input className={styles.input} placeholder={t('promotions.modal.nomPlaceholder')} maxLength={255}
                    value={nom} onChange={e => setNom(e.target.value)} autoFocus />
                </div>
                <div className={styles.field}>
                  <label>{t('promotions.modal.codeLabel')}</label>
                  <input className={`${styles.input} ${styles.inputCode}`} placeholder={t('promotions.modal.codePlaceholder')} maxLength={50}
                    value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} />
                </div>
                <div className={styles.field}>
                  <label>{t('promotions.modal.discountLabel')}</label>
                  <div className={styles.inputSuffix}>
                    <input className={styles.input}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={type === 'discount' ? 100 : undefined}
                      step={type === 'discount' ? 1 : 'any'}
                      disabled={type === 'free-ship'}
                      placeholder={type==='discount'?t('promotions.modal.discountPlaceholderPct'):type==='free-ship'?t('promotions.modal.discountPlaceholderFree'):t('promotions.modal.discountPlaceholderFixed')}
                      value={discount}
                      onChange={e => setDiscount(e.target.value.replace(/[^0-9.]/g, ''))} />
                    <span className={styles.inputSuffixLabel}>{type==='discount'?'%':'GNF'}</span>
                  </div>
                </div>
                <div className={styles.field}>
                  <label>{t('promotions.modal.maxLabel')}</label>
                  <input className={styles.input} type="number" inputMode="numeric" min={1} step={1}
                    placeholder={t('promotions.modal.maxPlaceholder')}
                    value={max} onChange={e => setMax(e.target.value.replace(/[^0-9]/g, ''))} />
                </div>
                <div className={`${styles.field} ${styles.formFull}`}>
                  <label>{t('promotions.modal.expireLabel')}</label>
                  <input className={styles.input} type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={expire} onChange={e => setExpire(e.target.value)} />
                </div>
              </div>

              {/* PORTÉE */}
              <div className={styles.scopeSection}>
                <div className={styles.scopeSectionTitle}><i className="fas fa-crosshairs" /> {t('promotions.modal.scopeTitle')}</div>
                <div className={styles.scopeOpts}>
                  <div className={`${styles.scopeOpt} ${scope==='global' ? styles.scopeOptOn : ''}`}
                    onClick={() => { setScope('global'); setProdIds([]); }}>
                    <div className={`${styles.scopeRadio} ${scope==='global' ? styles.scopeRadioOn : ''}`} />
                    <div className={styles.scopeOptIco} style={{ background:'var(--sky-2,#E2EAFB)' }}>
                      <i className="fas fa-store" style={{ color:'var(--t2)' }} />
                    </div>
                    <div className={styles.scopeOptBody}>
                      <div className={styles.scopeOptTitle}>{t('promotions.modal.scopeGlobalTitle')}</div>
                      <div className={styles.scopeOptSub}>{t('promotions.modal.scopeGlobalSub')}</div>
                    </div>
                    <span className={styles.scopeOptTag} style={{ background:'var(--g100)', color:'var(--t2)' }}>
                      {t('promotions.modal.scopeProduits', { count: products.length })}
                    </span>
                  </div>

                  <div className={`${styles.scopeOpt} ${scope==='products' ? styles.scopeOptOn : ''}`}
                    onClick={() => setScope('products')}>
                    <div className={`${styles.scopeRadio} ${scope==='products' ? styles.scopeRadioOn : ''}`} />
                    <div className={styles.scopeOptIco} style={{ background:'rgba(128,128,128,.09)' }}>
                      <i className="fas fa-box" style={{ color:'var(--t2)' }} />
                    </div>
                    <div className={styles.scopeOptBody}>
                      <div className={styles.scopeOptTitle}>{t('promotions.modal.scopeProductsTitle')}</div>
                      <div className={styles.scopeOptSub}>{t('promotions.modal.scopeProductsSub')}</div>
                    </div>
                    {prodIds.length > 0 && (
                      <span className={styles.scopeOptTag} style={{ background:'rgba(128,128,128,.09)', color:'var(--t2)' }}>
                        {t('promotions.modal.scopeSelected', { count: prodIds.length })}
                      </span>
                    )}
                  </div>
                </div>

                {scope === 'products' && (
                  <div className={styles.prodSelWrap}>
                    {scopeErr && (
                      <div className={styles.scopeWarn}>
                        <i className="fas fa-triangle-exclamation" />
                        {t('promotions.modal.scopeWarn')}
                      </div>
                    )}
                    {/* ✅ Utilise les VRAIS produits de l'API au lieu du mock */}
                    <ProductSelector products={products} selected={prodIds} onChange={setProdIds} />
                  </div>
                )}
              </div>

              {(nom || code) && (
                <div className={styles.preview}>
                  <div className={styles.previewLabel}>{t('promotions.modal.previewLabel')}</div>
                  <div className={styles.previewRow}>
                    <div style={{ fontSize:28 }}>{getTypeCfg(t)[type]?.ic ?? '🏷️'}</div>
                    <div>
                      <div className={styles.previewNm}>{nom || t('promotions.modal.previewDefaultNom')}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                        <div className={styles.previewCode}>{code || t('promotions.modal.previewDefaultCode')}</div>
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
              <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setShow(false)} disabled={saving}>{t('promotions.modal.annuler')}</button>
              {!editingId && (
                <button className={`${styles.btn} ${styles.btnDraft}`} onClick={saveDraft} disabled={saving}>
                  <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`} /> {t('promotions.modal.brouillon')}
                </button>
              )}
              <button className={`${styles.btn} ${styles.btnCreate}`} onClick={save}
                disabled={!canCreate}
                title={validationError ?? ''}>
                <i className={`fas ${saving ? 'fa-spinner fa-spin' : editingId ? 'fa-check' : 'fa-rocket'}`} />
                {editingId ? ` ${t('promotions.modal.saveEdit')}` : ` ${t('promotions.modal.createBtn')}`}
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