/* ================================================================
 * FICHIER : src/modules/home/components/offres/pages/OffresPage.tsx
 *
 * RÔLE : Page publique "/offres" — liste toutes les promotions
 *        actives, toutes entreprises confondues (GET /promotions/public).
 *        Filtrable par type, cherchable, triable — tout en local
 *        puisque la liste complète (max 100) est déjà chargée.
 *
 *        Mise en page grand écran : barre latérale de filtres (fixe,
 *        sticky) + zone principale organisée en SECTIONS par
 *        catégorie de promo (Ventes flash, Réductions, Livraison
 *        offerte, Bundles) quand "Toutes" est sélectionné — plutôt
 *        qu'une grille unique mélangée. Sur mobile, la barre latérale
 *        redevient un bandeau de filtres horizontal au-dessus du
 *        contenu (voir OffresPage.module.css, breakpoint 960px).
 *
 * ROUTE : /offres (voir app/router.tsx)
 * ================================================================ */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import Header from '../../layout/Header';
import { promotionsApi, type PublicPromo, type PromoType } from '../../../../../shared/services/api/promotions.api';
import { useCountdown } from '../../../hooks/useCountdown';

import styles from './OffresPage.module.css';

const TYPE_ICON: Record<string, string> = {
  discount:    '🏷️',
  'free-ship': '🚚',
  bundle:      '🎁',
  flash:       '⚡',
};

const TYPE_COLOR: Record<string, string> = {
  discount:    'var(--rose)',
  'free-ship': 'var(--blue)',
  bundle:      'var(--violet)',
  flash:       'var(--amber)',
};

const TYPE_BG: Record<string, string> = {
  discount:    'var(--rs-bg)',
  'free-ship': 'var(--sky-2)',
  bundle:      'var(--vl-bg)',
  flash:       'var(--am-bg)',
};

function getTypeLabel(t: TFunction): Record<string, string> {
  return {
    discount:    t('offresPage.typeLabel.discount'),
    'free-ship': t('offresPage.typeLabel.freeShip'),
    bundle:      t('offresPage.typeLabel.bundle'),
    flash:       t('offresPage.typeLabel.flash'),
  };
}

/* Ordre d'affichage des sections quand "Toutes" est actif — l'urgence
   (ventes flash) prime, puis les réductions classiques (le gros du volume). */
const TYPE_ORDER: PromoType[] = ['flash', 'discount', 'free-ship', 'bundle'];

type SortKey = 'best' | 'ending';
type FilterKey = 'all' | PromoType;

function formatPct(p: PublicPromo, t: TFunction): string {
  if (p.valueType === 'percent' && p.valeur != null) return `−${p.valeur}%`;
  if (p.valueType === 'fixed'   && p.valeur != null) return `−${Number(p.valeur).toLocaleString('fr-FR')} GNF`;
  if (p.type === 'free-ship') return t('offresPage.card.offerte');
  return t('offresPage.card.promo');
}

/**
 * Clic sur une offre précise : va DIRECTEMENT sur la fiche du produit ciblé
 * si la promo est liée à un produit spécifique (scope='products'), ou sur
 * la boutique de l'entreprise si elle s'applique à tout son catalogue
 * (scope='global').
 */
function promoTarget(p: PublicPromo): string {
  return p.scope === 'products' && p.productIds.length > 0
    ? `/produit/${p.productIds[0]}`
    : `/boutique/${p.company.id}`;
}

/** Heures restantes avant expiration — null si pas de date limite. */
function hoursLeft(endDate: string | null): number | null {
  if (!endDate) return null;
  return (new Date(endDate).getTime() - Date.now()) / 3_600_000;
}

interface ToastState { msg: string; type: 's' | 'i' | 'w' | 'e' }

/** Badge d'expiration — compte à rebours live si < 24h, date sinon. */
function ExpiryBadge({ p }: { p: PublicPromo }) {
  const left   = hoursLeft(p.endDate);
  const urgent = left !== null && left <= 24;
  const timer  = useCountdown(urgent ? p.endDate : null);

  if (urgent && timer) {
    return (
      <div className={`${styles.cardExpire} ${styles.cardExpireUrgent}`}>
        <i className="fas fa-bolt" />
        {String(timer.h).padStart(2, '0')}:{String(timer.m).padStart(2, '0')}:{String(timer.s).padStart(2, '0')}
      </div>
    );
  }
  return (
    <div className={styles.cardExpire}>
      <i className="fas fa-calendar-alt" /> {p.expire}
    </div>
  );
}

