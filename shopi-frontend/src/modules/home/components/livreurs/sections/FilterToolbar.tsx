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
import { useTranslation } from 'react-i18next';
import styles from '../styles/FilterToolbar.module.css';
import type { FilterType, SortOption, FilterState } from '../hooks/useLivreurs';

/* ── Props ── */
interface FilterToolbarProps {
  filters:        FilterState;
  totalCount:     number;
  onSearch:       (v: string) => void;
  onFilter:       (f: FilterType) => void;
  onSort:         (s: SortOption) => void;
  onAvailability: (v: 'all' | 'available' | 'busy') => void;
}

/* ================================================================
 * COMPOSANT PRINCIPAL
 * ================================================================ */
const FilterToolbar: React.FC<FilterToolbarProps> = ({
  filters, totalCount,
  onSearch, onFilter, onSort, onAvailability,
}) => {
  const { t } = useTranslation();

  /* ── Filtres rapides ── */
  const FILTERS: { key: FilterType; label: string; icon: string; greenDot?: boolean }[] = [
    { key: 'all',       label: t('livreursPage.toolbar.filters.tous'),         icon: 'fa-border-all'  },
    { key: 'available', label: t('livreursPage.toolbar.filters.disponibles'),  icon: 'fa-circle',  greenDot: true },
    { key: 'followed',  label: t('livreursPage.toolbar.filters.abonnements'),  icon: 'fa-check'       },
    { key: 'moto',      label: t('livreursPage.toolbar.filters.motos'),        icon: 'fa-motorcycle'  },
    { key: 'voiture',   label: t('livreursPage.toolbar.filters.voitures'),     icon: 'fa-car'         },
  ];

  /* ── Options de tri ── */
  const SORTS: { value: SortOption; label: string }[] = [
    { value: 'note',       label: t('livreursPage.toolbar.sorts.mieuxNotes')          },
    { value: 'livraisons', label: t('livreursPage.toolbar.sorts.plusDeLivraisons')    },
    { value: 'disponible', label: t('livreursPage.toolbar.sorts.disponiblesDabord')   },
    { value: 'proches',    label: t('livreursPage.toolbar.sorts.lesPlusProches')      },
  ];

  return (
    <div className={styles.toolbar}>
      <div className={styles.inner}>

        {/* ── Recherche ── */}
        <div className={styles.searchWrap}>
          <i className="fas fa-search" aria-hidden="true" />
          <input
            type="text"
            placeholder={t('livreursPage.toolbar.searchPlaceholder')}
            value={filters.searchQuery}
            onChange={e => onSearch(e.target.value)}
            aria-label={t('livreursPage.toolbar.rechercherLivreurAria')}
          />
          {filters.searchQuery && (
            <button
              className={styles.clearBtn}
              onClick={() => onSearch('')}
              aria-label={t('livreursPage.toolbar.effacerRechercheAria')}
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
                style={f.greenDot ? { fontSize: 8 } : undefined}
                aria-hidden="true"
              />
              {f.label}
            </button>
          </React.Fragment>
        ))}

        {/* ── Disponibilité (mobile uniquement — sur desktop, voir
         * SidebarFilters section Disponibilité, pour ne pas dupliquer) ── */}
        <button
          className={`${styles.filterBtn} ${styles.mobileOnly} ${filters.availabilityFilter === 'busy' ? styles.on : ''}`}
          onClick={() => onAvailability(filters.availabilityFilter === 'busy' ? 'all' : 'busy')}
          aria-pressed={filters.availabilityFilter === 'busy'}
        >
          <i className="fas fa-gear" aria-hidden="true" />
          {t('livreursPage.sidebar.enCourse')}
        </button>

        {/* Séparateur avant le tri */}
        <div className={styles.sep} aria-hidden="true" />

        {/* ── Sélecteur de tri ── */}
        <select
          className={styles.sortSelect}
          value={filters.sortBy}
          onChange={e => onSort(e.target.value as SortOption)}
          aria-label={t('livreursPage.toolbar.trierLivreursAria')}
        >
          {SORTS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* ── Compteur résultats ── */}
        <div className={styles.countPill} aria-live="polite">
          {t('livreursPage.toolbar.livreurCount', { count: totalCount })}
        </div>

      </div>
    </div>
  );
};

export default FilterToolbar;