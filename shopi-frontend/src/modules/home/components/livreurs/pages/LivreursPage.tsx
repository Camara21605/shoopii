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

import React, { useState } from 'react';
import { useNavigate }      from 'react-router-dom';

/* ── Layout partagé du module home ── */
import Header from '../../layout/Header';
import LivreurViewerBanner from '../../../../../shared/components/LivreurViewerBanner';

/* ── Sections de la page ── */
import HeroBanner      from '../sections/HeroBanner';
import FilterToolbar   from '../sections/FilterToolbar';
import SidebarFilters  from '../sections/SidebarFilters';
import SuggestionsRow  from '../sections/SuggestionsRow';

/* ── Cards ── */
import CardLivreurGrid from '../cards/CardLivreurGrid';
import CardLivreurList from '../cards/CardLivreurList';

/* ── Hook logique ── */
import { useLivreurs } from '../hooks/useLivreurs';

/* ── Données statiques ── */
import { HERO_STATS } from '../data/livreursMockData';

/* ── Styles ── */
import styles from '../styles/LivreursPage.module.css';

/* ── Toast simple interne (en attendant ToastContext) ── */
interface ToastState { msg: string; type: 's' | 'i' | 'w' | 'e' }

/* ================================================================
 * COMPOSANT PRINCIPAL
 * ================================================================ */
const LivreursPage: React.FC = () => {
  const navigate = useNavigate();

  /* ── Toast local ── */
  const [toast, setToast] = useState<ToastState | null>(null);
  const onToast = (msg: string, type: 's' | 'i' | 'w' | 'e' = 'i') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── Toute la logique vient du hook ── */
  const {
    livreurs, filtered, loading, error,
    filters, viewMode,
    onSearch, onFilter, onSort, onViewChange,
    onZone, onVehicleToggle, onRating, onAvailability,
    onReset, onFollow,
  } = useLivreurs(onToast);

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
        stats={HERO_STATS}
        featured={featuredLivreurs}
        onFollow={onFollow}
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
            onFollow={onFollow}
          />

          {/* En-tête de section */}
          <div className={styles.secRow}>
            <div>
              <div className={styles.secTitle}>Tous les livreurs</div>
              <div className={styles.secSub}>
                {filtered.length} livreur{filtered.length > 1 ? 's' : ''} dans votre région
              </div>
            </div>
            <div className={styles.viewBtns}>
              <button
                className={`${styles.vBtn} ${viewMode === 'grid' ? styles.vBtnOn : ''}`}
                onClick={() => onViewChange('grid')}
                title="Vue grille"
              >
                <i className="fas fa-th-large" />
              </button>
              <button
                className={`${styles.vBtn} ${viewMode === 'list' ? styles.vBtnOn : ''}`}
                onClick={() => onViewChange('list')}
                title="Vue liste"
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
              <div className={styles.emptyTitle}>Impossible de charger les livreurs</div>
              <div className={styles.emptyText}>{error}</div>
            </div>
          )}

          {/* ── État vide ── */}
          {!loading && !error && filtered.length === 0 && (
            <div className={styles.empty}>
              <i className="fas fa-motorcycle" />
              <div className={styles.emptyTitle}>Aucun livreur trouvé</div>
              <div className={styles.emptyText}>
                Essayez de modifier vos filtres ou votre recherche.
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
                  onFollow={onFollow}
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
                  onFollow={onFollow}
                />
              ))}
            </div>
          )}

          {/* ── Charger plus ── */}
          {!loading && filtered.length > 0 && (
            <div className={styles.loadMore}>
              <button
                className={styles.loadMoreBtn}
                onClick={() => onToast('📄 Chargement...', 'i')}
              >
                <i className="fas fa-arrow-down" />
                Charger plus de livreurs
              </button>
            </div>
          )}

        </main>
      </div>

      {/* ── Toast notification ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 's' ? '#065F46'
                    : toast.type === 'e' ? '#991B1B' : '#0B1F3A',
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