/** Carte promo — réutilisée dans chaque section. */
function PromoCard({ p, onClick }: { p: PublicPromo; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <div className={styles.card} onClick={onClick}>
      {p.type === 'flash' && <div className={styles.cardRibbon}>⚡ Flash</div>}

      <div className={styles.cardTop}>
        <div className={styles.cardIco} style={{ background: TYPE_BG[p.type] ?? 'var(--rs-bg)', color: TYPE_COLOR[p.type] ?? 'var(--rose)' }}>
          {TYPE_ICON[p.type] ?? '🏷️'}
        </div>
        <div className={styles.cardPct} style={{ color: TYPE_COLOR[p.type] ?? 'var(--rose)' }}>{formatPct(p, t)}</div>
      </div>

      <div className={styles.cardCompany}>
        {p.company.logo
          ? <img className={styles.cardLogo} src={p.company.logo} alt={p.company.nom} />
          : <span className={styles.cardLogoFallback}>{p.company.nom.charAt(0).toUpperCase()}</span>}
        <span>{p.company.nom}</span>
      </div>

      <div className={styles.cardNom}>{p.nom}</div>

      <div className={styles.cardFoot}>
        <span className={styles.cardScope}>
          <i className={`fas ${p.scope === 'global' ? 'fa-store' : 'fa-box'}`} />
          {p.scope === 'global' ? t('offresPage.card.touteLaBoutique') : t('offresPage.card.produitCible')}
        </span>
        <ExpiryBadge p={p} />
      </div>

      <div className={styles.cardCta}>{t('offresPage.card.voirOffre')} <i className="fas fa-arrow-right" /></div>
    </div>
  );
}

