/* ================================================================
 * FICHIER : src/modules/home/components/livreurs/pages/LivreursPage.tsx
 *
 * RÔLE : Page principale "/livreurs".
 *        Assemble tous les sous-composants de la section Livreurs.
 *        Utilise le Header existant de home/components/layout/Header.tsx.
 *
 * ROUTE  : /livreurs (à ajouter dans app/router.tsx)
 * PARENT : router.tsx
 *
 * STRUCTURE :
 *   <Header />            ← header existant du projet
 *   <HeroBanner />        ← bannière hero navy avec stats
 *   <FilterToolbar />     ← barre filtres sticky
 *   <main>
 *     <SidebarFilters />  ← filtres avancés (desktop)
 *     <section>
 *       <SuggestionsRow /> ← rangée suggestions horizontale
 *       [grille ou liste de cards]
 *     </section>
 *   </main>
 * ================================================================ */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation }   from 'react-i18next';

/* ── Layout partagé du module home ── */
import Header from '../../layout/Header';
import LivreurViewerBanner from '../../../../../shared/components/LivreurViewerBanner';
import { apiFetch } from '../../../../../shared/services/apiFetch';

/* ── Sections de la page ── */
import HeroBanner      from '../sections/HeroBanner';
import FilterToolbar   from '../sections/FilterToolbar';
import SidebarFilters, { type ZoneCount } from '../sections/SidebarFilters';
import SuggestionsRow  from '../sections/SuggestionsRow';

/* ── Cards ── */
import CardLivreurGrid from '../cards/CardLivreurGrid';
import CardLivreurList from '../cards/CardLivreurList';

/* ── Hook logique ── */
import { useLivreurs } from '../hooks/useLivreurs';

/* ── Styles ── */
import styles from '../styles/LivreursPage.module.css';

/* ── Stats réseau réelles — GET /client/livreurs/stats ── */
interface NetworkStats {
  totalLivreurs:     number;
  averageRating:     string;
  totalLivraisons:   number;
  communesCouvertes: number;
}

/* ── Toast simple interne (en attendant ToastContext) ── */
interface ToastState { msg: string; type: 's' | 'i' | 'w' | 'e' }

/* ================================================================
 * COMPOSANT PRINCIPAL
 * ================================================================ */
const LivreursPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  /* ── Stats hero réelles — GET /client/livreurs/stats ──
   * BUG CORRIGÉ — HERO_STATS était un tableau 100% statique ("148 livreurs
   * actifs", "4.7★"…) qui ne changeait jamais quel que soit le contenu
   * réel de la base. Chargé une fois au montage ; tant que ça charge (ou
   * en cas d'échec), on affiche "…" plutôt qu'un chiffre inventé. */
  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null);
  useEffect(() => {
    apiFetch<NetworkStats>('/client/livreurs/stats').then(setNetworkStats).catch(() => {});
  }, []);

  const fmtCount = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K+` : String(n);
  const heroStats = [
    { value: networkStats ? String(networkStats.totalLivreurs)        : '…', label: t('livreursPage.hero.stats.livreursActifs') },
    { value: networkStats ? `${networkStats.averageRating}★`          : '…', label: t('livreursPage.hero.stats.noteMoyenne') },
    { value: networkStats ? fmtCount(networkStats.totalLivraisons)    : '…', label: t('livreursPage.hero.stats.livraisonsMois') },
    { value: networkStats ? String(networkStats.communesCouvertes)    : '…', label: t('livreursPage.hero.stats.communesCouvertes') },
  ];

  /* ── Compteurs de zone réels — GET /client/livreurs/zones ──
   * BUG CORRIGÉ — la sidebar affichait ZONES_OPTIONS, des comptes par
   * commune 100% statiques (148/34/41/28/19/26) sans rapport avec le
   * nombre réel de livreurs par commune. */
  const [zoneCounts, setZoneCounts] = useState<ZoneCount[] | null>(null);
  useEffect(() => {
    apiFetch<ZoneCount[]>('/client/livreurs/zones').then(setZoneCounts).catch(() => {});
  }, []);

  /* ── Toast local ── */
  const [toast, setToast] = useState<ToastState | null>(null);
  const onToast = (msg: string, type: 's' | 'i' | 'w' | 'e' = 'i') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* Recherche générale du Header (navigate('/livreurs', { state: { search } })) */
  const location = useLocation();
  const initialSearch = (location.state as { search?: string } | null)?.search;

  /* ── Toute la logique vient du hook ── */
  const {
    livreurs, filtered, loading, error,
    filters, viewMode,
    onSearch, onFilter, onSort, onViewChange,
    onZone, onVehicleToggle, onRating, onAvailability,
    onReset, onChange,
    hasMore, loadMore, loadingMore,
  } = useLivreurs(initialSearch);

  /* Si l'utilisateur relance une recherche depuis le Header en étant
   * déjà sur /livreurs, la route ne remonte pas (state seul change) —
   * on répercute donc explicitement le nouveau terme. */
  useEffect(() => {
    if (initialSearch) onSearch(initialSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSearch]);

  /* ── Livreurs déjà suivis (pour la sidebar) ── */
  const myFollowed = livreurs.filter(l => l.isSuivi);

  /* ── Livreurs en vedette dans le hero ── */
  const featuredLivreurs = livreurs.slice(0, 2);

  return (
    <div className={styles.page}>

      {/* ── Header existant du projet ── */}
      <Header
        onToast={msg => onToast(msg)}
        onLogin={()    => navigate('/login')}
        onRegister={()  => navigate('/register')}
      />
      <LivreurViewerBanner cible="livreurs" />

      {/* ── Hero banner ── */}
      <HeroBanner
        stats={heroStats}
        featured={featuredLivreurs}
        onToast={onToast}
        onChange={onChange}
      />

      {/* ── Barre de filtres sticky ── */}
      <FilterToolbar
        filters={filters}
        totalCount={filtered.length}
        viewMode={viewMode}
        onSearch={onSearch}
        onFilter={onFilter}
        onSort={onSort}
        onViewChange={onViewChange}
      />

      {/* ── Corps de la page ── */}
      <div className={styles.body}>

        {/* ── Sidebar filtres (desktop) ── */}
        <SidebarFilters
          filters={filters}
          myFollowed={myFollowed}
          zoneCounts={zoneCounts}
          onZone={onZone}
          onVehicleToggle={onVehicleToggle}
          onRating={onRating}
          onAvailability={onAvailability}
          onReset={onReset}
        />

        {/* ── Colonne principale ── */}
        <main className={styles.mainCol}>

          {/* Rangée suggestions */}
          <SuggestionsRow
            livreurs={livreurs}
            onToast={onToast}
            onChange={onChange}
          />

          {/* En-tête de section */}
          <div className={styles.secRow}>
            <div>
              <div className={styles.secTitle}>{t('livreursPage.page.tousLesLivreurs')}</div>
              <div className={styles.secSub}>
                {t('livreursPage.page.livreurDansRegion', { count: filtered.length })}
              </div>
            </div>
            <div className={styles.viewBtns}>
              <button
                className={`${styles.vBtn} ${viewMode === 'grid' ? styles.vBtnOn : ''}`}
                onClick={() => onViewChange('grid')}
                title={t('livreursPage.page.vueGrille')}
              >
                <i className="fas fa-th-large" />
              </button>
              <button
                className={`${styles.vBtn} ${viewMode === 'list' ? styles.vBtnOn : ''}`}
                onClick={() => onViewChange('list')}
                title={t('livreursPage.page.vueListe')}
              >
                <i className="fas fa-list" />
              </button>
            </div>
          </div>

          {/* ── État chargement ── */}
          {loading && (
            <div className={styles.skeletonGrid}>
              {[...Array(8)].map((_, i) => (
                <div key={i} className={styles.skeleton} />
              ))}
            </div>
          )}

          {/* ── État erreur ── */}
          {error && !loading && (
            <div className={styles.empty}>
              <i className="fas fa-triangle-exclamation" />
              <div className={styles.emptyTitle}>{t('livreursPage.page.impossibleDeCharger')}</div>
              <div className={styles.emptyText}>{error}</div>
            </div>
          )}

          {/* ── État vide ── */}
          {!loading && !error && filtered.length === 0 && (
            <div className={styles.empty}>
              <i className="fas fa-motorcycle" />
              <div className={styles.emptyTitle}>{t('livreursPage.page.aucunLivreurTrouve')}</div>
              <div className={styles.emptyText}>
                {t('livreursPage.page.essayezModifier')}
              </div>
            </div>
          )}

          {/* ── Vue GRILLE ── */}
          {!loading && !error && viewMode === 'grid' && filtered.length > 0 && (
            <div className={styles.cardsGrid}>
              {filtered.map(livreur => (
                <CardLivreurGrid
                  key={livreur.id}
                  livreur={livreur}
                  onToast={onToast}
                  onChange={onChange}
                />
              ))}
            </div>
          )}

          {/* ── Vue LISTE ── */}
          {!loading && !error && viewMode === 'list' && filtered.length > 0 && (
            <div>
              {filtered.map(livreur => (
                <CardLivreurList
                  key={livreur.id}
                  livreur={livreur}
                  onToast={onToast}
                  onChange={onChange}
                />
              ))}
            </div>
          )}

          {/* ── Charger plus — pagination réelle (voir useLivreurs.loadMore) ── */}
          {!loading && filtered.length > 0 && hasMore && (
            <div className={styles.loadMore}>
              <button
                className={styles.loadMoreBtn}
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore
                  ? <i className="fas fa-circle-notch fa-spin" />
                  : <i className="fas fa-arrow-down" />}
                {t('livreursPage.page.chargerPlus')}
              </button>
            </div>
          )}

        </main>
      </div>

      {/* ── Toast notification ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--btn, #111113)',
          color: '#fff', padding: '10px 20px', borderRadius: 10,
          fontSize: 13, fontWeight: 600, zIndex: 9999,
          boxShadow: '0 4px 16px rgba(0,0,0,.2)',
          animation: 'none',
        }}>
          {toast.msg}
        </div>
      )}

    </div>
  );
};

export default LivreursPage;