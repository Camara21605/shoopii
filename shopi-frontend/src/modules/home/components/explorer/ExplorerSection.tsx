/* ================================================================
 * FICHIER : src/modules/home/components/explorer/ExplorerSection.tsx
 *
 * RÔLE : Contenu de l'onglet "Explorer" de la home client —
 *        recherche + filtres (catégorie/prix/ville) synchronisés à
 *        l'URL, sections "intelligentes" (Tendances/Nouveautés/Proches
 *        de vous, lues depuis le backend — voir GET /public/explore/*),
 *        puis grille principale paginée ("Charger plus").
 *
 * Rendu à l'ancre #blocs de HomePage.tsx (voir Header.tsx : le nav
 * "Explorer" scrolle vers cette ancre, ou y navigue depuis une autre
 * page avant de scroller).
 *
 * Réutilise CategoryFilterBar (déjà utilisé par /boutiques), CardProduit,
 * HScrollSection et SectionHeader — aucun nouveau design de carte créé.
 * ================================================================ */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import CardProduit from '../../cards/CardProduit';
import type { ProductApi } from '../../cards/CardProduit';
import CategoryFilterBar from '../boutiques/components/CategoryFilterBar';
import HScrollSection from '../ui/HScrollSection';
import SectionHeader from '../ui/SectionHeader';

import { useExploreGrid } from './hooks/useExploreGrid';
import { useExploreSection } from './hooks/useExploreSection';

import styles from './styles/ExplorerSection.module.css';

interface Props {
  onToast: (m: string, type?: 's' | 'i' | 'w' | 'e') => void;
}

/* ── Carte skeleton — même dégradé que RandomBloc/BoutiquesPage ── */
function SkeletonCard({ height = 280, width }: { height?: number; width?: number }) {
  return (
    <div className={styles.skeletonCard} style={{ height, width, flexShrink: width ? 0 : undefined }} />
  );
}

/* ── Un carrousel de section "intelligente" (Tendances/Nouveautés/Proches) ── */
function ExplorerCarousel({
  kick, title, icon, items, loading, error, emptyText, onToast, hideHeader,
}: {
  kick: string; title: string; icon: string;
  items: ProductApi[]; loading: boolean; error: boolean;
  emptyText?: string;
  onToast: (m: string, type?: 's' | 'i' | 'w' | 'e') => void;
  hideHeader?: boolean;
}) {
  if (!loading && !error && items.length === 0 && !emptyText) return null;

  return (
    <div className={styles.smartSection}>
      {!hideHeader && <SectionHeader kick={kick} title={`<i class="fas ${icon}"></i> ${title}`} />}
      {loading && (
        <HScrollSection>
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} height={260} width={220} />)}
        </HScrollSection>
      )}
      {!loading && error && (
        <div className={styles.smartEmpty}>{title} — indisponible pour le moment.</div>
      )}
      {!loading && !error && items.length === 0 && emptyText && (
        <div className={styles.smartEmpty}>{emptyText}</div>
      )}
      {!loading && !error && items.length > 0 && (
        <HScrollSection>
          {items.map(p => (
            <div key={p.id} className={styles.carouselCard}>
              <CardProduit p={p} onToast={onToast} />
            </div>
          ))}
        </HScrollSection>
      )}
    </div>
  );
}