export default function OffresPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [toast, setToast] = useState<ToastState | null>(null);
  const onToast = (msg: string, type: 's' | 'i' | 'w' | 'e' = 'i') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [promos,  setPromos]  = useState<PublicPromo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort,   setSort]   = useState<SortKey>('best');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    promotionsApi.getPublicActive(100)
      .then(setPromos)
      .catch((err: any) => setError(err?.message ?? t('offresPage.states.loadErrorFallback')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  /* Compteurs par type — pour les filtres de la barre latérale */
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of promos) counts[p.type] = (counts[p.type] ?? 0) + 1;
    return counts;
  }, [promos]);

  const flashCount = typeCounts.flash ?? 0;

  const visible = useMemo(() => {
    let list = promos;

    if (filter !== 'all') list = list.filter(p => p.type === filter);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p =>
        p.nom.toLowerCase().includes(q) || p.company.nom.toLowerCase().includes(q),
      );
    }

    if (sort === 'ending') {
      list = [...list].sort((a, b) => {
        if (!a.endDate) return 1;
        if (!b.endDate) return -1;
        return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
      });
    }

    return list;
  }, [promos, filter, search, sort]);

  /*
   * Regroupement par catégorie : quand "Toutes" est actif, on éclate
   * "visible" en une section par type (ordre TYPE_ORDER) pour bien
   * classer le contenu au lieu d'une grille mélangée. Quand un filtre
   * précis est actif, un seul groupe (déjà homogène) — pas d'en-tête
   * de section redondant avec la sélection dans la barre latérale.
   */
  const groups = useMemo(() => {
    if (filter !== 'all') {
      return visible.length > 0 ? [{ type: filter as PromoType, items: visible }] : [];
    }
    return TYPE_ORDER
      .map(type => ({ type, items: visible.filter(p => p.type === type) }))
      .filter(g => g.items.length > 0);
  }, [visible, filter]);

  const showSectionHeaders = filter === 'all' && groups.length > 1;

  const typeLabel = getTypeLabel(t);
  const FILTERS: { key: FilterKey; label: string; icon: string }[] = [
    { key: 'all',       label: t('offresPage.sidebar.toutes'), icon: '✨' },
    { key: 'flash',     label: typeLabel.flash,       icon: TYPE_ICON.flash },
    { key: 'discount',  label: typeLabel.discount,    icon: TYPE_ICON.discount },
    { key: 'free-ship', label: typeLabel['free-ship'],icon: TYPE_ICON['free-ship'] },
    { key: 'bundle',    label: typeLabel.bundle,      icon: TYPE_ICON.bundle },
  ];

  return (
    <div className={styles.page}>
      <Header
        onToast={onToast}
        onLogin={() => navigate('/login')}
        onRegister={() => navigate('/register')}
      />

      {/* ── Hero ── */}
      <div className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroWrap}>
          <div className={styles.heroBadge}><span className={styles.heroDot} /> {promos.length} {t('offresPage.hero.offreSuffix', { count: promos.length })}</div>
          <h1 className={styles.heroTitle}>{t('offresPage.hero.titrePart1')} <em>{t('offresPage.hero.titreEm')}</em> {t('offresPage.hero.titrePart2')}</h1>
          <p className={styles.heroSub}>
            {t('offresPage.hero.sub')}
          </p>
          {flashCount > 0 && (
            <div className={styles.heroFlash}>
              <i className="fas fa-bolt" /> {flashCount} {t('offresPage.hero.flashSuffix', { count: flashCount })}
            </div>
          )}
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.layout}>

          {/* ── Barre latérale : catégories + recherche + tri ── */}
          <aside className={styles.sidebar}>
            <div className={styles.sidebarCard}>
              <div className={styles.sidebarLabel}>{t('offresPage.sidebar.categories')}</div>
              <div className={styles.sideFilters}>
                {FILTERS.map(f => (
                  <button
                    key={f.key}
                    className={`${styles.sideFilterBtn} ${filter === f.key ? styles.sideFilterOn : ''}`}
                    onClick={() => setFilter(f.key)}
                  >
                    <span className={styles.sideFilterIco}>{f.icon}</span>
                    <span className={styles.sideFilterLabel}>{f.label}</span>
                    <span className={styles.sideFilterCount}>{f.key === 'all' ? promos.length : (typeCounts[f.key] ?? 0)}</span>
                  </button>
                ))}
              </div>

              <div className={styles.sidebarDiv} />

              <div className={styles.sidebarLabel}>{t('offresPage.sidebar.recherche')}</div>
              <div className={styles.searchBox}>
                <i className="fas fa-magnifying-glass" />
                <input
                  placeholder={t('offresPage.sidebar.searchPlaceholder')}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button className={styles.searchClear} onClick={() => setSearch('')}>
                    <i className="fas fa-xmark" />
                  </button>
                )}
              </div>

              <div className={styles.sidebarLabel}>{t('offresPage.sidebar.trierPar')}</div>
              <select className={styles.sortSelect} value={sort} onChange={e => setSort(e.target.value as SortKey)}>
                <option value="best">{t('offresPage.sidebar.sortBest')}</option>
                <option value="ending">{t('offresPage.sidebar.sortEnding')}</option>
              </select>
            </div>
          </aside>

          {/* ── Contenu principal ── */}
          <main className={styles.main}>

            {/* ── Chargement ── */}
            {loading && (
              <div className={styles.skeletonGrid}>
                {[...Array(8)].map((_, i) => <div key={i} className={styles.skeleton} />)}
              </div>
            )}

            {/* ── Erreur ── */}
            {error && !loading && (
              <div className={styles.empty}>
                <i className="fas fa-triangle-exclamation" />
                <div className={styles.emptyTitle}>{t('offresPage.states.loadErrorTitle')}</div>
                <div className={styles.emptyText}>{error}</div>
                <button className={styles.retryBtn} onClick={load}>
                  <i className="fas fa-rotate-right" /> {t('offresPage.states.reessayer')}
                </button>
              </div>
            )}

            {/* ── Vide (aucune promo active du tout) ── */}
            {!loading && !error && promos.length === 0 && (
              <div className={styles.empty}>
                <i className="fas fa-tag" />
                <div className={styles.emptyTitle}>{t('offresPage.states.aucuneOffreTitre')}</div>
                <div className={styles.emptyText}>{t('offresPage.states.aucuneOffreText')}</div>
              </div>
            )}

            {/* ── Vide (filtre/recherche sans résultat) ── */}
            {!loading && !error && promos.length > 0 && groups.length === 0 && (
              <div className={styles.empty}>
                <i className="fas fa-filter-circle-xmark" />
                <div className={styles.emptyTitle}>{t('offresPage.states.aucunResultatTitre')}</div>
                <div className={styles.emptyText}>{t('offresPage.states.aucunResultatText')}</div>
                <button className={styles.retryBtn} onClick={() => { setFilter('all'); setSearch(''); }}>
                  <i className="fas fa-rotate-left" /> {t('offresPage.states.reinitialiser')}
                </button>
              </div>
            )}

            {/* ── Sections par catégorie ── */}
            {!loading && groups.map(group => (
              <section key={group.type} className={styles.section}>
                {showSectionHeaders && (
                  <div className={styles.sectionHead}>
                    <div className={styles.sectionIco} style={{ background: TYPE_BG[group.type], color: TYPE_COLOR[group.type] }}>
                      {TYPE_ICON[group.type]}
                    </div>
                    <div className={styles.sectionTitle}>{typeLabel[group.type]}</div>
                    <div className={styles.sectionCount}>{group.items.length}</div>
                  </div>
                )}
                <div className={styles.grid}>
                  {group.items.map(p => (
                    <PromoCard key={p.id} p={p} onClick={() => navigate(promoTarget(p))} />
                  ))}
                </div>
              </section>
            ))}
          </main>
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--btn, #111113)', color: '#fff', padding: '10px 20px',
          borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999,
          boxShadow: '0 4px 16px rgba(0,0,0,.2)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
