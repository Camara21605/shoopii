/* ================================================================
 * FICHIER : src/modules/home/components/boutiques/pages/BoutiquesPage.tsx
 *
 * RÔLE : Page principale "/boutiques" — liste des entreprises,
 *        filtrable par catégorie / sous-catégorie / type d'entreprise,
 *        entièrement backend-driven (aucun filtrage local).
 *
 * ROUTE : /boutiques (voir app/router.tsx)
 * ================================================================ */

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Header from '../../layout/Header';
import CardEntreprise from '../../../cards/CardEntreprise';
import CategoryFilterBar from '../components/CategoryFilterBar';
import { useBoutiquesList } from '../hooks/useBoutiquesList';

import styles from './BoutiquesPage.module.css';

interface ToastState { msg: string; type: 's' | 'i' | 'w' | 'e' }

export default function BoutiquesPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [toast, setToast] = useState<ToastState | null>(null);
  const onToast = (msg: string, type: 's' | 'i' | 'w' | 'e' = 'i') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const categoryId    = searchParams.get('category')    ?? undefined;
  const subCategoryId = searchParams.get('subcategory') ?? undefined;
  const companyTypeId = searchParams.get('type')        ?? undefined;
  const modeParam      = searchParams.get('mode');
  const businessModel  = modeParam === 'products' || modeParam === 'services' ? modeParam : undefined;
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');

  const updateParams = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value); else params.delete(key);
    });
    setSearchParams(params);
  };

  const hasFilters = !!(categoryId || subCategoryId || companyTypeId || businessModel || searchInput);
  const resetFilters = () => {
    setSearchInput('');
    setSearchParams(new URLSearchParams());
  };

  const { boutiques, loading, error, total, hasMore, loadMore, reload, removeLocal } = useBoutiquesList({
    categoryId, subCategoryId, companyTypeId, businessModel, search: searchInput,
  });

  return (
    <div className={styles.page}>
      <Header
        onToast={onToast}
        onLogin={() => navigate('/login')}
        onRegister={() => navigate('/register')}
      />

      <div className={styles.body}>
        <div className={styles.hero}>
          <div className={styles.heroTitle}>{t('boutiquesPage.title')}</div>
          <div className={styles.heroSub}>
            {total > 0 ? t('boutiquesPage.subtitleCount', { count: total }) : t('boutiquesPage.subtitleDefault')}
          </div>
        </div>

        {/* ── Filtres : recherche → type → catégorie → sous-catégorie ──
         * Regroupés dans un seul panneau, du plus large au plus fin, pour
         * que la hiérarchie se lise d'un coup d'œil (avant : trois rangées
         * de puces au même niveau visuel, difficiles à distinguer). */}
        <div className={styles.filters}>
          <div className={styles.searchBox}>
            <i className="fas fa-magnifying-glass" />
            <input
              placeholder={t('boutiquesPage.searchPlaceholder')}
              value={searchInput}
              onChange={e => {
                setSearchInput(e.target.value);
                updateParams({ search: e.target.value || undefined });
              }}
            />
            {searchInput && (
              <button
                className={styles.searchClear}
                aria-label={t('boutiquesPage.resetFilters')}
                onClick={() => { setSearchInput(''); updateParams({ search: undefined }); }}
              >
                <i className="fas fa-xmark" />
              </button>
            )}
          </div>

          <div className={styles.segmented} role="tablist" aria-label={t('boutiquesPage.typeLabel')}>
            {([
              { val: undefined,           label: t('boutiquesPage.mode.tout') },
              { val: 'products' as const, label: t('boutiquesPage.mode.produits') },
              { val: 'services' as const, label: t('boutiquesPage.mode.services') },
            ]).map(opt => (
              <button
                key={opt.label}
                role="tab"
                aria-selected={businessModel === opt.val}
                className={`${styles.segBtn} ${businessModel === opt.val ? styles.segOn : ''}`}
                onClick={() => updateParams({ mode: opt.val })}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <CategoryFilterBar
            activeCategoryId={categoryId}
            activeSubCategoryId={subCategoryId}
            onSelectCategory={id => updateParams({ category: id, subcategory: undefined })}
            onSelectSubCategory={id => updateParams({ subcategory: id })}
          />
        </div>

        <div className={styles.secRow}>
          <div>
            <div className={styles.secTitle}>{t('boutiquesPage.resultats')}</div>
            {!error && (
              <div className={styles.secSub}>
                {loading && boutiques.length === 0 ? t('boutiquesPage.loading') : t('boutiquesPage.resultCount', { count: total })}
              </div>
            )}
          </div>
          {hasFilters && (
            <button className={styles.resetBtn} onClick={resetFilters}>
              <i className="fas fa-xmark" /> {t('boutiquesPage.resetFilters')}
            </button>
          )}
        </div>

        {/* ── État chargement (première page) ── */}
        {loading && boutiques.length === 0 && (
          <div className={styles.skeletonGrid}>
            {[...Array(8)].map((_, i) => <div key={i} className={styles.skeleton} />)}
          </div>
        )}

        {/* ── État erreur ── */}
        {error && !loading && boutiques.length === 0 && (
          <div className={styles.empty}>
            <i className={`fas fa-triangle-exclamation ${styles.emptyIcon}`} />
            <div className={styles.emptyTitle}>{t('boutiquesPage.errorTitle')}</div>
            {/* Pas le message brut du serveur (« Internal server error ») : illisible pour un client. */}
            <div className={styles.emptyText}>{t('boutiquesPage.errorText')}</div>
            <button className={styles.retryBtn} onClick={reload}>
              <i className="fas fa-rotate-right" /> {t('boutiquesPage.retry')}
            </button>
          </div>
        )}

        {/* ── État vide ── */}
        {!loading && !error && boutiques.length === 0 && (
          <div className={styles.empty}>
            <i className={`fas fa-store-slash ${styles.emptyIcon}`} />
            <div className={styles.emptyTitle}>{t('boutiquesPage.emptyTitle')}</div>
            <div className={styles.emptyText}>
              {t('boutiquesPage.emptyText')}
            </div>
          </div>
        )}

        {/* ── Grille ── */}
        {boutiques.length > 0 && (
          <div className={styles.cardsGrid}>
            {boutiques.map(b => (
              <CardEntreprise key={b.id} e={b} onToast={onToast} onRemoved={removeLocal} listMode />
            ))}
          </div>
        )}

        {/* ── Charger plus ── */}
        {!error && hasMore && boutiques.length > 0 && (
          <div className={styles.loadMore}>
            <button className={styles.loadMoreBtn} onClick={loadMore} disabled={loading}>
              {loading
                ? <><i className="fas fa-spinner fa-spin" /> {t('boutiquesPage.loading')}</>
                : <><i className="fas fa-arrow-down" /> {t('boutiquesPage.loadMore')}</>}
            </button>
          </div>
        )}
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
