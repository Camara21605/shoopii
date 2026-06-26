/* ================================================================
 * FICHIER : src/modules/home/components/livreurs/sections/FilterToolbar.tsx
 *
 * RÔLE : Barre d'outils sticky (top: var(--hdr) = 66px).
 *        Contient : recherche, filtres rapides, tri, compteur, vue.
 *
 * PARENT : LivreursPage.tsx
 * STYLES : ../styles/FilterToolbar.module.css
 * ================================================================ */

import React from 'react';
import styles from '../styles/FilterToolbar.module.css';
import type { FilterType, SortOption, ViewMode, FilterState } from '../hooks/useLivreurs';

/* ── Props ── */
interface FilterToolbarProps {
  filters:        FilterState;
  totalCount:     number;
  viewMode:       ViewMode;
  onSearch:       (v: string) => void;
  onFilter:       (f: FilterType) => void;
  onSort:         (s: SortOption) => void;
  onViewChange:   (v: ViewMode) => void;
}

/* ── Filtres rapides ── */
const FILTERS: { key: FilterType; label: string; icon: string; greenDot?: boolean }[] = [
  { key: 'all',       label: 'Tous',           icon: 'fa-border-all'  },
  { key: 'available', label: 'Disponibles',    icon: 'fa-circle',  greenDot: true },
  { key: 'followed',  label: 'Abonnements',    icon: 'fa-check'       },
  { key: 'moto',      label: 'Motos',          icon: 'fa-motorcycle'  },
  { key: 'voiture',   label: 'Voitures',       icon: 'fa-car'         },
];

/* ── Options de tri ── */
const SORTS: { value: SortOption; label: string }[] = [
  { value: 'note',       label: 'Mieux notés'          },
  { value: 'livraisons', label: 'Plus de livraisons'   },
  { value: 'disponible', label: "Disponibles d'abord"  },
  { value: 'proches',    label: 'Les plus proches'     },
];

/* ================================================================
 * COMPOSANT PRINCIPAL
 * ================================================================ */
const FilterToolbar: React.FC<FilterToolbarProps> = ({
  filters, totalCount, viewMode,
  onSearch, onFilter, onSort, onViewChange,
}) => {
  return (
    <div className={styles.toolbar}>
      <div className={styles.inner}>

        {/* ── Recherche ── */}
        <div className={styles.searchWrap}>
          <i className="fas fa-search" aria-hidden="true" />
          <input
            type="text"
            placeholder="Nom, zone, véhicule…"
            value={filters.searchQuery}
            onChange={e => onSearch(e.target.value)}
            aria-label="Rechercher un livreur"
          />
          {filters.searchQuery && (
            <button
              className={styles.clearBtn}
              onClick={() => onSearch('')}
              aria-label="Effacer la recherche"
            >
              <i className="fas fa-xmark" />
            </button>
          )}
        </div>

        {/* ── Filtres rapides ── */}
        {FILTERS.map((f, i) => (
          <React.Fragment key={f.key}>
            {/* Séparateur visuel avant les véhicules */}
            {i === 3 && <div className={styles.sep} aria-hidden="true" />}
            <button
              className={`${styles.filterBtn} ${filters.activeFilter === f.key ? styles.on : ''}`}
              onClick={() => onFilter(f.key)}
              aria-pressed={filters.activeFilter === f.key}
            >
              <i
                className={`fas ${f.icon}`}
                style={f.greenDot ? { color: '#10B981', fontSize: 8 } : undefined}
                aria-hidden="true"
              />
              {f.label}
            </button>
          </React.Fragment>
        ))}

        {/* Séparateur avant le tri */}
        <div className={styles.sep} aria-hidden="true" />

        {/* ── Sélecteur de tri ── */}
        <select
          className={styles.sortSelect}
          value={filters.sortBy}
          onChange={e => onSort(e.target.value as SortOption)}
          aria-label="Trier les livreurs"
        >
          {SORTS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* ── Compteur résultats ── */}
        <div className={styles.countPill} aria-live="polite">
          {totalCount} livreur{totalCount > 1 ? 's' : ''}
        </div>

        {/* ── Toggle vue grille / liste ── */}
        <div className={styles.viewBtns} role="group" aria-label="Mode d'affichage">
          <button
            className={`${styles.vBtn} ${viewMode === 'grid' ? styles.vBtnOn : ''}`}
            onClick={() => onViewChange('grid')}
            title="Vue grille"
            aria-pressed={viewMode === 'grid'}
          >
            <i className="fas fa-th-large" aria-hidden="true" />
          </button>
          <button
            className={`${styles.vBtn} ${viewMode === 'list' ? styles.vBtnOn : ''}`}
            onClick={() => onViewChange('list')}
            title="Vue liste"
            aria-pressed={viewMode === 'list'}
          >
            <i className="fas fa-list" aria-hidden="true" />
          </button>
        </div>

      </div>
    </div>
  );
};

export default FilterToolbar;