export default function ExplorerSection({ onToast }: Props) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);

  const category = searchParams.get('category') ?? undefined;
  const minPrice = searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined;
  const maxPrice = searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined;
  const ville    = searchParams.get('ville') ?? undefined;
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '');

  const updateParams = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value); else params.delete(key);
    });
    setSearchParams(params, { replace: true });
  };

  const hasActiveFilters = !!(category || minPrice != null || maxPrice != null || ville);

  const { items, loading, error, hasMore, loadMore, reload } = useExploreGrid({
    search: searchInput, category, minPrice, maxPrice, ville,
  });

  const tendances  = useExploreSection('/public/explore/tendances',  { limit: 12 });
  const nouveautes = useExploreSection('/public/explore/nouveautes', { limit: 12 });
  const proches    = useExploreSection('/public/explore/proches',    { ville, limit: 12 }, !!ville);

  return (
    <div className={styles.wrap}>

      {/* ── Barre de recherche + bouton filtres ── */}
      <div className={styles.searchRow}>
        <div className={styles.searchBox}>
          <i className="fas fa-magnifying-glass" />
          <input
            className={styles.searchInput}
            placeholder={t('home.explorer.searchPlaceholder')}
            value={searchInput}
            onChange={e => { setSearchInput(e.target.value); updateParams({ q: e.target.value || undefined }); }}
          />
          {searchInput && (
            <button className={styles.searchClear} onClick={() => { setSearchInput(''); updateParams({ q: undefined }); }}>
              <i className="fas fa-xmark" />
            </button>
          )}
        </div>
        <button
          className={`${styles.filterToggle} ${hasActiveFilters ? styles.filterToggleActive : ''}`}
          onClick={() => setShowFilters(s => !s)}
        >
          <i className="fas fa-sliders" /> {t('home.explorer.filtres')}
          {hasActiveFilters && <span className={styles.filterDot} />}
        </button>
      </div>

      {/* ── Chips catégories (composant déjà utilisé par /boutiques) ── */}
      <CategoryFilterBar
        activeCategoryId={category}
        activeSubCategoryId={undefined}
        onSelectCategory={id => updateParams({ category: id })}
        onSelectSubCategory={() => {}}
      />

      {/* ── Panneau de filtres (prix, ville) ── */}
      {showFilters && (
        <div className={styles.filterPanel}>
          <div className={styles.filterField}>
            <label>{t('home.explorer.prixMin')}</label>
            <input
              type="number" min={0} inputMode="numeric"
              value={minPrice ?? ''} placeholder="0"
              onChange={e => updateParams({ minPrice: e.target.value || undefined })}
            />
          </div>
          <div className={styles.filterField}>
            <label>{t('home.explorer.prixMax')}</label>
            <input
              type="number" min={0} inputMode="numeric"
              value={maxPrice ?? ''} placeholder="—"
              onChange={e => updateParams({ maxPrice: e.target.value || undefined })}
            />
          </div>
          <div className={styles.filterField}>
            <label>{t('home.explorer.ville')}</label>
            <input
              type="text"
              value={ville ?? ''} placeholder={t('home.explorer.villePlaceholder')}
              onChange={e => updateParams({ ville: e.target.value || undefined })}
            />
          </div>
          {hasActiveFilters && (
            <button
              className={styles.resetBtn}
              onClick={() => updateParams({ category: undefined, minPrice: undefined, maxPrice: undefined, ville: undefined })}
            >
              <i className="fas fa-rotate-left" /> {t('home.explorer.reinitialiser')}
            </button>
          )}
        </div>
      )}

      {/* ── Sections intelligentes ── */}
      <ExplorerCarousel
        kick={t('home.explorer.tendances.kick')} title={t('home.explorer.tendances.title')} icon="fa-fire"
        items={tendances.items} loading={tendances.loading} error={tendances.error} onToast={onToast}
      />
      <ExplorerCarousel
        kick={t('home.explorer.nouveautes.kick')} title={t('home.explorer.nouveautes.title')} icon="fa-sparkles"
        items={nouveautes.items} loading={nouveautes.loading} error={nouveautes.error} onToast={onToast}
      />
      <ExplorerCarousel
        kick={t('home.explorer.proches.kick')} title={t('home.explorer.proches.title')} icon="fa-location-dot"
        items={proches.items} loading={ville ? proches.loading : false} error={proches.error}
        emptyText={!ville ? t('home.explorer.proches.renseignerVille') : t('home.explorer.proches.aucun')}
        onToast={onToast} hideHeader
      />

      {/* ── Grille principale ── */}
      <div className={styles.gridSection}>
        {loading && items.length === 0 && (
          <div className={styles.grid}>
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} height={320} />)}
          </div>
        )}

        {error && !loading && items.length === 0 && (
          <div className={styles.empty}>
            <i className="fas fa-triangle-exclamation" />
            <div className={styles.emptyTitle}>{t('home.explorer.grille.errorTitle')}</div>
            <div className={styles.emptyText}>{error}</div>
            <button className={styles.retryBtn} onClick={reload}>
              <i className="fas fa-rotate-right" /> {t('home.explorer.grille.reessayer')}
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className={styles.empty}>
            <i className="fas fa-box-open" />
            <div className={styles.emptyTitle}>{t('home.explorer.grille.emptyTitle')}</div>
            <div className={styles.emptyText}>{t('home.explorer.grille.emptyText')}</div>
          </div>
        )}

        {items.length > 0 && (
          <div className={styles.grid}>
            {items.map(p => <CardProduit key={p.id} p={p} onToast={onToast} />)}
          </div>
        )}

        {!error && hasMore && items.length > 0 && (
          <div className={styles.loadMoreRow}>
            <button className={styles.loadMoreBtn} onClick={loadMore} disabled={loading}>
              {loading
                ? <><i className="fas fa-spinner fa-spin" /> {t('home.explorer.grille.chargement')}</>
                : <><i className="fas fa-arrow-down" /> {t('home.explorer.grille.chargerPlus')}</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
